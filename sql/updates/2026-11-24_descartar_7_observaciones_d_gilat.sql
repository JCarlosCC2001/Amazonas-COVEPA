-- ==============================================================================
-- ACTUALIZACIÓN: DESCARTAR OBSERVACIONES POR GILAT AL 21/10/2026
-- Fecha: 24 de Noviembre de 2026
-- Observaciones: D-3090, D-3091, D-3095, D-3103, D-3104, D-3105, D-3120 (AM-0209-A01)
-- ==============================================================================

UPDATE public.observaciones
SET
  estado_covepa = 'Descartado',
  fecha_subsanacion = '2026-10-21T00:00:00+00:00'
WHERE id_obs IN (
  'D-3090',
  'D-3091',
  'D-3095',
  'D-3103',
  'D-3104',
  'D-3105',
  'D-3120'
);

NOTIFY pgrst, 'reload schema';
