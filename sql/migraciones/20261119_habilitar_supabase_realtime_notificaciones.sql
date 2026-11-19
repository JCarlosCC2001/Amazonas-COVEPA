-- ==============================================================================
-- MIGRACIÓN: Habilitar Supabase Realtime para Notificaciones Instantáneas
-- Proyecto: Amazonas - COVEPA
-- Fecha: 19 de Noviembre de 2026
--
-- MOTIVO:
-- Permite que PostgreSQL envíe eventos inmediatos vía WebSocket hacia los navegadores
-- cuando un técnico en campo (App de Fotos) o usuario web cambie el estado de una
-- observación a 'Solicitando Revisión'.
-- ==============================================================================

-- 1. Asegurar identidad de réplica completa para incluir valores anteriores y nuevos
ALTER TABLE public.observaciones REPLICA IDENTITY FULL;
ALTER TABLE public.historial_estados_observaciones REPLICA IDENTITY FULL;

-- 2. Añadir tablas a la publicación de Supabase Realtime si no estuvieran agregadas
DO $$
BEGIN
  -- Agregar observaciones a la publicación
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'observaciones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.observaciones;
  END IF;

  -- Agregar historial_estados_observaciones a la publicación
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'historial_estados_observaciones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.historial_estados_observaciones;
  END IF;
END $$;
