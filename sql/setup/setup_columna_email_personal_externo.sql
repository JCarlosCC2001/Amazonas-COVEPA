-- ============================================================
-- AGREGAR COLUMNA EMAIL_2 A LA TABLA PERSONAL (BD EXTERNA SELNET)
-- Proyecto: Amazonas - COVEPA / SELNET
-- Ejecutar en el SQL Editor de la Base de Datos Externa (iiwmqvnjjhaapyolaity)
-- ============================================================

-- 1. Agregar la columna email_2 si no existe (la columna email ya existe)
ALTER TABLE public.personal
ADD COLUMN IF NOT EXISTS email_2 TEXT DEFAULT NULL;

-- 2. Índice opcional para búsquedas rápidas por el segundo correo
CREATE INDEX IF NOT EXISTS idx_personal_email_2 
ON public.personal (lower(email_2));

-- 3. Documentación de los campos de correo
COMMENT ON COLUMN public.personal.email IS 'Primer correo electrónico (institucional o principal).';
COMMENT ON COLUMN public.personal.email_2 IS 'Segundo correo electrónico (personal o alternativo).';
