-- =========================================================================================
-- MIGRACIÓN SQL: CORRECCIÓN DEL TRIGGER DE SOLICITUD DE REVISIÓN (TRAZABILIDAD Y REVISOR GILAT)
-- Archivo: sql/migraciones/20261125_corregir_trigger_solicitud_revisor_gilat.sql
-- Motivo:
--   Evitar que auditores de Gilat (ej. Amilcar Hander, Flor Duran, etc.) sean atribuidos por
--   error como la persona que solicitó revisión desde campo (App Fotos).
--   La columna 'revisor' almacena auditores Gilat de revisiones previas (OLD.revisor).
--   El técnico real proviene de 'tecnico_ejecutor'.
-- =========================================================================================

CREATE OR REPLACE FUNCTION public.trg_trazabilidad_solicitud_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tecnico_nombre TEXT;
  v_ya_registrado BOOLEAN;
  v_cand_revisor TEXT;
BEGIN
  -- Detectar transición hacia 'Solicitando Revisión'
  IF (NEW.estado_covepa IN ('Solicitando Revisión', 'Solicitando Revision')) AND 
     (OLD.estado_covepa IS NULL OR OLD.estado_covepa NOT IN ('Solicitando Revisión', 'Solicitando Revision')) THEN
    
    -- Evaluar si NEW.revisor contiene un auditor oficial de Gilat
    v_cand_revisor := NULLIF(TRIM(NEW.revisor), '');
    IF v_cand_revisor IS NOT NULL AND (
      LOWER(v_cand_revisor) LIKE '%gilat%' OR 
      LOWER(v_cand_revisor) IN (
        'amilcar hander', 'flor duran', 'helio camac', 'karin cepeda', 
        'thalia urquizo', 'carlos condor', 'hans ventocilla', 'auditor gilat', 'revisor gilat'
      )
    ) THEN
      v_cand_revisor := NULL;
    END IF;

    -- Determinar el nombre del técnico de campo:
    -- 1. tecnico_ejecutor (NEW o OLD)
    -- 2. revisor SOLO si no es un auditor de Gilat
    -- 3. Fallback genérico 'Técnico de Campo (App Fotos)'
    v_tecnico_nombre := COALESCE(
      NULLIF(TRIM(NEW.tecnico_ejecutor), ''),
      NULLIF(TRIM(OLD.tecnico_ejecutor), ''),
      v_cand_revisor,
      'Técnico de Campo (App Fotos)'
    );

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
      'revisor gilat', 'auditor gilat', 'carlos condor', 'hans ventocilla', 'gilat',
      'amilcar hander', 'flor duran', 'helio camac', 'karin cepeda', 'thalia urquizo'
    ) THEN
      NEW.revisor := NULL;
    END IF;
    
  END IF;

  RETURN NEW;
END;
$$;

-- Notificar recarga de schema a PostgREST
NOTIFY pgrst, 'reload schema';
