-- =========================================================================================
-- MIGRACIÓN SQL: ACTUALIZAR RPC DE KPIS GLOBALES CON ESTADO 'DOCUMENTACIÓN'
-- Archivo: sql/migraciones/20261105_actualizar_rpc_kpis_documentacion.sql
-- Propósito:
--   Incorpora el conteo nativo del nuevo estado 'Documentación' a la función
--   get_dashboard_kpis() para devolver todos los contadores en una sola llamada ultraligera.
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
  v_documentacion INT;
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

  -- 4. Documentación (Nuevo estado COVEPA)
  SELECT COUNT(*) INTO v_documentacion 
  FROM public.observaciones 
  WHERE estado_covepa IN ('Documentación', 'Documentacion');

  -- 5. Validadas (incluye estado Validado, Enviado o con fecha_subsanacion resuelta)
  SELECT COUNT(*) INTO v_validadas 
  FROM public.observaciones 
  WHERE estado_covepa IN ('Validado', 'Enviado')
     OR (fecha_subsanacion IS NOT NULL 
         AND estado_covepa NOT IN ('Descartado', 'En Revision', 'En Revisión', 'Solicitando Revision', 'Solicitando Revisión', 'Rechazado', 'Documentación', 'Documentacion'));

  -- 6. Rechazadas
  SELECT COUNT(*) INTO v_rechazadas 
  FROM public.observaciones 
  WHERE estado_covepa = 'Rechazado';

  -- 7. Descartadas
  SELECT COUNT(*) INTO v_descartadas 
  FROM public.observaciones 
  WHERE estado_covepa = 'Descartado';

  -- 8. Resueltas y Pendientes
  v_resueltas := v_validadas + v_descartadas;
  v_pendientes := GREATEST(0, v_total - (v_resueltas + v_solicitando + v_en_revision + v_rechazadas + v_documentacion));
  
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
    'documentacion', v_documentacion,
    'validadas', v_validadas,
    'rechazadas', v_rechazadas,
    'descartadas', v_descartadas,
    'resueltas', v_resueltas,
    'porcentajeGlobal', v_porcentaje
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis() TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
