-- ============================================================================
-- MIGRACIÓN / ACTUALIZACIÓN: ASIGNACIÓN DE CUADRILLA A OBSERVACIONES DESCARTADAS
-- Fecha: 23 de Noviembre de 2026
-- Objetivo:
-- 1. Asignar como cuadrilla ejecutora la cuadrilla oficial del sitio para todas
--    las observaciones en estado 'Descartado'.
-- 2. Asegurar que las observaciones 'Descartado' NUNCA tengan técnico asignado (NULL).
-- 3. Preservar intacta la columna fecha_subsanacion original.
-- ============================================================================

-- Paso 1: Limpiar cualquier técnico ejecutor en estado Descartado
UPDATE public.observaciones
SET tecnico_ejecutor = NULL
WHERE estado_covepa = 'Descartado';

-- Paso 2: Asignar Cuadrilla 4 a los sitios de Ampliación (AMEX)
UPDATE public.observaciones
SET cuadrilla_ejecutora = 'CUADRILLA 4'
WHERE estado_covepa = 'Descartado'
  AND (id_sitio ILIKE 'AMEX%' OR id_obs ILIKE 'AMEX%');

-- Paso 3: Asignar Cuadrilla según catálogo de sitios_cuadrillas
UPDATE public.observaciones o
SET cuadrilla_ejecutora = sc.cuadrilla
FROM public.sitios_cuadrillas sc
WHERE o.estado_covepa = 'Descartado'
  AND sc.id_site = o.id_sitio
  AND sc.cuadrilla IS NOT NULL;

-- Notificar a PostgREST
NOTIFY pgrst, 'reload schema';
