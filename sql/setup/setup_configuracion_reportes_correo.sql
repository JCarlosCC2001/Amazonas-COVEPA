-- ============================================================
-- SETUP: CONFIGURACIÓN DE REPORTES AUTOMÁTICOS POR CORREO
-- Proyecto: Amazonas - COVEPA
-- Permite almacenar la programación horaria, destinatarios y notas
-- para el envío automático nocturno del consolidado diario.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.configuracion_reportes_correo (
  id TEXT PRIMARY KEY DEFAULT 'config_diario',
  activo BOOLEAN NOT NULL DEFAULT true,
  hora_envio TIME NOT NULL DEFAULT '21:00:00',
  destinatarios TEXT[] NOT NULL DEFAULT ARRAY['ccondor@covepa.pe'],
  destinatarios_cc TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  asunto TEXT NOT NULL DEFAULT '[COVEPA] Reporte Diario de Observaciones - {fecha}',
  notas_jornada TEXT DEFAULT 'Cierre operativo de observaciones de la jornada.',
  ultimo_envio_at TIMESTAMPTZ DEFAULT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_by TEXT DEFAULT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.configuracion_reportes_correo ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso
DROP POLICY IF EXISTS "Lectura de configuracion de reportes" ON public.configuracion_reportes_correo;
CREATE POLICY "Lectura de configuracion de reportes"
  ON public.configuracion_reportes_correo
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Modificacion de configuracion de reportes" ON public.configuracion_reportes_correo;
CREATE POLICY "Modificacion de configuracion de reportes"
  ON public.configuracion_reportes_correo
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Registro inicial por defecto si no existe
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
  'config_diario',
  true,
  '21:00:00',
  ARRAY['ccondor@covepa.pe'],
  ARRAY[]::TEXT[],
  '[COVEPA] Reporte Diario de Observaciones - {fecha}',
  'Cierre operativo de observaciones de la jornada.'
)
ON CONFLICT (id) DO NOTHING;

