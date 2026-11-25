-- ==============================================================================
-- Migración: Eliminar columna cuadrilla_ejecutora de la tabla observaciones
-- Fecha: 25 de noviembre de 2026
-- Contexto: La cuadrilla se gestiona y resuelve de forma oficial y consistente
--           a nivel de sitio mediante la tabla 'sitios_asignados' (y base_sitios_asignados.json).
--           Mantener una columna redundante en 'observaciones' genera desincronización.
-- ==============================================================================

-- 1. Eliminar la columna cuadrilla_ejecutora de la tabla observaciones si existe
ALTER TABLE public.observaciones
DROP COLUMN IF EXISTS cuadrilla_ejecutora;

-- 2. Confirmación
COMMENT ON TABLE public.observaciones IS 'Tabla principal de observaciones COVEPA. Cuadrilla oficial resuelta por sitio.';
