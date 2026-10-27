-- ============================================================
-- CONFIGURACIÓN DE ROLES Y PERFILES DE USUARIO
-- Sistema: COVEPA Amazonas
-- ============================================================

-- 1. Asegurar tabla public.perfiles_usuario
CREATE TABLE IF NOT EXISTS public.perfiles_usuario (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL UNIQUE,
    rol VARCHAR(50) DEFAULT 'tecnico' NOT NULL, -- 'admin', 'coordinador', 'supervisor', 'tecnico'
    id_personal UUID REFERENCES public.personal(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_perfiles_usuario_email ON public.perfiles_usuario(email);
CREATE INDEX IF NOT EXISTS idx_perfiles_usuario_rol ON public.perfiles_usuario(rol);
CREATE INDEX IF NOT EXISTS idx_perfiles_usuario_id_personal ON public.perfiles_usuario(id_personal);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.perfiles_usuario ENABLE ROW LEVEL SECURITY;

-- Política 1: Cualquier usuario autenticado puede leer su propio perfil
DO $$ BEGIN
    DROP POLICY IF EXISTS "Los usuarios pueden ver su propio perfil" ON public.perfiles_usuario;
    CREATE POLICY "Los usuarios pueden ver su propio perfil"
        ON public.perfiles_usuario FOR SELECT
        TO authenticated
        USING (auth.uid() = id);
EXCEPTION WHEN others THEN null;
END $$;

-- Política 2: Los administradores pueden ver todos los perfiles
DO $$ BEGIN
    DROP POLICY IF EXISTS "Los administradores pueden ver todos los perfiles" ON public.perfiles_usuario;
    CREATE POLICY "Los administradores pueden ver todos los perfiles"
        ON public.perfiles_usuario FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.perfiles_usuario 
                WHERE id = auth.uid() AND rol = 'admin'
            )
            OR auth.jwt()->>'email' = 'jcarloscc1101@gmail.com'
        );
EXCEPTION WHEN others THEN null;
END $$;

-- Política 3: Permitir lectura pública para anon durante el flujo de inicio si es requerido
DO $$ BEGIN
    DROP POLICY IF EXISTS "Lectura anon básica de perfiles" ON public.perfiles_usuario;
    CREATE POLICY "Lectura anon básica de perfiles"
        ON public.perfiles_usuario FOR SELECT
        TO anon
        USING (true);
EXCEPTION WHEN others THEN null;
END $$;

-- Política 4: Permitir inserción/upsert del propio perfil al autenticarse
DO $$ BEGIN
    DROP POLICY IF EXISTS "Permitir upsert propio al autenticarse" ON public.perfiles_usuario;
    CREATE POLICY "Permitir upsert propio al autenticarse"
        ON public.perfiles_usuario FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = id);
EXCEPTION WHEN others THEN null;
END $$;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Permitir update de su propio perfil" ON public.perfiles_usuario;
    CREATE POLICY "Permitir update de su propio perfil"
        ON public.perfiles_usuario FOR UPDATE
        TO authenticated
        USING (auth.uid() = id);
EXCEPTION WHEN others THEN null;
END $$;

-- 3. Asignar rol de Administrador a jcarloscc1101@gmail.com si ya existe en auth.users
DO $$
DECLARE
    admin_uid UUID;
BEGIN
    SELECT id INTO admin_uid FROM auth.users WHERE LOWER(email) = 'jcarloscc1101@gmail.com' LIMIT 1;
    
    IF admin_uid IS NOT NULL THEN
        INSERT INTO public.perfiles_usuario (id, email, rol, activo)
        VALUES (admin_uid, 'jcarloscc1101@gmail.com', 'admin', true)
        ON CONFLICT (id) DO UPDATE SET 
            rol = 'admin',
            email = 'jcarloscc1101@gmail.com',
            activo = true,
            updated_at = NOW();
        RAISE NOTICE 'Usuario jcarloscc1101@gmail.com configurado como ADMIN exitosamente.';
    ELSE
        RAISE NOTICE 'Usuario jcarloscc1101@gmail.com aun no se ha registrado en auth.users.';
    END IF;
END $$;

-- 4. Función y Trigger automático al crearse usuarios en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
DECLARE
    user_rol VARCHAR(50);
    matched_personal_id UUID;
BEGIN
    -- Si es el correo maestro del administrador, asignar 'admin'
    IF LOWER(NEW.email) = 'jcarloscc1101@gmail.com' THEN
        user_rol := 'admin';
    ELSE
        user_rol := 'tecnico';
    END IF;

    -- Verificar si existe en la tabla personal para vincularlo automáticamente
    SELECT id INTO matched_personal_id 
    FROM public.personal 
    WHERE LOWER(email) = LOWER(NEW.email) 
    LIMIT 1;

    -- Insertar en perfiles_usuario
    INSERT INTO public.perfiles_usuario (id, email, rol, id_personal, activo)
    VALUES (NEW.id, LOWER(NEW.email), user_rol, matched_personal_id, true)
    ON CONFLICT (id) DO UPDATE SET
        email = LOWER(NEW.email),
        id_personal = COALESCE(matched_personal_id, public.perfiles_usuario.id_personal),
        updated_at = NOW();

    -- Si se encontró en personal, también actualizar user_id en la tabla personal
    IF matched_personal_id IS NOT NULL THEN
        UPDATE public.personal 
        SET user_id = NEW.id, updated_at = NOW()
        WHERE id = matched_personal_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Registrar el trigger sobre auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
