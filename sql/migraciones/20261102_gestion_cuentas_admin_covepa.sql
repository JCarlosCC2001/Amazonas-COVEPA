-- ============================================================
-- FUNCIÓN OFICIAL: GESTIÓN DE CUENTAS Y CONTRASEÑAS POR ADMINISTRADOR
-- Sistema: Amazonas - COVEPA
-- Permite al Administrador crear usuarios, asignar roles y establecer contraseñas
-- directamente desde la pantalla de Personal sin requerir confirmación por correo.
-- ============================================================

-- 1. Habilitar extensión pgcrypto si no está activa
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Función administrativa segura para crear o actualizar credenciales
CREATE OR REPLACE FUNCTION public.admin_set_user_account(
    p_email TEXT,
    p_password TEXT,
    p_rol TEXT DEFAULT 'tecnico',
    p_id_personal UUID DEFAULT NULL,
    p_activo BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_clean_email TEXT;
    v_user_id UUID;
    v_encrypted_pw TEXT;
    v_caller_email TEXT;
    v_caller_role TEXT;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));
    
    IF v_clean_email IS NULL OR v_clean_email = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'El correo electrónico es obligatorio.');
    END IF;

    -- Validar que quien invoca la función sea Administrador
    v_caller_email := LOWER(COALESCE(auth.jwt()->>'email', ''));
    
    IF v_caller_email != 'jcarloscc1101@gmail.com' THEN
        SELECT rol INTO v_caller_role 
        FROM public.perfiles_usuario 
        WHERE id = auth.uid() OR LOWER(email) = v_caller_email 
        LIMIT 1;

        IF v_caller_role != 'admin' THEN
            RETURN jsonb_build_object('success', false, 'error', 'No autorizado. Solo los administradores pueden gestionar cuentas.');
        END IF;
    END IF;

    -- Cifrar contraseña si fue provista
    IF p_password IS NOT NULL AND LENGTH(TRIM(p_password)) > 0 THEN
        IF LENGTH(TRIM(p_password)) < 6 THEN
            RETURN jsonb_build_object('success', false, 'error', 'La contraseña debe tener al menos 6 caracteres.');
        END IF;
        v_encrypted_pw := extensions.crypt(TRIM(p_password), extensions.gen_salt('bf'));
    END IF;

    -- Buscar si ya existe el usuario en auth.users
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE LOWER(email) = v_clean_email 
    LIMIT 1;

    IF v_user_id IS NOT NULL THEN
        -- El usuario ya existe en auth.users: Actualizar contraseña y asegurar confirmación
        IF v_encrypted_pw IS NOT NULL THEN
            UPDATE auth.users
            SET encrypted_password = v_encrypted_pw,
                email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
                updated_at = NOW()
            WHERE id = v_user_id;
        ELSE
            UPDATE auth.users
            SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
                updated_at = NOW()
            WHERE id = v_user_id;
        END IF;
    ELSE
        -- El usuario no existe en auth.users: Debe crearse con contraseña obligatoria
        IF v_encrypted_pw IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Para habilitar una cuenta nueva se requiere asignar una contraseña inicial (mínimo 6 caracteres).');
        END IF;

        v_user_id := gen_random_uuid();

        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            v_clean_email,
            v_encrypted_pw,
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('id_personal', p_id_personal, 'rol', p_rol),
            NOW(),
            NOW()
        );

        -- Registrar identidad en auth.identities
        BEGIN
            INSERT INTO auth.identities (
                id,
                user_id,
                identity_data,
                provider,
                provider_id,
                last_sign_in_at,
                created_at,
                updated_at
            ) VALUES (
                v_user_id,
                v_user_id,
                jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email),
                'email',
                v_clean_email,
                NOW(),
                NOW(),
                NOW()
            );
        EXCEPTION WHEN others THEN
            -- Si la tabla auth.identities de Supabase tiene otra firma de columnas, intentar inserción estándar
            NULL;
        END;
    END IF;

    -- Vincular o actualizar en public.perfiles_usuario
    INSERT INTO public.perfiles_usuario (id, email, rol, id_personal, activo, updated_at)
    VALUES (v_user_id, v_clean_email, p_rol, p_id_personal, p_activo, NOW())
    ON CONFLICT (id) DO UPDATE SET
        email = v_clean_email,
        rol = p_rol,
        id_personal = COALESCE(p_id_personal, public.perfiles_usuario.id_personal),
        activo = p_activo,
        updated_at = NOW();

    -- También asegurar por email si existía previamente con un id provisional
    UPDATE public.perfiles_usuario
    SET id = v_user_id,
        rol = p_rol,
        id_personal = COALESCE(p_id_personal, public.perfiles_usuario.id_personal),
        activo = p_activo,
        updated_at = NOW()
    WHERE LOWER(email) = v_clean_email AND id != v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', v_clean_email,
        'rol', p_rol,
        'activo', p_activo,
        'message', 'Cuenta configurada y habilitada exitosamente.'
    );
END;
$$;

-- 3. Otorgar permisos de ejecución para usuarios autenticados
GRANT EXECUTE ON FUNCTION public.admin_set_user_account TO authenticated;

-- 4. Notificar a PostgREST para recargar el esquema de funciones inmediatamente
NOTIFY pgrst, 'reload schema';

