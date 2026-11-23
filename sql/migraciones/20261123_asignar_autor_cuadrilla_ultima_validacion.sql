-- ============================================================================
-- MIGRACIÓN: ASIGNAR AUTOR Y CUADRILLA A LA ÚLTIMA PERSONA QUE SOLICITÓ VALIDACIÓN
-- Fecha: 23 de Noviembre de 2026
-- Condición: Observaciones con estado diferente a Pendiente, Descartado, Crítico o Pre-validado
-- ============================================================================

WITH ultimas_solicitudes AS (
  SELECT DISTINCT ON (id_obs)
    id_obs,
    usuario_nombre,
    comentario,
    created_at
  FROM public.historial_estados_observaciones
  WHERE (
      estado_nuevo ILIKE '%solicitando%'
      OR origen = 'app_fotos'
      OR comentario ILIKE '%[Técnico:%'
      OR comentario ILIKE '%solicita%'
      OR (
        usuario_nombre NOT ILIKE '%CESAR ARIAS%'
        AND usuario_nombre NOT ILIKE '%ADMINISTRADOR%'
        AND usuario_nombre NOT ILIKE '%GILAT%'
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
      )
    )
    AND usuario_nombre IS NOT NULL
    AND TRIM(usuario_nombre) != ''
  ORDER BY id_obs, created_at DESC
)
UPDATE public.observaciones o
SET
  tecnico_ejecutor = CASE
    WHEN UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%MARCO%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%CHAMBA%' THEN 'Marco Chamba'
    WHEN UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%FLORES%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%JHONATAN%' THEN 'Jhonatan Flores'
    WHEN UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%WILLY%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%FERNANDEZ%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%FERNÁNDEZ%' THEN 'Willy Fernández'
    WHEN UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%CASTRO%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%JUAN%' THEN 'Juan Castro'
    WHEN UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%WILLIAM%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%AVILA%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%ÁVILA%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%WILL%' THEN 'William Avila'
    WHEN UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%CURI%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%ALFONSO%' THEN 'Alfonso Curi'
    WHEN UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%JAVIER%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%DANIEL%' THEN 'Daniel Javier'
    WHEN UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%ESPINOZA%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%HUGO%' THEN 'Hugo Espinoza'
    ELSE s.usuario_nombre
  END,
  cuadrilla_ejecutora = CASE
    WHEN UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%CHAMBA%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%FLORES%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%MARCO%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%JHONATAN%' THEN 'CUADRILLA 1'
    WHEN UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%CASTRO%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%JUAN%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%FERNANDEZ%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%FERNÁNDEZ%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%WILLY%' THEN 'CUADRILLA 2'
    WHEN UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%CURI%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%ALFONSO%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%AVILA%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%ÁVILA%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%WILL%' THEN 'CUADRILLA 3'
    WHEN UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%ESPINOZA%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%HUGO%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%JAVIER%' 
      OR UPPER(COALESCE(s.usuario_nombre, '') || ' ' || COALESCE(s.comentario, '')) LIKE '%DANIEL%' 
      OR o.id_sitio ILIKE 'AMEX%' 
      OR o.id_obs ILIKE 'AMEX%' THEN 'CUADRILLA 4'
    ELSE 'CUADRILLA 1'
  END
FROM ultimas_solicitudes s
WHERE o.id_obs = s.id_obs
  AND LOWER(TRIM(COALESCE(o.estado_covepa, ''))) NOT IN (
    'pendiente',
    'descartado',
    'descartada',
    'crítico',
    'critico',
    'crítica',
    'critica',
    'pre-validado',
    'pre-validada',
    'prevalidado',
    'prevalidada',
    ''
  );

-- Notificar recarga de caché de esquema en PostgREST
NOTIFY pgrst, 'reload schema';
