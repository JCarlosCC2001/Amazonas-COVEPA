-- ============================================================
-- SCRIPT OFICIAL: HABILITACIÓN DE FLOR DURAN (ASISTENTE DE CALIDAD)
-- Y CORRECCIÓN INTEGRAL DEL MOTOR DE AUTENTICACIÓN SUPABASE (GOTRUE)
-- Archivo: sql/migraciones/20261102_habilitar_flor_duran_asistente.sql
-- Ejecutar en: Supabase Dashboard > SQL Editor > Run
-- ============================================================

-- 1. Asegurar extensión pgcrypto en el esquema extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Limpiar registros con identidades corruptas que provocan el error 500
DELETE FROM auth.identities 
WHERE user_id IN (SELECT id FROM auth.users WHERE LOWER(email) IN ('fduran@covepa.pe', 'test@covepa.pe'))
   OR LOWER(provider_id) IN ('fduran@covepa.pe', 'test@covepa.pe')
   OR provider_id IN (SELECT id::text FROM auth.users WHERE LOWER(email) IN ('fduran@covepa.pe', 'test@covepa.pe'));

DELETE FROM auth.users 
WHERE LOWER(email) IN ('fduran@covepa.pe', 'test@covepa.pe');

DELETE FROM public.perfiles_usuario 
WHERE LOWER(email) = 'test@covepa.pe';

-- 3. Sanear cualquier fila en auth.users con columnas NULL en tokens
-- (GoTrue crashea con 'converting NULL to string is unsupported' si estas columnas son NULL)
UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  recovery_token = COALESCE(recovery_token, '')
WHERE 
  confirmation_token IS NULL 
  OR email_change IS NULL 
  OR email_change_token_new IS NULL 
  OR recovery_token IS NULL;

-- 4. Crear a Flor Duran con su contraseña oficial 'Flor2026' y rol 'asistente_calidad'
DO $$ 
DECLARE
    v_user_id UUID := gen_random_uuid(); 
    v_email TEXT := 'fduran@covepa.pe';
    v_encrypted_pw TEXT := extensions.crypt('Flor2026', extensions.gen_salt('bf'));
    v_id_personal UUID := '4f6fb2db-18db-4dbf-8794-e0db9c8ac132';
BEGIN
    -- 4.1. Inserción compatible con GoTrue en auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change_token_new,
        recovery_token,
        email_change
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        v_email,
        v_encrypted_pw,
        NOW(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object('id_personal', v_id_personal, 'rol', 'asistente_calidad'),
        NOW(),
        NOW(),
        '',
        '',
        '',
        ''
    );

    -- 4.2. Inserción compatible con GoTrue en auth.identities
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
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email',
        v_user_id::text,
        NOW(),
        NOW(),
        NOW()
    );

    -- 4.3. Vincular en public.perfiles_usuario
    DELETE FROM public.perfiles_usuario WHERE LOWER(email) = v_email;

    INSERT INTO public.perfiles_usuario (id, email, rol, id_personal, activo, updated_at)
    VALUES (v_user_id, v_email, 'asistente_calidad', v_id_personal, true, NOW());

END $$;

-- 5. Actualizar la función administrativa para creación y actualización de contraseñas desde la web
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

        IF COALESCE(v_caller_role, '') != 'admin' THEN
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
        -- El usuario ya existe en auth.users: Actualizar contraseña y sanear tokens
        IF v_encrypted_pw IS NOT NULL THEN
            UPDATE auth.users
            SET encrypted_password = v_encrypted_pw,
                email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
                confirmation_token = COALESCE(confirmation_token, ''),
                email_change = COALESCE(email_change, ''),
                email_change_token_new = COALESCE(email_change_token_new, ''),
                recovery_token = COALESCE(recovery_token, ''),
                updated_at = NOW()
            WHERE id = v_user_id;
        ELSE
            UPDATE auth.users
            SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
                confirmation_token = COALESCE(confirmation_token, ''),
                email_change = COALESCE(email_change, ''),
                email_change_token_new = COALESCE(email_change_token_new, ''),
                recovery_token = COALESCE(recovery_token, ''),
                updated_at = NOW()
            WHERE id = v_user_id;
        END IF;

        -- Asegurar que la identidad en auth.identities exista con formato GoTrue
        IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_user_id AND provider = 'email') THEN
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
                gen_random_uuid(),
                v_user_id,
                jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email),
                'email',
                v_user_id::text,
                NOW(),
                NOW(),
                NOW()
            );
        END IF;
    ELSE
        -- El usuario no existe en auth.users: Debe crearse con contraseña obligatoria
        IF v_encrypted_pw IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Para habilitar una cuenta nueva se requiere asignar una contraseña inicial (mínimo 6 caracteres).');
        END IF;

        v_user_id := gen_random_uuid();

        INSERT INTO auth.users (
            id,
            instance_id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change_token_new,
            recovery_token,
            email_change
        ) VALUES (
            v_user_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated',
            'authenticated',
            v_clean_email,
            v_encrypted_pw,
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('id_personal', p_id_personal, 'rol', p_rol),
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );

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
            gen_random_uuid(),
            v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email),
            'email',
            v_user_id::text,
            NOW(),
            NOW(),
            NOW()
        );
    END IF;

    -- Vincular o actualizar en public.perfiles_usuario
    DELETE FROM public.perfiles_usuario WHERE LOWER(email) = v_clean_email AND id != v_user_id;

    INSERT INTO public.perfiles_usuario (id, email, rol, id_personal, activo, updated_at)
    VALUES (v_user_id, v_clean_email, p_rol, p_id_personal, p_activo, NOW())
    ON CONFLICT (id) DO UPDATE SET
        email = v_clean_email,
        rol = p_rol,
        id_personal = COALESCE(p_id_personal, public.perfiles_usuario.id_personal),
        activo = p_activo,
        updated_at = NOW();

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

GRANT EXECUTE ON FUNCTION public.admin_set_user_account TO authenticated;

-- 6. Recargar caché del esquema en Supabase
NOTIFY pgrst, 'reload schema';
