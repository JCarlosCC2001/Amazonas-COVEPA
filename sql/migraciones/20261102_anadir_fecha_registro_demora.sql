-- =========================================================================================
-- MIGRACIÓN DDL: Incorporación de columna opcional para fecha de registro de demora
-- Fecha: 02 de Noviembre de 2026
-- Proyecto: Amazonas-COVEPA
-- Tabla: public.observaciones
-- =========================================================================================

-- 1. Añadir columna opcional para registrar la fecha y hora ISO en que se ingresó la demora
ALTER TABLE public.observaciones
ADD COLUMN IF NOT EXISTS fecha_registro_demora TEXT DEFAULT NULL;

-- 2. Recargar el caché del esquema de Supabase PostgREST
NOTIFY pgrst, 'reload schema';

