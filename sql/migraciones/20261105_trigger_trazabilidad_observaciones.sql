-- =========================================================================================
-- MIGRACIÓN SQL: TRIGGER DE TRAZABILIDAD AUTOMÁTICA Y NULIDAD DE REVISOR NO-GILAT
-- Archivo: sql/migraciones/20261105_trigger_trazabilidad_observaciones.sql
-- Propósito:
--   1. Asegura que cuando una observación pase a 'Solicitando Revisión' desde campo (App Fotos),
--      se registre atómicamente en historial_estados_observaciones con 0 consultas del navegador.
--   2. Si 'revisor' vino con el nombre del técnico, lo limpia a NULL en observaciones,
--      reservando ese campo exclusivamente para los auditores oficiales de Gilat.
-- =========================================================================================

CREATE OR REPLACE FUNCTION public.trg_trazabilidad_solicitud_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tecnico_nombre TEXT;
  v_ya_registrado BOOLEAN;
BEGIN
  -- Detectar transición hacia 'Solicitando Revisión'
  IF (NEW.estado_covepa IN ('Solicitando Revisión', 'Solicitando Revision')) AND 
     (OLD.estado_covepa IS NULL OR OLD.estado_covepa NOT IN ('Solicitando Revisión', 'Solicitando Revision')) THEN
    
    -- Determinar el nombre del técnico
    v_tecnico_nombre := COALESCE(NULLIF(TRIM(NEW.revisor), ''), NULLIF(TRIM(OLD.revisor), ''), 'Técnico de Campo (App Fotos)');

    -- Verificar que no exista un registro idéntico insertado en los últimos 30 segundos (anti-duplicados)
    SELECT EXISTS (
      SELECT 1 FROM public.historial_estados_observaciones
      WHERE id_obs = NEW.id_obs
        AND estado_nuevo IN ('Solicitando Revisión', 'Solicitando Revision')
        AND created_at >= (NOW() - INTERVAL '30 seconds')
    ) INTO v_ya_registrado;

    -- Registrar en historial si no existe duplicado reciente
    IF NOT v_ya_registrado THEN
      INSERT INTO public.historial_estados_observaciones (
        id_obs,
        id_sitio,
        estado_anterior,
        estado_nuevo,
        usuario_nombre,
        comentario,
        origen,
        created_at
      ) VALUES (
        NEW.id_obs,
        NEW.id_sitio,
        COALESCE(OLD.estado_covepa, 'Pendiente'),
        'Solicitando Revisión',
        v_tecnico_nombre,
        'Solicitud de revisión técnica enviada desde campo',
        'app_fotos',
        COALESCE(NEW.fecha_subsanacion, NOW())
      );
    END IF;

    -- Regla estricta COVEPA: 'revisor' en observaciones es exclusivo de Gilat.
    -- Si el técnico o app de fotos envió su nombre en 'revisor', limpiarlo a NULL
    IF NEW.revisor IS NOT NULL AND LOWER(NEW.revisor) NOT LIKE '%gilat%' AND LOWER(NEW.revisor) NOT IN (
      'revisor gilat', 'auditor gilat', 'carlos condor', 'hans ventocilla', 'gilat'
    ) THEN
      NEW.revisor := NULL;
    END IF;
    
  END IF;

  RETURN NEW;
END;
$$;

-- Crear el trigger antes de la actualización
DROP TRIGGER IF EXISTS trg_observaciones_solicitud_revision ON public.observaciones;

CREATE TRIGGER trg_observaciones_solicitud_revision
BEFORE UPDATE OF estado_covepa, revisor ON public.observaciones
FOR EACH ROW
EXECUTE FUNCTION public.trg_trazabilidad_solicitud_revision();

-- Notificar recarga de schema a PostgREST
NOTIFY pgrst, 'reload schema';

