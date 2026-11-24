-- =========================================================================================
-- MIGRACIÓN SQL: LIMPIEZA DE DUPLICADOS EN HISTORIAL DE ESTADOS (SOLICITANDO REVISIÓN)
-- Archivo: sql/migraciones/20261124_limpiar_duplicados_solicitando_revision.sql
-- Propósito:
--   Elimina los registros sintéticos duplicados generados automáticamente
--   ('Técnico de Campo (App Fotos)') cuando ya existe un registro de solicitud
--   técnica legítimo enviado por el técnico real (ej. Juan Castro Torres).
-- =========================================================================================

-- Eliminar registros duplicados genéricos dentro de una ventana de 30 minutos
-- respecto a una solicitud legítima con nombre de técnico
DELETE FROM public.historial_estados_observaciones gen
WHERE gen.estado_nuevo IN ('Solicitando Revisión', 'Solicitando Revision')
  AND (
    LOWER(TRIM(gen.usuario_nombre)) = 'técnico de campo (app fotos)' OR
    LOWER(TRIM(gen.usuario_nombre)) = 'tecnico de campo (app fotos)' OR
    LOWER(TRIM(gen.usuario_nombre)) = 'técnico de campo' OR
    LOWER(TRIM(gen.usuario_nombre)) = 'tecnico de campo' OR
    gen.usuario_nombre IS NULL
  )
  AND EXISTS (
    SELECT 1 
    FROM public.historial_estados_observaciones real_h
    WHERE real_h.id_obs = gen.id_obs
      AND real_h.estado_nuevo IN ('Solicitando Revisión', 'Solicitando Revision')
      AND real_h.id <> gen.id
      AND LOWER(TRIM(real_h.usuario_nombre)) NOT IN (
        'técnico de campo (app fotos)', 'tecnico de campo (app fotos)',
        'técnico de campo', 'tecnico de campo', 'auditor covepa', 'sistema'
      )
      AND ABS(EXTRACT(EPOCH FROM (real_h.created_at - gen.created_at))) <= 1800
  );

-- Notificar recarga
NOTIFY pgrst, 'reload schema';
