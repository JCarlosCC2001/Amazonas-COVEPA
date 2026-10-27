-- ============================================================
-- COVEPA - ERP LEVANTAMIENTO DE OBSERVACIONES TÉCNICAS
-- Script de Creación de Tablas, Índices y Vistas (Supabase)
-- ============================================================

-- Habilitar extensión para UUIDs si no está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS (Tipos de datos controlados)
DO $$ BEGIN
    CREATE TYPE estado_observacion AS ENUM ('pendiente', 'en_proceso', 'subsanada', 'cancelada');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE prioridad_observacion AS ENUM ('baja', 'media', 'alta', 'critica');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE estado_programacion AS ENUM ('programada', 'en_progreso', 'completada', 'reprogramada', 'cancelada');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABLA: PERSONAL (Técnicos, Conductores y Supervisores)
CREATE TABLE IF NOT EXISTS public.personal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cuadrilla VARCHAR(50),               -- Ej: CUADRILLA 1, CUADRILLA 2
    origen VARCHAR(100),                 -- Ej: PEDRO RUIZ, CHICLAYO, HUANCAYO
    cargo VARCHAR(80) NOT NULL,          -- TÉCNICO, CONDUCTOR, SUPERVISOR / CAMPO
    nombre_completo VARCHAR(150) NOT NULL,
    telefono VARCHAR(100),
    operador VARCHAR(100),               -- BITEL, CLARO, MOVISTAR
    documento_identidad VARCHAR(30),
    email VARCHAR(120),
    activo BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Alias o vista para compatibilidad con técnicos si se requiere
CREATE OR REPLACE VIEW public.tecnicos AS 
SELECT * FROM public.personal WHERE cargo ILIKE '%TÉCNICO%' OR cargo ILIKE '%TECNICO%';

-- 3. TABLA: OBSERVACIONES
CREATE TABLE IF NOT EXISTS public.observaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_sitio VARCHAR(50) NOT NULL, -- Código/ID proveniente de la BD externa
    nombre_sitio_cache VARCHAR(150),   -- Nombre para consultas rápidas
    id_tecnico_asignado UUID REFERENCES public.personal(id) ON DELETE SET NULL,
    tipo_observacion VARCHAR(80) NOT NULL, -- ej: Infraestructura, Torre, Energía, etc.
    descripcion TEXT NOT NULL,
    prioridad prioridad_observacion DEFAULT 'media' NOT NULL,
    estado estado_observacion DEFAULT 'pendiente' NOT NULL,
    latitud NUMERIC(10, 7),
    longitud NUMERIC(10, 7),
    fotos_antes TEXT[] DEFAULT '{}',
    fotos_despues TEXT[] DEFAULT '{}',
    fecha_deteccion DATE DEFAULT CURRENT_DATE NOT NULL,
    fecha_compromiso DATE,
    fecha_cierre TIMESTAMPTZ,
    notas_cierre TEXT,
    creado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. TABLA: PROGRAMACIONES (Jornadas / Rutas de personal de campo)
CREATE TABLE IF NOT EXISTS public.programaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_tecnico UUID NOT NULL REFERENCES public.personal(id) ON DELETE RESTRICT,
    fecha_programada DATE NOT NULL,
    estado estado_programacion DEFAULT 'programada' NOT NULL,
    notas_itinerario TEXT,
    creado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. TABLA: PROGRAMACION_SITIOS (Sitios a visitar en la jornada)
CREATE TABLE IF NOT EXISTS public.programacion_sitios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_programacion UUID NOT NULL REFERENCES public.programaciones(id) ON DELETE CASCADE,
    codigo_sitio VARCHAR(50) NOT NULL,
    nombre_sitio_cache VARCHAR(150),
    orden_visita INT DEFAULT 1 NOT NULL,
    estado_visita VARCHAR(30) DEFAULT 'pendiente' NOT NULL, -- pendiente, visitado, omitido
    observaciones_visita TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. ÍNDICES PARA ALTO RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_obs_sitio ON public.observaciones(codigo_sitio);
CREATE INDEX IF NOT EXISTS idx_obs_tecnico ON public.observaciones(id_tecnico_asignado);
CREATE INDEX IF NOT EXISTS idx_obs_estado ON public.observaciones(estado);
CREATE INDEX IF NOT EXISTS idx_prog_tecnico_fecha ON public.programaciones(id_tecnico, fecha_programada);
CREATE INDEX IF NOT EXISTS idx_personal_cuadrilla ON public.personal(cuadrilla);
CREATE INDEX IF NOT EXISTS idx_personal_cargo ON public.personal(cargo);

-- 7. VISTA DE EFICIENCIA POR TÉCNICO
CREATE OR REPLACE VIEW public.vista_eficiencia_tecnicos AS
SELECT 
    p.id AS id_tecnico,
    p.nombre_completo,
    p.cuadrilla,
    p.cargo,
    COUNT(o.id) AS total_observaciones_asignadas,
    COUNT(CASE WHEN o.estado = 'subsanada' THEN 1 END) AS total_subsanadas,
    COUNT(CASE WHEN o.estado = 'en_proceso' THEN 1 END) AS total_en_proceso,
    COUNT(CASE WHEN o.estado = 'pendiente' THEN 1 END) AS total_pendientes,
    ROUND(
        CASE 
            WHEN COUNT(o.id) = 0 THEN 0 
            ELSE (COUNT(CASE WHEN o.estado = 'subsanada' THEN 1 END)::NUMERIC / COUNT(o.id)::NUMERIC) * 100 
        END, 2
    ) AS tasa_eficiencia_porcentaje,
    ROUND(
        AVG(
            CASE 
                WHEN o.estado = 'subsanada' AND o.fecha_cierre IS NOT NULL 
                THEN EXTRACT(EPOCH FROM (o.fecha_cierre - o.created_at)) / 86400 
                ELSE NULL 
            END
        )::NUMERIC, 1
    ) AS dias_promedio_cierre
FROM public.personal p
LEFT JOIN public.observaciones o ON o.id_tecnico_asignado = p.id
WHERE p.activo = true AND (p.cargo ILIKE '%TÉCNICO%' OR p.cargo ILIKE '%TECNICO%')
GROUP BY p.id, p.nombre_completo, p.cuadrilla, p.cargo;

-- 8. STORAGE BUCKET PARA EVIDENCIAS FOTOGRÁFICAS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('evidencias', 'evidencias', true)
ON CONFLICT (id) DO NOTHING;

-- 9. CARGA INICIAL DE PERSONAL (TÉCNICOS, CONDUCTORES Y SUPERVISORES)
INSERT INTO public.personal (cuadrilla, origen, cargo, nombre_completo, telefono, operador, activo)
VALUES
    ('CUADRILLA 1', 'PEDRO RUIZ',    'TÉCNICO',            'JHONATAN FLORES',        '929985566',             'BITEL',            true),
    ('CUADRILLA 1', 'CHICLAYO',      'CONDUCTOR',          'ANDER PERALTA',          '945551928',             NULL,               true),
    ('CUADRILLA 2', 'HUANCAYO',      'TÉCNICO',            'DANIEL JAVIER',          '956188967',             'BITEL',            true),
    ('CUADRILLA 2', NULL,            'CONDUCTOR',          'LINO TICLLA',            '910493156',             NULL,               true),
    ('CUADRILLA 3', 'HUANCAYO',      'TÉCNICO',            'ALFONSO CURI',           '952010919 / 939507297', 'BITEL / MOVISTAR', true),
    ('CUADRILLA 3', 'BAGUA GRANDE',  'CONDUCTOR',          'JHORDITH ZULUETA (TOÑO)','999389272',             NULL,               true),
    ('CUADRILLA 4', 'LIMA',          'SUPERVISOR / CAMPO', 'WILLIAM AVILA',          '951231901',             'CLARO',            true),
    ('CUADRILLA 4', 'BAGUA GRANDE',  'CONDUCTOR',          'JHORDIN PEREZ',          '921004913',             NULL,               true),
    ('CUADRILLA 5', 'BAGUA GRANDE',  'TÉCNICO',            'GABRIEL FARRO',          '931704961',             'BITEL',            true),
    ('CUADRILLA 5', 'BAGUA GRANDE',  'CONDUCTOR',          'NILSON VERA',            '969936764',             NULL,               true),
    ('CUADRILLA 6', 'CHACHAPOYAS',   'TÉCNICO',            'CRISTIAN ISLA',          '923932783 / 930996665', 'CLARO / BITEL',    true);
-- TABLA: SITIOS_ASIGNADOS
CREATE TABLE IF NOT EXISTS public.sitios_asignados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_site VARCHAR(50) NOT NULL,
    grupo VARCHAR(50) NOT NULL,
    zona VARCHAR(50) NOT NULL,
    activo BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_site_grupo UNIQUE (id_site, grupo)
);

CREATE INDEX IF NOT EXISTS idx_sitios_asignados_site ON public.sitios_asignados(id_site);
CREATE INDEX IF NOT EXISTS idx_sitios_asignados_grupo ON public.sitios_asignados(grupo);
CREATE INDEX IF NOT EXISTS idx_sitios_asignados_zona ON public.sitios_asignados(zona);

-- INSERCIÓN DE SITIOS ASIGNADOS (TOTAL: 156)
INSERT INTO public.sitios_asignados (id_site, grupo, zona)
VALUES
    ('AM-0038-A01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0038-CS01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0038-CO01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0038-CO02', 'GRUPO 1', 'ZONA 2'),
    ('AM-0041-A01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0041-CS01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0041-IE01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0041-HS01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0034-A01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0034-CS01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0123-A01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0042-A01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0042-CS01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0042-CO01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0124-CS01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0125-A01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0235-A01', 'GRUPO 1', 'ZONA 7'),
    ('AM-0240-A01', 'GRUPO 1', 'ZONA 7'),
    ('AM-0237-A01', 'GRUPO 1', 'ZONA 7'),
    ('AM-0238-A01', 'GRUPO 1', 'ZONA 7'),
    ('AM-0234-A01', 'GRUPO 1', 'ZONA 7'),
    ('AM-0234-HS01', 'GRUPO 1', 'ZONA 7'),
    ('AM-0232-A01', 'GRUPO 1', 'ZONA 7'),
    ('AM-0232-HS01', 'GRUPO 1', 'ZONA 7'),
    ('AM-0220-A01', 'GRUPO 1', 'ZONA 7'),
    ('AM-0219-A01', 'GRUPO 1', 'ZONA 7'),
    ('AM-0231-A01', 'GRUPO 1', 'ZONA 7'),
    ('AM-0231-HS01', 'GRUPO 1', 'ZONA 7'),
    ('AM-0233-A01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0233-IE01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0239-A01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0078-A01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0078-CS01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0078-CO01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0078-HS01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0286-A01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0230-A01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0275-IE01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0217-A01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0271-A01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0271-IE01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0271-CS01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0215-A01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0214-A01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0214-CS01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0214-HS01', 'GRUPO 2', 'ZONA 7'),
    ('AM-0186-A01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0186-IE01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0189-A01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0189-CS01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0190-A01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0192-A01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0192-CS01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0192-HS01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0192-IE01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0193-A01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0241-A01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0241-HS01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0241-IE01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0242-IE02', 'GRUPO 3', 'ZONA 7'),
    ('AM-0243-A01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0245-A01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0246-IE01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0248-A01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0249-A01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0253-A01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0270-A01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0315-A01', 'GRUPO 3', 'ZONA 7'),
    ('AM-0076-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0076-HS01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0079-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0079-CO01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0079-HS01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0080-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0080-HS01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0221-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0222-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0222-HS01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0223-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0224-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0228-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0250-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0250-HS01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0251-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0252-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0252-HS01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0254-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0268-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0284-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0304-A01', 'GRUPO 4', 'ZONA 7'),
    ('AM-0180-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0183-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0183-CS01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0185-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0185-IE02', 'GRUPO 5', 'ZONA 7'),
    ('AM-0191-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0177-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0177-HS01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0178-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0178-HS01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0179-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0229-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0229-HS01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0227-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0227-HS01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0225-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0226-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0226-CS01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0225-HS01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0077-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0077-HS01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0075-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0075-HS01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0201-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0200-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0256-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0256-HS01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0256-IE01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0195-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0181-A01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0194-A01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0194-IE01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0272-A01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0272-HS01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0213-A01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0207-A01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0205-A01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0197-A01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0196-A01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0204-A01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0199-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0203-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0209-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0208-A01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0212-IE01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0216-A01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0216-HS01', 'GRUPO 6', 'ZONA 7'),
    ('AM-0188-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0274-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0274-CS01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0274-IE01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0273-A01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0273-IE01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0273-CS01', 'GRUPO 5', 'ZONA 7'),
    ('AM-0040-A01', 'GRUPO 1', 'ZONA 2'),
    ('AM-0036-A01', 'GRUPO 2', 'ZONA 2'),
    ('AM-0121-A01', 'GRUPO 2', 'ZONA 2'),
    ('AM-0121-IE01', 'GRUPO 2', 'ZONA 2'),
    ('AM-0122-A01', 'GRUPO 2', 'ZONA 2'),
    ('AM-0037-A01', 'GRUPO 2', 'ZONA 2'),
    ('AM-0037-CS01', 'GRUPO 2', 'ZONA 2'),
    ('AM-0037-CO01', 'GRUPO 2', 'ZONA 2'),
    ('AM-0037-CO02', 'GRUPO 2', 'ZONA 2'),
    ('AM-0043-A01', 'GRUPO 2', 'ZONA 2'),
    ('AM-0126-A01', 'GRUPO 2', 'ZONA 2'),
    ('AM-0033-A01', 'GRUPO 2', 'ZONA 2')
ON CONFLICT (id_site, grupo) DO UPDATE SET zona = EXCLUDED.zona;
