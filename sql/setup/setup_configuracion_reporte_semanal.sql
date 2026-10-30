-- ============================================================
-- SETUP: CONFIGURACIÓN DE REPORTE SEMANAL POR CORREO
-- Proyecto: Amazonas - COVEPA
-- Registro para la configuración del despacho consolidado semanal
-- ============================================================

INSERT INTO public.configuracion_reportes_correo (
  id,
  activo,
  hora_envio,
  destinatarios,
  destinatarios_cc,
  asunto,
  notas_jornada
)
VALUES (
  'config_semanal',
  true,
  '20:00:00',
  ARRAY['ccondor@covepa.pe'],
  ARRAY[]::TEXT[],
  '[COVEPA] Reporte Semanal de Observaciones Amazonas - {semana}',
  'Consolidado semanal de observaciones levantadas y avances de la semana.'
)
ON CONFLICT (id) DO NOTHING;

