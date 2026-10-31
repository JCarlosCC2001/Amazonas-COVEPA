-- ============================================================
-- MIGRACIÓN: AÑADIR COLUMNAS DE TIEMPOS DE EJECUCIÓN A OBSERVACIONES
-- Proyecto: Amazonas - COVEPA
-- Tabla objetivo: public.observaciones
--
-- Columnas añadidas:
--   1. tiempo_ejecucion_real: Tiempo neto/real de ejecución en formato HH:MM (ej: '01:30', '00:45')
--   2. tiempo_ejecucion_demora: Tiempo total con demoras/incidentes en formato HH:MM (ej: '03:15', '02:00')
-- ============================================================

ALTER TABLE public.observaciones
ADD COLUMN IF NOT EXISTS tiempo_ejecucion_real TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tiempo_ejecucion_demora TEXT DEFAULT NULL;

-- Comentarios explicativos en el catálogo de Supabase / PostgreSQL
COMMENT ON COLUMN public.observaciones.tiempo_ejecucion_real IS 'Tiempo real/neto de ejecución de la observación (formato HH:MM)';
COMMENT ON COLUMN public.observaciones.tiempo_ejecucion_demora IS 'Tiempo total de ejecución considerando demoras o incidentes (formato HH:MM)';

-- Recargar caché de esquema de PostgREST para exponer las columnas de inmediato vía API REST
NOTIFY pgrst, 'reload schema';
