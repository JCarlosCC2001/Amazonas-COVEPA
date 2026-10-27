-- ============================================================
-- SCRIPT: ELIMINACIÓN DE TABLA PERSONAL LOCAL
-- Sistema: Amazonas-COVEPA
-- Ejecutar en el SQL Editor de Supabase del proyecto local (COVEPA)
-- ============================================================

-- 1. Eliminar restricciones de clave foránea a public.personal local
-- Esto permite que 'id_tecnico' e 'id_personal' almacenen directamente
-- los UUIDs (id_personal) de la tabla externa sin bloqueos relacionales.
DO $$
BEGIN
    ALTER TABLE public.programaciones 
    DROP CONSTRAINT IF EXISTS programaciones_id_tecnico_fkey;
    
    ALTER TABLE public.programacion_personal 
    DROP CONSTRAINT IF EXISTS programacion_personal_id_personal_fkey;
    
    ALTER TABLE public.perfiles_usuario 
    DROP CONSTRAINT IF EXISTS perfiles_usuario_id_personal_fkey;
EXCEPTION WHEN others THEN null;
END $$;

-- 2. Eliminar la tabla interna / local de personal
DROP TABLE IF EXISTS public.personal CASCADE;

-- 3. Asegurar que las columnas id_tecnico e id_personal admitan texto/uuid sin restricciones
-- (Ya están configuradas como UUID en PostgreSQL)
