-- ============================================================
-- MIGRACIÓN: AÑADIR PERIODO_REPORTE A CONFIGURACION_REPORTES_CORREO
-- Proyecto: Amazonas - COVEPA
-- Permite configurar si el reporte automático despacha las observaciones
-- del día actual ('dia_actual') o del día anterior ('dia_anterior').
-- ============================================================

ALTER TABLE public.configuracion_reportes_correo
ADD COLUMN IF NOT EXISTS periodo_reporte TEXT NOT NULL DEFAULT 'dia_actual';

