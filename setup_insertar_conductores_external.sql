-- ==============================================================================
-- SCRIPT SQL: REGISTRO DE CONDUCTORES EN BASE DE DATOS EXTERNA (Amazonas-SELNET)
-- ==============================================================================
-- Este script inserta oficialmente a los 6 conductores del proyecto COVEPA
-- en la tabla `public.personal` de la base de datos externa (iiwmqvnjjhaapyolaity).
--
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase Externo (SELNET).
-- ==============================================================================

INSERT INTO public.personal (nombre, apellido, cargo, empresa, contacto_1, estado)
SELECT 'Carlos', 'Perez', 'Conductor', 'COVEPA', NULL, 'Activo'
WHERE NOT EXISTS (
    SELECT 1 FROM public.personal 
    WHERE UPPER(nombre) LIKE '%CARLOS%' AND UPPER(apellido) LIKE '%PEREZ%'
);

INSERT INTO public.personal (nombre, apellido, cargo, empresa, contacto_1, estado)
SELECT 'Jhordin', 'Perez', 'Conductor', 'COVEPA', '921004913', 'Activo'
WHERE NOT EXISTS (
    SELECT 1 FROM public.personal 
    WHERE UPPER(nombre) LIKE '%JHORDIN%' AND UPPER(apellido) LIKE '%PEREZ%'
);

INSERT INTO public.personal (nombre, apellido, cargo, empresa, contacto_1, estado)
SELECT 'Lino', 'Ticlla', 'Conductor', 'COVEPA', '910493156', 'Activo'
WHERE NOT EXISTS (
    SELECT 1 FROM public.personal 
    WHERE UPPER(nombre) LIKE '%LINO%' AND UPPER(apellido) LIKE '%TICLLA%'
);

INSERT INTO public.personal (nombre, apellido, cargo, empresa, contacto_1, estado)
SELECT 'Nilson', 'Vera', 'Conductor', 'COVEPA', '969936764', 'Activo'
WHERE NOT EXISTS (
    SELECT 1 FROM public.personal 
    WHERE UPPER(nombre) LIKE '%NILSON%' AND UPPER(apellido) LIKE '%VERA%'
);

INSERT INTO public.personal (nombre, apellido, cargo, empresa, contacto_1, estado)
SELECT 'Jhordin', 'Antonio', 'Conductor', 'COVEPA', '999389272', 'Activo'
WHERE NOT EXISTS (
    SELECT 1 FROM public.personal 
    WHERE (UPPER(nombre) LIKE '%JHORDIN%' OR UPPER(nombre) LIKE '%JHORDITH%') 
      AND (UPPER(apellido) LIKE '%ANTONIO%' OR UPPER(apellido) LIKE '%ZULUETA%')
);

INSERT INTO public.personal (nombre, apellido, cargo, empresa, contacto_1, estado)
SELECT 'Ander', 'Peralta', 'Conductor', 'COVEPA', '945551928', 'Activo'
WHERE NOT EXISTS (
    SELECT 1 FROM public.personal 
    WHERE UPPER(nombre) LIKE '%ANDER%' AND UPPER(apellido) LIKE '%PERALTA%'
);

-- ==============================================================================
-- OPCIONAL: Si deseas añadir la columna `cuadrilla` en la base de datos externa:
-- ==============================================================================
-- ALTER TABLE public.personal ADD COLUMN IF NOT EXISTS cuadrilla TEXT;
--
-- UPDATE public.personal SET cuadrilla = 'CUADRILLA 1' WHERE UPPER(nombre) LIKE '%JHONATAN%' AND UPPER(apellido) LIKE '%FLORES%';
-- UPDATE public.personal SET cuadrilla = 'CUADRILLA 1' WHERE UPPER(nombre) LIKE '%CARLOS%' AND UPPER(apellido) LIKE '%PEREZ%';
--
-- UPDATE public.personal SET cuadrilla = 'CUADRILLA 2' WHERE UPPER(nombre) LIKE '%CRISTIAN%' AND UPPER(apellido) LIKE '%ISLA%';
-- UPDATE public.personal SET cuadrilla = 'CUADRILLA 2' WHERE UPPER(nombre) LIKE '%JHORDIN%' AND UPPER(apellido) LIKE '%PEREZ%';
--
-- UPDATE public.personal SET cuadrilla = 'CUADRILLA 3' WHERE UPPER(nombre) LIKE '%DANIEL%' AND UPPER(apellido) LIKE '%JAVIER%';
-- UPDATE public.personal SET cuadrilla = 'CUADRILLA 3' WHERE UPPER(nombre) LIKE '%LINO%' AND UPPER(apellido) LIKE '%TICLLA%';
--
-- UPDATE public.personal SET cuadrilla = 'CUADRILLA 4' WHERE UPPER(nombre) LIKE '%ALFONSO%' AND UPPER(apellido) LIKE '%CURI%';
-- UPDATE public.personal SET cuadrilla = 'CUADRILLA 4' WHERE UPPER(nombre) LIKE '%NILSON%' AND UPPER(apellido) LIKE '%VERA%';
--
-- UPDATE public.personal SET cuadrilla = 'CUADRILLA 5' WHERE UPPER(nombre) LIKE '%WILLIAM%' AND UPPER(apellido) LIKE '%AVILA%';
-- UPDATE public.personal SET cuadrilla = 'CUADRILLA 5' WHERE (UPPER(nombre) LIKE '%JHORDIN%' OR UPPER(nombre) LIKE '%JHORDITH%') AND (UPPER(apellido) LIKE '%ANTONIO%' OR UPPER(apellido) LIKE '%ZULUETA%');
--
-- UPDATE public.personal SET cuadrilla = 'CUADRILLA 6' WHERE UPPER(nombre) LIKE '%GABRIEL%' AND UPPER(apellido) LIKE '%FARRO%';
-- UPDATE public.personal SET cuadrilla = 'CUADRILLA 6' WHERE UPPER(nombre) LIKE '%ANDER%' AND UPPER(apellido) LIKE '%PERALTA%';
-- ==============================================================================
