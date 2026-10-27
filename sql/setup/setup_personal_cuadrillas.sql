-- ==============================================================================
-- SCRIPT SQL: CREACIÓN DE TABLA `personal_cuadrillas` EN BASE DE DATOS LOCAL
-- Proyecto: Amazonas-COVEPA (Supabase Local: byywikicdvmmmndhkooe)
-- ==============================================================================
-- Este script crea la tabla de relación oficial para saber a qué cuadrilla
-- pertenece cada personal, permitiendo cuadrillas flexibles de 2 o más personas.
--
-- INSTRUCCIONES:
-- 1. Abre el panel de Supabase de tu base de datos propia (COVEPA: byywikicdvmmmndhkooe).
-- 2. Ve a "SQL Editor" -> "New query".
-- 3. Pega este contenido y presiona "Run" (Ejecutar).
-- ==============================================================================

-- 1. Crear la tabla de relación personal_cuadrillas
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

-- 2. Habilitar seguridad de nivel de fila (RLS) y permitir lectura/escritura pública/autenticada
ALTER TABLE public.personal_cuadrillas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica personal_cuadrillas" ON public.personal_cuadrillas;
CREATE POLICY "Permitir lectura publica personal_cuadrillas" 
ON public.personal_cuadrillas 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Permitir insercion personal_cuadrillas" ON public.personal_cuadrillas;
CREATE POLICY "Permitir insercion personal_cuadrillas" 
ON public.personal_cuadrillas 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir actualizacion personal_cuadrillas" ON public.personal_cuadrillas;
CREATE POLICY "Permitir actualizacion personal_cuadrillas" 
ON public.personal_cuadrillas 
FOR UPDATE 
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion personal_cuadrillas" ON public.personal_cuadrillas;
CREATE POLICY "Permitir eliminacion personal_cuadrillas" 
ON public.personal_cuadrillas 
FOR DELETE 
USING (true);

-- 3. Insertar las asignaciones oficiales de las 6 cuadrillas según cuadro de asistencia
INSERT INTO public.personal_cuadrillas (id_personal, nombre_completo, cargo, cuadrilla, activo)
VALUES
    -- CUADRILLA 1
    ('554a3a58-bf04-480a-8795-d85e055ee4c6', 'JHONATAN FLORES', 'TÉCNICO', 'CUADRILLA 1', true),
    ('cond-carlos-perez', 'CARLOS PEREZ', 'CONDUCTOR', 'CUADRILLA 1', true),

    -- CUADRILLA 2
    ('eebf3b9e-4923-47ce-9eee-8e9af86c9fea', 'CRISTIAN ISLA', 'TÉCNICO', 'CUADRILLA 2', true),
    ('cond-jhordin-perez', 'JHORDIN PEREZ', 'CONDUCTOR', 'CUADRILLA 2', true),

    -- CUADRILLA 3
    ('05db4c32-3c7a-42e4-a0aa-8ac33dd5c75f', 'DANIEL JAVIER', 'TÉCNICO', 'CUADRILLA 3', true),
    ('cond-lino-ticlla', 'LINO TICLLA', 'CONDUCTOR', 'CUADRILLA 3', true),

    -- CUADRILLA 4
    ('4b56f618-981f-4f2a-a901-4a4de4543899', 'ALFONSO CURI', 'TÉCNICO', 'CUADRILLA 4', true),
    ('cond-nilson-vera', 'NILSON VERA', 'CONDUCTOR', 'CUADRILLA 4', true),

    -- CUADRILLA 5
    ('19ff0cdf-7afc-4e50-94b2-f1a9998de148', 'WILLIAM AVILA', 'SUPERVISOR', 'CUADRILLA 5', true),
    ('cond-jhordin-antonio', 'JHORDIN ANTONIO', 'CONDUCTOR', 'CUADRILLA 5', true),

    -- CUADRILLA 6
    ('58bf102a-514f-4829-806b-1037856cadb1', 'GABRIEL FARRO', 'TÉCNICO', 'CUADRILLA 6', true),
    ('cond-ander-peralta', 'ANDER PERALTA', 'CONDUCTOR', 'CUADRILLA 6', true)
ON CONFLICT (id_personal) DO UPDATE SET
    nombre_completo = EXCLUDED.nombre_completo,
    cargo = EXCLUDED.cargo,
    cuadrilla = EXCLUDED.cuadrilla,
    activo = EXCLUDED.activo,
    updated_at = NOW();

-- 4. Notificar estado final
SELECT id_personal, nombre_completo, cargo, cuadrilla, activo FROM public.personal_cuadrillas ORDER BY cuadrilla, cargo;
