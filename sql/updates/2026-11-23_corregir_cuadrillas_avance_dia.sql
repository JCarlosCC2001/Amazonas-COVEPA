-- Sincronización y corrección de cuadrilla_ejecutora y tecnico_ejecutor para las observaciones del 23-11-2026
-- Regla de Negocio: Cada código debe asignarse automáticamente a quien solicita la validación y a su cuadrilla oficial.

-- 1. CUADRILLA 2: Juan Castro y Willy Fernández (Sitios AM-0253-A01 y AM-0192-A01)
UPDATE public.observaciones
SET cuadrilla_ejecutora = 'CUADRILLA 2', tecnico_ejecutor = 'Juan Castro'
WHERE id_sitio = 'AM-0253-A01'
  AND id_obs IN ('C-4018', 'C-4019', 'C-4020', 'C-4022', 'C-4038', 'C-4054', 'C-4060', 'C-4061', 'H1-OC-100-1835', 'C-4073', 'C-4072');

UPDATE public.observaciones
SET cuadrilla_ejecutora = 'CUADRILLA 2', tecnico_ejecutor = 'Willy Fernández'
WHERE id_sitio = 'AM-0253-A01'
  AND id_obs IN ('C-4067', 'H1-OC-100-1863');

UPDATE public.observaciones
SET cuadrilla_ejecutora = 'CUADRILLA 2', tecnico_ejecutor = 'Juan Castro'
WHERE id_sitio = 'AM-0192-A01'
  AND id_obs IN ('C-2314', 'C-2347');

-- 2. CUADRILLA 1: Jhonatan Flores y Marco Chamba (Sitio AM-0234-A01 y AM-0043-A01)
UPDATE public.observaciones
SET cuadrilla_ejecutora = 'CUADRILLA 1', tecnico_ejecutor = 'Jhonatan Flores'
WHERE id_sitio = 'AM-0234-A01'
  AND id_obs IN ('C-3257', 'C-3260', 'C-3261', 'C-3262', 'C-3278', 'C-3303', 'C-3306', 'C-3320', 'C-3323', 'H1-OC-100-1400', 'H1-OC-100-1405');

UPDATE public.observaciones
SET cuadrilla_ejecutora = 'CUADRILLA 1', tecnico_ejecutor = 'Marco Chamba'
WHERE id_sitio = 'AM-0234-A01'
  AND id_obs IN ('H1-OC-100-1401', 'H1-OC-100-1402', 'H1-OC-100-1403', 'H1-OC-100-1410', 'H1-OC-100-1412');

UPDATE public.observaciones
SET cuadrilla_ejecutora = 'CUADRILLA 1', tecnico_ejecutor = 'Jhonatan Flores'
WHERE id_sitio = 'AM-0043-A01'
  AND id_obs IN ('A-641', 'A-650', 'A-656', 'A-657', 'H1-OC-100-315');

-- 3. CUADRILLA 3: Alfonso Curi y William Avila (Sitio AM-0185-A01)
UPDATE public.observaciones
SET cuadrilla_ejecutora = 'CUADRILLA 3', tecnico_ejecutor = 'Alfonso Curi'
WHERE id_sitio = 'AM-0185-A01'
  AND id_obs IN ('C-1873', 'C-1875', 'C-1877', 'C-1898', 'C-1915', 'C-1931', 'C-1934');

UPDATE public.observaciones
SET cuadrilla_ejecutora = 'CUADRILLA 3', tecnico_ejecutor = 'William Avila'
WHERE id_sitio = 'AM-0185-A01'
  AND id_obs IN ('C-1927', 'C-1932', 'H1-OC-50-1931');

-- 4. CUADRILLA 4: Daniel Javier y Hugo Espinoza (Sitio AMEX-0341-A01 y AMEX-0332-A01)
UPDATE public.observaciones
SET cuadrilla_ejecutora = 'CUADRILLA 4', tecnico_ejecutor = 'Daniel Javier'
WHERE id_sitio = 'AMEX-0341-A01'
  AND id_obs IN ('AMEX-H3-100-810', 'AM-H1-OC-100-766', 'AM-H1-OC-100-786', 'AM-H1-OC-100-752', 'AM-H1-OC-100-751', 'AMEX-H3-100-825', 'AM-H1-OC-100-745', 'AMEX-H3-100-824', 'AM-H1-SH-100-12', 'AM-H1-OC-100-750', 'AM-H1-SP-100-11', 'AM-H1-OC-100-777');

UPDATE public.observaciones
SET cuadrilla_ejecutora = 'CUADRILLA 4', tecnico_ejecutor = 'Hugo Espinoza'
WHERE id_sitio = 'AMEX-0341-A01'
  AND id_obs IN ('AM-H1-OC-100-757');
