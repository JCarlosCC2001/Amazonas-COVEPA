-- ============================================================
-- MIGRACIÓN: CONFIGURACIÓN PARA REPORTE DIARIO INTERNO COVEPA
-- Proyecto: Amazonas - COVEPA
-- Fecha: 13/11/2026
-- Objetivo: Registrar la configuración del Reporte Diario Interno
--           (Cifras del día y Cuadro Matricial por Equipos)
-- ============================================================

INSERT INTO public.configuracion_reportes_correo (
  id,
  activo,
  hora_envio,
  destinatarios,
  destinatarios_cc,
  asunto,
  notas_jornada,
  periodo_reporte
)
VALUES (
  'config_diario_interno',
  true,
  '21:30:00',
  ARRAY['ccondor@covepa.pe'],
  ARRAY[]::TEXT[],
  '[COVEPA INTERNO] Resumen Operativo de Jornada - {fecha}',
  'Reporte interno de cuadrillas y avance de observaciones trabajadas en el día.',
  'dia_actual'
)
ON CONFLICT (id) DO UPDATE SET
  updated_at = timezone('utc'::text, now());

