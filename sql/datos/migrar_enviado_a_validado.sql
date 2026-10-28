-- ============================================================================
-- MIGRACIÓN DE ESTADOS COVEPA: 'Enviado' -> 'Validado'
-- Fecha: 27 de Octubre de 2026
-- Descripción:
--   Unificación del estado 'Enviado' hacia 'Validado' y apertura del nuevo
--   flujo de estados:
--     1. Pendiente
--     2. Solicitando Revisión
--     3. En Revisión
--     4. Validado
--     5. Rechazado
--     6. Descartado
-- ============================================================================

UPDATE observaciones
SET estado_covepa = 'Validado'
WHERE estado_covepa = 'Enviado';
