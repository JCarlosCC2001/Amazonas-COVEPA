-- ============================================================
-- ACTUALIZACIÓN DE PERFILES DE USUARIO PARA BD EXTERNA
-- Sistema: Amazonas-COVEPA
-- Permite vincular id_personal de la tabla externa a perfiles_usuario
-- ============================================================

-- 1. Eliminar la restricción de clave foránea a public.personal local si existe,
-- para permitir almacenar directamente el id_personal de la base de datos externa (Amazonas-SELNET)
DO $$
BEGIN
    ALTER TABLE public.perfiles_usuario 
    DROP CONSTRAINT IF EXISTS perfiles_usuario_id_personal_fkey;
    
    ALTER TABLE public.perfiles_usuario 
    DROP CONSTRAINT IF EXISTS perfiles_usuario_id_fkey;
EXCEPTION WHEN others THEN null;
END $$;

-- 2. Asegurar que la columna id tenga valor por defecto si se crea antes de auth.users
ALTER TABLE public.perfiles_usuario 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Asegurar índice para id_personal
CREATE INDEX IF NOT EXISTS idx_perfiles_usuario_id_personal ON public.perfiles_usuario(id_personal);
CREATE INDEX IF NOT EXISTS idx_perfiles_usuario_email ON public.perfiles_usuario(email);
CREATE INDEX IF NOT EXISTS idx_perfiles_usuario_rol ON public.perfiles_usuario(rol);

-- 4. Habilitar RLS
ALTER TABLE public.perfiles_usuario ENABLE ROW LEVEL SECURITY;

-- Política 1: Lectura para usuarios autenticados
DO $$ BEGIN
    DROP POLICY IF EXISTS "Lectura de perfiles para autenticados" ON public.perfiles_usuario;
    CREATE POLICY "Lectura de perfiles para autenticados"
        ON public.perfiles_usuario FOR SELECT
        TO authenticated
        USING (true);
EXCEPTION WHEN others THEN null;
END $$;

-- Política 2: Lectura básica anon (necesario para verificar sesión en login)
DO $$ BEGIN
    DROP POLICY IF EXISTS "Lectura anon básica de perfiles" ON public.perfiles_usuario;
    CREATE POLICY "Lectura anon básica de perfiles"
        ON public.perfiles_usuario FOR SELECT
        TO anon
        USING (true);
EXCEPTION WHEN others THEN null;
END $$;

-- Política 3: Gestión total para Administradores y cuenta maestra
DO $$ BEGIN
    DROP POLICY IF EXISTS "Los administradores pueden gestionar perfiles" ON public.perfiles_usuario;
    CREATE POLICY "Los administradores pueden gestionar perfiles"
        ON public.perfiles_usuario FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.perfiles_usuario 
                WHERE id = auth.uid() AND rol = 'admin'
            )
            OR auth.jwt()->>'email' = 'jcarloscc1101@gmail.com'
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.perfiles_usuario 
                WHERE id = auth.uid() AND rol = 'admin'
            )
            OR auth.jwt()->>'email' = 'jcarloscc1101@gmail.com'
        );
EXCEPTION WHEN others THEN null;
END $$;

-- 5. Vincular cuenta de Administrador de Carlos Cóndor si existe en auth.users
DO $$
DECLARE
    admin_uid UUID;
BEGIN
    SELECT id INTO admin_uid FROM auth.users WHERE LOWER(email) = 'jcarloscc1101@gmail.com' LIMIT 1;
    
    IF admin_uid IS NOT NULL THEN
        INSERT INTO public.perfiles_usuario (id, email, rol, id_personal, activo)
        VALUES (admin_uid, 'jcarloscc1101@gmail.com', 'admin', '8359c281-33ce-423e-9823-0e9e09663889', true)
        ON CONFLICT (email) DO UPDATE SET 
            rol = 'admin',
            id_personal = '8359c281-33ce-423e-9823-0e9e09663889',
            activo = true,
            updated_at = NOW();
        RAISE NOTICE 'Perfil admin vinculado exitosamente a Carlos Cóndor.';
    END IF;
END $$;
