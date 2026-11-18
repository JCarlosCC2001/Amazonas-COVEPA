-- =============================================================================
-- MIGRACIÓN: Actualización de Función RPC get_dashboard_kpis(p_proyecto)
-- =============================================================================
-- Objetivo:
--   Reemplazar las 10 consultas HEAD individuales de fetchObservacionesKPIs()
--   por una sola ejecución SQL en servidor (< 5 ms), incluyendo soporte para:
--   - Estados 'Pre-validado' y 'Crítico'
--   - Filtro de ámbito p_proyecto: 'todos' | 'original' | 'ampliacion'
--   - Regla de exclusión de 'Pendiente' con fecha_subsanacion histórica
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(p_proyecto TEXT DEFAULT 'todos')
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'pendientes', COUNT(*) FILTER (
      WHERE estado_covepa = 'Pendiente' OR estado_covepa IS NULL
    ),
    'solicitando', COUNT(*) FILTER (
      WHERE estado_covepa IN ('Solicitando Revisión', 'Solicitando Revision')
    ),
    'enRevision', COUNT(*) FILTER (
      WHERE estado_covepa IN ('En Revisión', 'En Revision')
    ),
    'documentacion', COUNT(*) FILTER (
      WHERE estado_covepa IN ('Documentación', 'Documentacion')
    ),
    'prevalidadas', COUNT(*) FILTER (
      WHERE estado_covepa IN ('Pre-validado', 'Pre-Validado', 'Prevalidado')
    ),
    'criticas', COUNT(*) FILTER (
      WHERE estado_covepa IN ('Crítico', 'Critico')
    ),
    'validadas', COUNT(*) FILTER (
      WHERE estado_covepa IN ('Validado', 'Enviado')
         OR (
           fecha_subsanacion IS NOT NULL
           AND COALESCE(estado_covepa, '') NOT IN (
             'Pendiente',
             'Descartado',
             'Crítico', 'Critico',
             'En Revision', 'En Revisión',
             'Solicitando Revision', 'Solicitando Revisión',
             'Rechazado',
             'Documentación', 'Documentacion',
             'Pre-validado', 'Pre-Validado', 'Prevalidado'
           )
         )
    ),
    'rechazadas', COUNT(*) FILTER (
      WHERE estado_covepa = 'Rechazado'
    ),
    'descartadas', COUNT(*) FILTER (
      WHERE estado_covepa = 'Descartado'
    )
  ) INTO result
  FROM public.observaciones
  WHERE
    CASE
      WHEN LOWER(COALESCE(p_proyecto, 'todos')) = 'ampliacion' THEN id_sitio LIKE 'AMEX%'
      WHEN LOWER(COALESCE(p_proyecto, 'todos')) = 'original'   THEN id_sitio NOT LIKE 'AMEX%'
      ELSE TRUE
    END;

  RETURN result;
END;
$$;
