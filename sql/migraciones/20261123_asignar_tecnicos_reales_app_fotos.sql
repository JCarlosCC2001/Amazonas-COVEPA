-- ============================================================================
-- MIGRACIÓN: ASIGNAR TÉCNICOS EJECUTORES REALES DESDE EL APLICATIVO
-- Fecha: 23 de Noviembre de 2026
-- Objetivo:
-- 1. Limpiar asignaciones previas que correspondían a auditores o administradores
--    (Carlos Condor, Flor Duran, Cesar Arias, Amilcar, Gilat, Administrador).
-- 2. Asignar como técnico ejecutor y cuadrilla ejecutora a la última persona
--    de campo que solicitó validación desde el aplicativo móvil.
-- ============================================================================

-- Paso 1: Limpiar asignaciones erróneas de auditores y personal de oficina
UPDATE public.observaciones
SET
  tecnico_ejecutor = NULL,
  cuadrilla_ejecutora = NULL
WHERE UPPER(tecnico_ejecutor) LIKE '%CONDOR%'
   OR UPPER(tecnico_ejecutor) LIKE '%FLOR DURAN%'
   OR UPPER(tecnico_ejecutor) LIKE '%DURAN%'
   OR UPPER(tecnico_ejecutor) LIKE '%CESAR ARIAS%'
   OR UPPER(tecnico_ejecutor) LIKE '%AMILCAR%'
   OR UPPER(tecnico_ejecutor) LIKE '%KARIN%'
   OR UPPER(tecnico_ejecutor) LIKE '%GILAT%'
   OR UPPER(tecnico_ejecutor) LIKE '%ADMIN%'
   OR tecnico_ejecutor = 'Carlos';

-- Paso 2: Identificar la última solicitud de validación de un técnico de campo real
WITH ultimas_solicitudes_campo AS (
  SELECT DISTINCT ON (id_obs)
    id_obs,
    usuario_nombre,
    created_at
  FROM public.historial_estados_observaciones
  WHERE usuario_nombre IS NOT NULL
    AND TRIM(usuario_nombre) != ''
    -- Excluir personal de oficina, auditores y cuentas genéricas
    AND UPPER(usuario_nombre) NOT LIKE '%CONDOR%'
    AND UPPER(usuario_nombre) NOT LIKE '%FLOR DURAN%'
    AND UPPER(usuario_nombre) NOT LIKE '%DURAN%'
    AND UPPER(usuario_nombre) NOT LIKE '%CESAR ARIAS%'
    AND UPPER(usuario_nombre) NOT LIKE '%AMILCAR%'
    AND UPPER(usuario_nombre) NOT LIKE '%KARIN%'
    AND UPPER(usuario_nombre) NOT LIKE '%GILAT%'
    AND UPPER(usuario_nombre) NOT LIKE '%ADMIN%'
    AND UPPER(usuario_nombre) NOT LIKE '%TÉCNICO%'
    AND usuario_nombre != 'Carlos'
    -- Incluir únicamente técnicos de campo reconocidos
    AND (
      UPPER(usuario_nombre) LIKE '%CHAMBA%' OR
      UPPER(usuario_nombre) LIKE '%FLORES%' OR
      UPPER(usuario_nombre) LIKE '%JHONATAN%' OR
      UPPER(usuario_nombre) LIKE '%CASTRO%' OR
      UPPER(usuario_nombre) LIKE '%JUAN%' OR
      UPPER(usuario_nombre) LIKE '%FERNANDEZ%' OR
      UPPER(usuario_nombre) LIKE '%FERNÁNDEZ%' OR
      UPPER(usuario_nombre) LIKE '%WILLY%' OR
      UPPER(usuario_nombre) LIKE '%CURI%' OR
      UPPER(usuario_nombre) LIKE '%ALFONSO%' OR
      UPPER(usuario_nombre) LIKE '%AVILA%' OR
      UPPER(usuario_nombre) LIKE '%ÁVILA%' OR
      UPPER(usuario_nombre) LIKE '%WILLIAM%' OR
      UPPER(usuario_nombre) LIKE '%WILL%' OR
      UPPER(usuario_nombre) LIKE '%JAVIER%' OR
      UPPER(usuario_nombre) LIKE '%DANIEL%' OR
      UPPER(usuario_nombre) LIKE '%ESPINOZA%' OR
      UPPER(usuario_nombre) LIKE '%HUGO%' OR
      UPPER(usuario_nombre) LIKE '%ROJAS%' OR
      UPPER(usuario_nombre) LIKE '%PERCY%' OR
      UPPER(usuario_nombre) LIKE '%TORRES%' OR
      UPPER(usuario_nombre) LIKE '%DENIS%'
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
    WHEN UPPER(s.usuario_nombre) LIKE '%ROJAS%' OR UPPER(s.usuario_nombre) LIKE '%PERCY%' THEN 'Percy Rojas'
    WHEN UPPER(s.usuario_nombre) LIKE '%TORRES%' OR UPPER(s.usuario_nombre) LIKE '%DENIS%' THEN 'Denis Torres'
    ELSE s.usuario_nombre
  END,
  cuadrilla_ejecutora = CASE
    WHEN UPPER(s.usuario_nombre) LIKE '%CHAMBA%' OR UPPER(s.usuario_nombre) LIKE '%FLORES%' 
      OR UPPER(s.usuario_nombre) LIKE '%MARCO%' OR UPPER(s.usuario_nombre) LIKE '%JHONATAN%' 
      OR UPPER(s.usuario_nombre) LIKE '%TORRES%' OR UPPER(s.usuario_nombre) LIKE '%DENIS%' THEN 'CUADRILLA 1'
    WHEN UPPER(s.usuario_nombre) LIKE '%CASTRO%' OR UPPER(s.usuario_nombre) LIKE '%JUAN%' 
      OR UPPER(s.usuario_nombre) LIKE '%FERNANDEZ%' OR UPPER(s.usuario_nombre) LIKE '%FERNÁNDEZ%' 
      OR UPPER(s.usuario_nombre) LIKE '%WILLY%' THEN 'CUADRILLA 2'
    WHEN UPPER(s.usuario_nombre) LIKE '%CURI%' OR UPPER(s.usuario_nombre) LIKE '%ALFONSO%' 
      OR UPPER(s.usuario_nombre) LIKE '%AVILA%' OR UPPER(s.usuario_nombre) LIKE '%ÁVILA%' 
      OR UPPER(s.usuario_nombre) LIKE '%WILLIAM%' OR UPPER(s.usuario_nombre) LIKE '%WILL%' THEN 'CUADRILLA 3'
    WHEN UPPER(s.usuario_nombre) LIKE '%ESPINOZA%' OR UPPER(s.usuario_nombre) LIKE '%HUGO%' 
      OR UPPER(s.usuario_nombre) LIKE '%JAVIER%' OR UPPER(s.usuario_nombre) LIKE '%DANIEL%' 
      OR UPPER(s.usuario_nombre) LIKE '%ROJAS%' OR UPPER(s.usuario_nombre) LIKE '%PERCY%'
      OR o.id_sitio ILIKE 'AMEX%' OR o.id_obs ILIKE 'AMEX%' THEN 'CUADRILLA 4'
    ELSE 'CUADRILLA 1'
  END
FROM ultimas_solicitudes_campo s
WHERE o.id_obs = s.id_obs;

-- Paso 3: Notificar a PostgREST para recargar el esquema en caché
NOTIFY pgrst, 'reload schema';
