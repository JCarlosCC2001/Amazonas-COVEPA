-- ============================================================
-- MIGRACIÓN: AÑADIR DESTINATARIO_PRUEBA A CONFIGURACION_REPORTES_CORREO
-- Proyecto: Amazonas - COVEPA
-- Permite almacenar en Supabase el correo destinatario configurado
-- para el envío de pruebas manuales aisladas (sin contabilizar en el reporte del día).
-- ============================================================

ALTER TABLE public.configuracion_reportes_correo
ADD COLUMN IF NOT EXISTS destinatario_prueba TEXT DEFAULT '';

-- Notificar a PostgREST para recargar el esquema de tablas (elimina error de schema cache)
NOTIFY pgrst, 'reload schema';

