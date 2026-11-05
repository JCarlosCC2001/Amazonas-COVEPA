-- =========================================================================================
-- MIGRACIÓN SQL: FUNCIÓN RPC PARA CONTEO DE KPIS GLOBALES EN SUPABASE
-- Archivo: sql/migraciones/20261105_rpc_dashboard_kpis.sql
-- Propósito:
--   Calcula y devuelve todos los contadores del Dashboard en una sola consulta
--   atómica interna de Postgres, ahorrando múltiples llamadas HTTP y reduciendo
--   el tráfico de salida (egress) a un objeto JSON de apenas ~150 bytes.
-- =========================================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INT;
  v_pendientes INT;
  v_solicitando INT;
  v_en_revision INT;
  v_validadas INT;
  v_rechazadas INT;
  v_descartadas INT;
  v_resueltas INT;
  v_porcentaje NUMERIC;
BEGIN
  -- 1. Total de observaciones
  SELECT COUNT(*) INTO v_total FROM public.observaciones;

  -- 2. Solicitando Revisión
  SELECT COUNT(*) INTO v_solicitando 
  FROM public.observaciones 
  WHERE estado_covepa IN ('Solicitando Revisión', 'Solicitando Revision');

  -- 3. En Revisión
  SELECT COUNT(*) INTO v_en_revision 
  FROM public.observaciones 
  WHERE estado_covepa IN ('En Revisión', 'En Revision');

  -- 4. Validadas (incluye estado Validado, Enviado o con fecha_subsanacion no nula resuelta)
  SELECT COUNT(*) INTO v_validadas 
  FROM public.observaciones 
  WHERE estado_covepa IN ('Validado', 'Enviado')
     OR (fecha_subsanacion IS NOT NULL 
         AND estado_covepa NOT IN ('Descartado', 'En Revision', 'En Revisión', 'Solicitando Revision', 'Solicitando Revisión', 'Rechazado'));

  -- 5. Rechazadas
  SELECT COUNT(*) INTO v_rechazadas 
  FROM public.observaciones 
  WHERE estado_covepa = 'Rechazado';

  -- 6. Descartadas
  SELECT COUNT(*) INTO v_descartadas 
  FROM public.observaciones 
  WHERE estado_covepa = 'Descartado';

  -- 7. Resueltas y Pendientes
  v_resueltas := v_validadas + v_descartadas;
  v_pendientes := GREATEST(0, v_total - (v_resueltas + v_solicitando + v_en_revision + v_rechazadas));
  
  IF v_total > 0 THEN
    v_porcentaje := ROUND(((v_resueltas::NUMERIC / v_total::NUMERIC) * 100), 1);
  ELSE
    v_porcentaje := 0.0;
  END IF;

  RETURN jsonb_build_object(
    'total', v_total,
    'pendientes', v_pendientes,
    'solicitando', v_solicitando,
    'enRevision', v_en_revision,
    'validadas', v_validadas,
    'rechazadas', v_rechazadas,
    'descartadas', v_descartadas,
    'resueltas', v_resueltas,
    'porcentajeGlobal', v_porcentaje
  );
END;
$$;

-- Otorgar permiso de ejecución al rol autenticado y anónimo
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis() TO authenticated, anon;

-- Notificar recarga de schema a PostgREST
NOTIFY pgrst, 'reload schema';
