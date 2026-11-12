-- ==============================================================================
-- SCRIPT DE LIMPIEZA: Limpieza de registros de solo comentario en historial
-- Proyecto: Amazonas - COVEPA
-- Fecha: 12 de Noviembre de 2026
-- Objetivo: Eliminar registros de historial donde no hubo cambio real de estado
--           (estado_anterior = estado_nuevo o edición de comentario COVEPA)
--           para que no afecten los promedios ni métricas de tiempo de revisión.
-- ==============================================================================

BEGIN;

-- 1. Contar registros a eliminar para verificación previa
SELECT count(*) AS total_registros_solo_comentario
FROM public.historial_estados_observaciones
WHERE (estado_anterior IS NOT NULL AND estado_nuevo IS NOT NULL 
       AND LOWER(REPLACE(REPLACE(estado_anterior, 'ó', 'o'), 'í', 'i')) = LOWER(REPLACE(REPLACE(estado_nuevo, 'ó', 'o'), 'í', 'i')))
   OR comentario ILIKE '%Edici%n de Comentario%'
   OR comentario ILIKE '%Comentario COVEPA eliminado%';

-- 2. Eliminar registros redundantes de solo comentario
DELETE FROM public.historial_estados_observaciones
WHERE (estado_anterior IS NOT NULL AND estado_nuevo IS NOT NULL 
       AND LOWER(REPLACE(REPLACE(estado_anterior, 'ó', 'o'), 'í', 'i')) = LOWER(REPLACE(REPLACE(estado_nuevo, 'ó', 'o'), 'í', 'i')))
   OR comentario ILIKE '%Edici%n de Comentario%'
   OR comentario ILIKE '%Comentario COVEPA eliminado%';

-- 3. Confirmación de cambios
COMMIT;
