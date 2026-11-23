-- ============================================================================
-- MIGRACIÓN: AGREGAR COLUMNAS DE CUADRILLA EJECUTORA Y TÉCNICO EJECUTOR
-- Fecha: 23 de Noviembre de 2026
-- Descripción:
-- 1. Agrega las columnas cuadrilla_ejecutora y tecnico_ejecutor en public.observaciones.
-- 2. Crea índices para búsquedas rápidas.
-- 3. Puebla retrospectivamente los registros existentes a partir de las solicitudes
--    de revisión registradas en public.historial_estados_observaciones (columna usuario_nombre).
-- ============================================================================

-- 1. Agregar las nuevas columnas a la tabla observaciones
ALTER TABLE public.observaciones
  ADD COLUMN IF NOT EXISTS cuadrilla_ejecutora text,
  ADD COLUMN IF NOT EXISTS tecnico_ejecutor text;

-- 2. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_observaciones_cuadrilla_ejecutora
  ON public.observaciones (cuadrilla_ejecutora);

CREATE INDEX IF NOT EXISTS idx_observaciones_tecnico_ejecutor
  ON public.observaciones (tecnico_ejecutor);

-- 3. Poblar retrospectivamente a partir del último técnico solicitante en el historial
WITH ultimas_solicitudes AS (
  SELECT DISTINCT ON (id_obs)
    id_obs,
    usuario_nombre,
    created_at
  FROM public.historial_estados_observaciones
  WHERE usuario_nombre IS NOT NULL
    AND usuario_nombre != ''
    AND (
      UPPER(usuario_nombre) LIKE '%CHAMBA%' OR
      UPPER(usuario_nombre) LIKE '%FLORES%' OR
      UPPER(usuario_nombre) LIKE '%CASTRO%' OR
      UPPER(usuario_nombre) LIKE '%FERNANDEZ%' OR
      UPPER(usuario_nombre) LIKE '%FERNÁNDEZ%' OR
      UPPER(usuario_nombre) LIKE '%CURI%' OR
      UPPER(usuario_nombre) LIKE '%AVILA%' OR
      UPPER(usuario_nombre) LIKE '%ÁVILA%' OR
      UPPER(usuario_nombre) LIKE '%WILL%' OR
      UPPER(usuario_nombre) LIKE '%ESPINOZA%' OR
      UPPER(usuario_nombre) LIKE '%JAVIER%'
    )
  ORDER BY id_obs, created_at DESC
)
UPDATE public.observaciones o
SET
  tecnico_ejecutor = CASE
    WHEN UPPER(s.usuario_nombre) LIKE '%MARCO%' OR UPPER(s.usuario_nombre) LIKE '%CHAMBA%' THEN 'Marco Chamba'
    WHEN UPPER(s.usuario_nombre) LIKE '%FLORES%' OR UPPER(s.usuario_nombre) LIKE '%JHONATAN%' THEN 'Jhonatan Flores'
    WHEN UPPER(s.usuario_nombre) LIKE '%WILLY%' OR UPPER(s.usuario_nombre) LIKE '%FERNANDEZ%' OR UPPER(s.usuario_nombre) LIKE '%FERNÁNDEZ%' THEN 'Willy Fernández'
    WHEN UPPER(s.usuario_nombre) LIKE '%CASTRO%' OR UPPER(s.usuario_nombre) LIKE '%JUAN%' THEN 'Juan Castro'
    WHEN UPPER(s.usuario_nombre) LIKE '%WILLIAM%' OR UPPER(s.usuario_nombre) LIKE '%AVILA%' OR UPPER(s.usuario_nombre) LIKE '%ÁVILA%' OR UPPER(s.usuario_nombre) LIKE '%WILL%' THEN 'William Avila'
    WHEN UPPER(s.usuario_nombre) LIKE '%CURI%' OR UPPER(s.usuario_nombre) LIKE '%ALFONSO%' THEN 'Alfonso Curi'
    WHEN UPPER(s.usuario_nombre) LIKE '%JAVIER%' OR UPPER(s.usuario_nombre) LIKE '%DANIEL%' THEN 'Daniel Javier'
    WHEN UPPER(s.usuario_nombre) LIKE '%ESPINOZA%' OR UPPER(s.usuario_nombre) LIKE '%HUGO%' THEN 'Hugo Espinoza'
    ELSE o.tecnico_ejecutor
  END,
  cuadrilla_ejecutora = CASE
    WHEN UPPER(s.usuario_nombre) LIKE '%CHAMBA%' OR UPPER(s.usuario_nombre) LIKE '%FLORES%' OR UPPER(s.usuario_nombre) LIKE '%MARCO%' OR UPPER(s.usuario_nombre) LIKE '%JHONATAN%' THEN 'CUADRILLA 1'
    WHEN UPPER(s.usuario_nombre) LIKE '%CASTRO%' OR UPPER(s.usuario_nombre) LIKE '%JUAN%' OR UPPER(s.usuario_nombre) LIKE '%FERNANDEZ%' OR UPPER(s.usuario_nombre) LIKE '%FERNÁNDEZ%' OR UPPER(s.usuario_nombre) LIKE '%WILLY%' THEN 'CUADRILLA 2'
    WHEN UPPER(s.usuario_nombre) LIKE '%CURI%' OR UPPER(s.usuario_nombre) LIKE '%ALFONSO%' OR UPPER(s.usuario_nombre) LIKE '%AVILA%' OR UPPER(s.usuario_nombre) LIKE '%ÁVILA%' OR UPPER(s.usuario_nombre) LIKE '%WILL%' THEN 'CUADRILLA 3'
    WHEN UPPER(s.usuario_nombre) LIKE '%ESPINOZA%' OR UPPER(s.usuario_nombre) LIKE '%HUGO%' OR UPPER(s.usuario_nombre) LIKE '%JAVIER%' OR UPPER(s.usuario_nombre) LIKE '%DANIEL%' THEN 'CUADRILLA 4'
    ELSE o.cuadrilla_ejecutora
  END
FROM ultimas_solicitudes s
WHERE o.id_obs = s.id_obs
  AND (o.tecnico_ejecutor IS NULL OR o.cuadrilla_ejecutora IS NULL);

-- 4. Notificar recarga de caché de esquema en PostgREST
NOTIFY pgrst, 'reload schema';
