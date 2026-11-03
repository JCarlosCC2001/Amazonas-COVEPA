-- =========================================================================================
-- 🚀 MIGRACIÓN: REGULARIZACIÓN DE NOMBRES EN HISTORIAL DE ESTADOS DE OBSERVACIONES
-- =========================================================================================
-- Archivo: sql/migraciones/20261103_regularizar_nombres_historial.sql
--
-- PROPÓSITO:
-- Reemplaza los correos electrónicos crudos almacenados en la columna `usuario_nombre`
-- por el Nombre Completo oficial del colaborador dueño de la cuenta, y asegura su
-- correo en `usuario_email`.
-- =========================================================================================

-- 1. Actualizar registros antiguos de jcarloscc1101@gmail.com a Jhoan Carlos Condor Callupe
UPDATE public.historial_estados_observaciones
SET 
  usuario_nombre = 'Jhoan Carlos Condor Callupe',
  usuario_email = COALESCE(usuario_email, 'jcarloscc1101@gmail.com')
WHERE usuario_nombre = 'jcarloscc1101@gmail.com';

-- 2. Actualizar registros antiguos de fduran@covepa.pe a Flor Duran
UPDATE public.historial_estados_observaciones
SET 
  usuario_nombre = 'Flor Duran',
  usuario_email = COALESCE(usuario_email, 'fduran@covepa.pe')
WHERE usuario_nombre = 'fduran@covepa.pe';

-- Verificación de resultados (debe devolver 0 registros con correos en usuario_nombre)
SELECT COUNT(*) AS registros_con_correo_restantes
FROM public.historial_estados_observaciones
WHERE usuario_nombre LIKE '%@%';
