-- ============================================================
-- AGREGAR COLUMNA EMAIL A LA TABLA PERSONAL (BD EXTERNA SELNET)
-- Proyecto: Amazonas - COVEPA / SELNET
-- Ejecutar en el SQL Editor de la Base de Datos Externa (iiwmqvnjjhaapyolaity)
-- ============================================================

-- 1. Agregar columna email si no existe
ALTER TABLE public.personal
ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL;

-- 2. Índice opcional para búsquedas rápidas por correo
CREATE INDEX IF NOT EXISTS idx_personal_email 
ON public.personal (lower(email));

-- 3. Comentario de documentación
COMMENT ON COLUMN public.personal.email IS 'Dirección de correo electrónico institucional o de contacto del integrante del equipo.';
