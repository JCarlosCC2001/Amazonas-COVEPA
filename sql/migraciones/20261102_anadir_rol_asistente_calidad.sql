-- ============================================================
-- SCRIPT DE REFERENCIA: ROL 'asistente_calidad' (Asistente de Calidad)
-- Sistema: COVEPA Amazonas
-- Fecha: 02 de Noviembre de 2026
-- ============================================================

-- La columna 'rol' en la tabla public.perfiles_usuario está definida como VARCHAR(50),
-- por lo cual admite nativamente el rol 'asistente_calidad' sin alterar el esquema.
--
-- Para asignar este rol a un usuario por correo:
-- UPDATE public.perfiles_usuario 
-- SET rol = 'asistente_calidad', updated_at = NOW()
-- WHERE LOWER(email) = LOWER('correo_del_asistente@covepa.com');

NOTIFY pgrst, 'reload schema';

