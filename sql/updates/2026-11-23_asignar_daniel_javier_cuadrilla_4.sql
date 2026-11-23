-- ============================================================================
-- ACTUALIZACIÓN MANUAL: ASIGNACIÓN A DANIEL JAVIER Y CUADRILLA 4
-- Fecha: 23 de Noviembre de 2026
-- Objetivo: Asignar como técnico ejecutor a Daniel Javier y cuadrilla ejecutora
--           a CUADRILLA 4 para 12 observaciones de sitios AMEX.
-- ============================================================================

UPDATE public.observaciones
SET
  tecnico_ejecutor = 'Daniel Javier',
  cuadrilla_ejecutora = 'CUADRILLA 4'
WHERE id_obs IN (
  'AM-H1-OC-100-464',
  'AM-H1-OC-100-491',
  'AM-H1-OC-100-494',
  'AM-H1-OC-100-499',
  'AM-H1-OC-100-469',
  'AM-H1-OC-100-495',
  'AM-H1-OC-100-498',
  'AM-H1-OC-100-500',
  'AM-H1-OC-100-766',
  'AM-H1-OC-100-786',
  'AMEX-H3-100-810',
  'AMEX-H3-100-824'
);

NOTIFY pgrst, 'reload schema';
