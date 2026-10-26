-- ==============================================================================
-- SCRIPT SQL: CREACIÓN DE TABLAS OPERATIVAS EN BASE DE DATOS LOCAL (COVEPA)
-- Base de Datos Propia: byywikicdvmmmndhkooe.supabase.co
-- ==============================================================================
-- Este script crea y precarga dos tablas clave en tu base de datos local:
-- 1. public.personal_cuadrillas (Relación oficial de Técnicos y Conductores por Cuadrilla)
-- 2. public.sitios_cuadrillas (Relación oficial de los 156 Sitios por Cuadrilla y Zona)
--
-- INSTRUCCIONES:
-- 1. Ingresa a tu Supabase propio (Amazonas-COVEPA: byywikicdvmmmndhkooe).
-- 2. Abre "SQL Editor" -> "New query".
-- 3. Pega este script completo y haz clic en "Run" (Ejecutar).
-- ==============================================================================

-- ==============================================================================
-- PARTE 1: TABLA personal_cuadrillas
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.personal_cuadrillas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_personal TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    cargo TEXT DEFAULT 'TÉCNICO',
    cuadrilla TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_personal_cuadrilla UNIQUE (id_personal)
);

ALTER TABLE public.personal_cuadrillas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica personal_cuadrillas" ON public.personal_cuadrillas;
CREATE POLICY "Permitir lectura publica personal_cuadrillas" ON public.personal_cuadrillas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion personal_cuadrillas" ON public.personal_cuadrillas;
CREATE POLICY "Permitir insercion personal_cuadrillas" ON public.personal_cuadrillas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion personal_cuadrillas" ON public.personal_cuadrillas;
CREATE POLICY "Permitir actualizacion personal_cuadrillas" ON public.personal_cuadrillas FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion personal_cuadrillas" ON public.personal_cuadrillas;
CREATE POLICY "Permitir eliminacion personal_cuadrillas" ON public.personal_cuadrillas FOR DELETE USING (true);

INSERT INTO public.personal_cuadrillas (id_personal, nombre_completo, cargo, cuadrilla, activo)
VALUES
    -- CUADRILLA 1
    ('554a3a58-bf04-480a-8795-d85e055ee4c6', 'JHONATAN FLORES', 'TÉCNICO', 'CUADRILLA 1', true),
    ('37633174-4fa7-448e-83a1-afcaa67d4189', 'CARLOS PEREZ', 'CONDUCTOR', 'CUADRILLA 1', true),

    -- CUADRILLA 2
    ('eebf3b9e-4923-47ce-9eee-8e9af86c9fea', 'CRISTIAN ISLA', 'TÉCNICO', 'CUADRILLA 2', true),
    ('63ba01bf-2b85-488a-864b-965b6a96c9db', 'JHORDIN PEREZ', 'CONDUCTOR', 'CUADRILLA 2', true),

    -- CUADRILLA 3
    ('05db4c32-3c7a-42e4-a0aa-8ac33dd5c75f', 'DANIEL JAVIER', 'TÉCNICO', 'CUADRILLA 3', true),
    ('38375217-1e58-4c17-aeed-12e6cd71fd52', 'LINO TICLLA', 'CONDUCTOR', 'CUADRILLA 3', true),

    -- CUADRILLA 4
    ('4b56f618-981f-4f2a-a901-4a4de4543899', 'ALFONSO CURI', 'TÉCNICO', 'CUADRILLA 4', true),
    ('077953b1-9fe9-41ac-b31e-227b7dd270a3', 'NILSON VERA', 'CONDUCTOR', 'CUADRILLA 4', true),

    -- CUADRILLA 5
    ('19ff0cdf-7afc-4e50-94b2-f1a9998de148', 'WILLIAM AVILA', 'SUPERVISOR', 'CUADRILLA 5', true),
    ('84072c1a-9f19-4c98-b7da-f9ec3c3391e6', 'JHORDIN ANTONIO', 'CONDUCTOR', 'CUADRILLA 5', true),

    -- CUADRILLA 6
    ('58bf102a-514f-4829-806b-1037856cadb1', 'GABRIEL FARRO', 'TÉCNICO', 'CUADRILLA 6', true),
    ('d879089f-5981-4f08-94ca-ccccf8027f78', 'ANDER PERALTA', 'CONDUCTOR', 'CUADRILLA 6', true)
ON CONFLICT (id_personal) DO UPDATE SET
    nombre_completo = EXCLUDED.nombre_completo,
    cargo = EXCLUDED.cargo,
    cuadrilla = EXCLUDED.cuadrilla,
    activo = EXCLUDED.activo,
    updated_at = NOW();

-- ==============================================================================
-- PARTE 2: TABLA sitios_cuadrillas (156 Sitios Oficiales de COVEPA)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sitios_cuadrillas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_site TEXT NOT NULL,
    cuadrilla TEXT NOT NULL,
    zona TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_sitio_cuadrilla UNIQUE (id_site)
);

ALTER TABLE public.sitios_cuadrillas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica sitios_cuadrillas" ON public.sitios_cuadrillas;
CREATE POLICY "Permitir lectura publica sitios_cuadrillas" ON public.sitios_cuadrillas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion sitios_cuadrillas" ON public.sitios_cuadrillas;
CREATE POLICY "Permitir insercion sitios_cuadrillas" ON public.sitios_cuadrillas FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion sitios_cuadrillas" ON public.sitios_cuadrillas;
CREATE POLICY "Permitir actualizacion sitios_cuadrillas" ON public.sitios_cuadrillas FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion sitios_cuadrillas" ON public.sitios_cuadrillas;
CREATE POLICY "Permitir eliminacion sitios_cuadrillas" ON public.sitios_cuadrillas FOR DELETE USING (true);

INSERT INTO public.sitios_cuadrillas (id_site, cuadrilla, zona, activo)
VALUES
    ('AM-0038-A01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0038-CS01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0038-CO01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0038-CO02', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0041-A01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0041-CS01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0041-IE01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0041-HS01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0034-A01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0034-CS01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0123-A01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0042-A01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0042-CS01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0042-CO01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0124-CS01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0125-A01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0235-A01', 'CUADRILLA 1', 'ZONA 7', true),
    ('AM-0240-A01', 'CUADRILLA 1', 'ZONA 7', true),
    ('AM-0237-A01', 'CUADRILLA 1', 'ZONA 7', true),
    ('AM-0238-A01', 'CUADRILLA 1', 'ZONA 7', true),
    ('AM-0234-A01', 'CUADRILLA 1', 'ZONA 7', true),
    ('AM-0234-HS01', 'CUADRILLA 1', 'ZONA 7', true),
    ('AM-0232-A01', 'CUADRILLA 1', 'ZONA 7', true),
    ('AM-0232-HS01', 'CUADRILLA 1', 'ZONA 7', true),
    ('AM-0220-A01', 'CUADRILLA 1', 'ZONA 7', true),
    ('AM-0219-A01', 'CUADRILLA 1', 'ZONA 7', true),
    ('AM-0231-A01', 'CUADRILLA 1', 'ZONA 7', true),
    ('AM-0231-HS01', 'CUADRILLA 1', 'ZONA 7', true),
    ('AM-0233-A01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0233-IE01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0239-A01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0078-A01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0078-CS01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0078-CO01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0078-HS01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0286-A01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0230-A01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0275-IE01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0217-A01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0271-A01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0271-IE01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0271-CS01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0215-A01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0214-A01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0214-CS01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0214-HS01', 'CUADRILLA 2', 'ZONA 7', true),
    ('AM-0186-A01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0186-IE01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0189-A01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0189-CS01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0190-A01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0192-A01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0192-CS01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0192-HS01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0192-IE01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0193-A01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0241-A01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0241-HS01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0241-IE01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0242-IE02', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0243-A01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0245-A01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0246-IE01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0248-A01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0249-A01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0253-A01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0270-A01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0315-A01', 'CUADRILLA 3', 'ZONA 7', true),
    ('AM-0076-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0076-HS01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0079-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0079-CO01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0079-HS01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0080-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0080-HS01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0221-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0222-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0222-HS01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0223-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0224-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0228-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0250-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0250-HS01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0251-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0252-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0252-HS01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0254-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0268-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0284-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0304-A01', 'CUADRILLA 4', 'ZONA 7', true),
    ('AM-0180-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0183-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0183-CS01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0185-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0185-IE02', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0191-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0177-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0177-HS01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0178-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0178-HS01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0179-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0229-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0229-HS01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0227-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0227-HS01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0225-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0226-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0226-CS01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0225-HS01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0077-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0077-HS01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0075-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0075-HS01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0201-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0200-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0256-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0256-HS01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0256-IE01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0195-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0181-A01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0194-A01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0194-IE01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0272-A01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0272-HS01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0213-A01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0207-A01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0205-A01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0197-A01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0196-A01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0204-A01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0199-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0203-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0209-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0208-A01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0212-IE01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0216-A01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0216-HS01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0188-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0274-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0274-CS01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0274-IE01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0273-A01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0273-IE01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0273-CS01', 'CUADRILLA 5', 'ZONA 7', true),
    ('AM-0040-A01', 'CUADRILLA 1', 'ZONA 2', true),
    ('AM-0036-A01', 'CUADRILLA 2', 'ZONA 2', true),
    ('AM-0121-A01', 'CUADRILLA 2', 'ZONA 2', true),
    ('AM-0121-IE01', 'CUADRILLA 2', 'ZONA 2', true),
    ('AM-0122-A01', 'CUADRILLA 2', 'ZONA 2', true),
    ('AM-0037-A01', 'CUADRILLA 2', 'ZONA 2', true),
    ('AM-0037-CS01', 'CUADRILLA 2', 'ZONA 2', true),
    ('AM-0037-CO01', 'CUADRILLA 2', 'ZONA 2', true),
    ('AM-0037-CO02', 'CUADRILLA 2', 'ZONA 2', true),
    ('AM-0043-A01', 'CUADRILLA 2', 'ZONA 2', true),
    ('AM-0126-A01', 'CUADRILLA 2', 'ZONA 2', true),
    ('AM-0033-A01', 'CUADRILLA 2', 'ZONA 2', true)
ON CONFLICT (id_site) DO UPDATE SET
    cuadrilla = EXCLUDED.cuadrilla,
    zona = EXCLUDED.zona,
    activo = EXCLUDED.activo,
    updated_at = NOW();

-- ==============================================================================
-- VERIFICACIÓN FINAL
-- ==============================================================================
SELECT 'personal_cuadrillas' AS tabla, COUNT(*) AS total_registros FROM public.personal_cuadrillas
UNION ALL
SELECT 'sitios_cuadrillas' AS tabla, COUNT(*) AS total_registros FROM public.sitios_cuadrillas;
