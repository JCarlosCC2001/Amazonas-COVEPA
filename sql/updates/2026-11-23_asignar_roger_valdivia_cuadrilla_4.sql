-- ============================================================================
-- ACTUALIZACIÓN MANUAL: ASIGNACIÓN A ROGER VALDIVIA Y CUADRILLA 4
-- Fecha: 23 de Noviembre de 2026
-- Objetivo: Asignar como técnico ejecutor a Roger Valdivia y cuadrilla ejecutora
--           a CUADRILLA 4 para 31 observaciones de sitios AMEX (AMEX-0332 y AMEX-0334).
-- ============================================================================

UPDATE public.observaciones
SET
  tecnico_ejecutor = 'Roger Valdivia',
  cuadrilla_ejecutora = 'CUADRILLA 4'
WHERE id_obs IN (
  'AM-H1-OC-50-91',
  'AMEX-H3-100-555',
  'AM-H1-OC-50-103',
  'AM-H1-OC-50-95',
  'AM-H1-OC-50-99',
  'AM-H1-SH-50-2',
  'AMEX-H3-100-560',
  'AMEX-H3-100-582',
  'AMEX-H3-100-583',
  'AM-H1-OC-100-459',
  'AM-H1-OC-100-482',
  'AM-H1-OC-100-493',
  'AM-H1-OC-100-504',
  'AM-H1-OC-100-512',
  'AMEX-H3-100-513',
  'AMEX-H3-100-527',
  'AM-H1-OC-100-462',
  'AM-H1-OC-100-478',
  'AM-H1-OC-100-487',
  'AM-H1-OC-100-489',
  'AM-H1-OC-100-505',
  'AMEX-H3-100-523',
  'AM-H1-OC-100-457',
  'AM-H1-OC-100-501',
  'AM-H1-OC-100-502',
  'AM-H1-OC-100-503',
  'AM-H1-OC-100-513',
  'AM-H1-OC-100-514',
  'AMEX-H3-100-529',
  'AM-H1-OC-100-485',
  'AM-H1-OC-100-497'
);

NOTIFY pgrst, 'reload schema';
