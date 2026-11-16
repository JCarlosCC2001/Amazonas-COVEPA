-- ==============================================================================
-- Migración: Registro Inicial para Reporte Diario de Amazonas Ampliación
-- Archivo: sql/migraciones/20261116_anadir_config_diario_ampliacion.sql
-- ==============================================================================

INSERT INTO public.configuracion_reportes_correo (
  id,
  activo,
  hora_envio,
  destinatarios,
  destinatarios_cc,
  asunto,
  notas_jornada,
  periodo_reporte,
  destinatario_prueba,
  created_at,
  updated_at
) VALUES (
  'config_diario_ampliacion',
  true,
  '21:00:00',
  ARRAY['ccondor@covepa.pe'],
  ARRAY[]::text[],
  '[COVEPA] Reporte Diario de Levantamiento de Observaciones (Amazonas Ampliación) - {fecha}',
  'Cierre operativo de observaciones de la jornada - Amazonas Ampliación.',
  'dia_actual',
  '',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  asunto = EXCLUDED.asunto,
  periodo_reporte = EXCLUDED.periodo_reporte;
