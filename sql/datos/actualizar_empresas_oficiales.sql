-- ==============================================================================
-- ESTANDARIZACIÓN DE EMPRESAS OFICIALES EN TABLA PERSONAL
-- Proyecto: Amazonas-COVEPA / SELNET
-- Destino: Base de Datos EXTERNA (Amazonas-SELNET — iiwmqvnjjhaapyolaity)
-- Tabla: public.personal
-- Empresas Oficiales Permitidas:
--   1. SELNET S.A.C.
--   2. COVEPA S.A.C.
--   3. Gilat Networks
-- ==============================================================================

-- 1. Normalizar SELNET a 'SELNET S.A.C.'
UPDATE public.personal
SET empresa = 'SELNET S.A.C.'
WHERE empresa = 'SELNET' OR empresa ILIKE 'SELNET%';

-- 2. Normalizar COVEPA a 'COVEPA S.A.C.'
UPDATE public.personal
SET empresa = 'COVEPA S.A.C.'
WHERE empresa = 'COVEPA' OR empresa ILIKE 'COVEPA%';

-- 3. Normalizar GILAT a 'Gilat Networks'
UPDATE public.personal
SET empresa = 'Gilat Networks'
WHERE empresa ILIKE '%GILAT%';

-- Verificación de empresas únicas en la tabla
SELECT empresa, COUNT(*) AS total_personal
FROM public.personal
GROUP BY empresa
ORDER BY empresa;
