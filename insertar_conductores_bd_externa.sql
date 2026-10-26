-- ==============================================================================
-- SCRIPT SQL: REGISTRO DE LOS 6 CONDUCTORES EN LA BASE DE DATOS EXTERNA (SELNET)
-- Proyecto: Amazonas-SELNET (iiwmqvnjjhaapyolaity.supabase.co)
-- Tabla destino: public.personal
-- ==============================================================================
-- INSTRUCCIONES:
-- 1. Abre tu panel de Supabase de la base de datos EXTERNA (SELNET: iiwmqvnjjhaapyolaity).
-- 2. Ve a la barra lateral izquierda -> "SQL Editor" -> "New query".
-- 3. Pega este código y presiona "Run" (Ejecutar).
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
-- COMPROBACIÓN: Listar todos los conductores en la base externa
-- ==============================================================================
SELECT id_personal, nombre, apellido, cargo, empresa, contacto_1, estado 
FROM public.personal 
WHERE LOWER(cargo) LIKE '%conductor%'
ORDER BY nombre ASC;
