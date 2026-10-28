-- ============================================================
-- COVEPA - HISTORIAL DE CAMBIO DE ESTADOS DE OBSERVACIONES
-- Script de Creación de Tabla, Índices y Políticas de Seguridad
-- ============================================================

CREATE TABLE IF NOT EXISTS public.historial_estados_observaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_obs VARCHAR(80) NOT NULL REFERENCES public.observaciones(id_obs) ON DELETE CASCADE,
    id_sitio VARCHAR(50),
    estado_anterior VARCHAR(80),
    estado_nuevo VARCHAR(80) NOT NULL,
    usuario_nombre VARCHAR(150),
    usuario_email VARCHAR(150),
    usuario_id UUID,
    comentario TEXT,
    origen VARCHAR(50) DEFAULT 'web_erp',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Índices de alto rendimiento para consultas por observación y fecha
CREATE INDEX IF NOT EXISTS idx_historial_id_obs ON public.historial_estados_observaciones(id_obs);
CREATE INDEX IF NOT EXISTS idx_historial_created_at ON public.historial_estados_observaciones(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historial_id_sitio ON public.historial_estados_observaciones(id_sitio);

-- Políticas de seguridad RLS
ALTER TABLE public.historial_estados_observaciones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Permitir lectura del historial a usuarios autenticados" 
        ON public.historial_estados_observaciones FOR SELECT USING (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Permitir insercion del historial a usuarios autenticados" 
        ON public.historial_estados_observaciones FOR INSERT WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- (Opcional) Trigger en PostgreSQL para registrar automáticamente cambios si se actualiza directamente
CREATE OR REPLACE FUNCTION public.trg_fn_registrar_cambio_estado_obs()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.estado_covepa IS DISTINCT FROM NEW.estado_covepa) THEN
        INSERT INTO public.historial_estados_observaciones (
            id_obs,
            id_sitio,
            estado_anterior,
            estado_nuevo,
            usuario_nombre,
            comentario,
            origen,
            created_at
        ) VALUES (
            NEW.id_obs,
            NEW.id_sitio,
            OLD.estado_covepa,
            NEW.estado_covepa,
            COALESCE(NEW.revisor, 'Auditor COVEPA'),
            NEW.comentario_covepa,
            'sistema_trigger',
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- DROP TRIGGER IF EXISTS trg_registrar_cambio_estado_obs ON public.observaciones;
-- CREATE TRIGGER trg_registrar_cambio_estado_obs
-- AFTER UPDATE OF estado_covepa ON public.observaciones
-- FOR EACH ROW EXECUTE FUNCTION public.trg_fn_registrar_cambio_estado_obs();

