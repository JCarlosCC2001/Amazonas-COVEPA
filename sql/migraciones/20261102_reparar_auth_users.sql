-- ============================================================
-- SCRIPT DE REPARACIÓN DE AUTENTICACIÓN (SUPABASE AUTH)
-- Archivo: sql/migraciones/20261102_reparar_auth_users.sql
-- ============================================================

-- 1. Limpiar el usuario con identidad manual incompleta que generó el error 500
DELETE FROM auth.identities 
WHERE user_id IN (SELECT id FROM auth.users WHERE LOWER(email) = 'fduran@covepa.pe')
   OR LOWER(provider_id) = 'fduran@covepa.pe';

DELETE FROM auth.users 
WHERE LOWER(email) = 'fduran@covepa.pe';

-- 2. Remover la función con inserción manual directa para no desincronizar GoTrue
DROP FUNCTION IF EXISTS public.admin_set_user_account(TEXT, TEXT, TEXT, UUID, BOOLEAN);

-- 3. Asegurar que perfiles_usuario mantenga el rol 'asistente_calidad' para fduran@covepa.pe
UPDATE public.perfiles_usuario 
SET rol = 'asistente_calidad', activo = true, updated_at = NOW()
WHERE LOWER(email) = 'fduran@covepa.pe';

NOTIFY pgrst, 'reload schema';
