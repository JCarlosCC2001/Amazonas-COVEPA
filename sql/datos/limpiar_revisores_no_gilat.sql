-- ============================================================================
-- SCRIPT: Limpiar revisores no autorizados en tabla observaciones
-- PROYECTO: Amazonas-COVEPA
-- DESCRIPCIÓN:
--   Establece a NULL el campo 'revisor' de aquellas observaciones donde
--   accidentalmente se había registrado a un técnico o al usuario en sesión,
--   asegurando que el campo 'revisor' pertenezca estrictamente a GILAT
--   ('Amilcar Hander', 'Thalia Urquizo', 'Gilat Networks').
-- ============================================================================

-- 1. Verificación previa de observaciones con revisor no perteneciente a GILAT
SELECT id_obs, id_sitio, estado_covepa, revisor
FROM public.observaciones
WHERE revisor IS NOT NULL
  AND UPPER(revisor) NOT LIKE '%GILAT%'
  AND revisor NOT IN ('Amilcar Hander', 'Thalia Urquizo');

-- 2. Limpieza de celdas: resetear a NULL para que queden pendientes de asignación oficial GILAT
UPDATE public.observaciones
SET revisor = NULL
WHERE revisor IS NOT NULL
  AND UPPER(revisor) NOT LIKE '%GILAT%'
  AND revisor NOT IN ('Amilcar Hander', 'Thalia Urquizo');

-- 3. Confirmación: verificar que solo queden revisores oficiales de GILAT
SELECT revisor, COUNT(*) as total_observaciones
FROM public.observaciones
WHERE revisor IS NOT NULL
GROUP BY revisor
ORDER BY total_observaciones DESC;

