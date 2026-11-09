-- ==============================================================================
-- Script de Reasignación: Cuadrilla 6 (Gabriel Farro -> Juan Castro) y Sitio AM-0177-A01
-- Fecha: 2026-11-09
-- Motivo: Asignar oficialmente las jornadas del 08 y 09 de noviembre a Juan Castro,
--         transferir AM-0177-A01 (LA VICTORIA) de William Avila a Juan Castro,
--         y actualizar el historial del 07 de noviembre.
-- ==============================================================================

DO $$
DECLARE
  v_juan_id UUID := '84444118-163f-4568-8040-e60e1824fd73';
  v_farro_id UUID := '58bf102a-514f-4829-806b-1037856cadb1';
  v_prog_08 UUID;
  v_prog_09 UUID;
BEGIN
  -- 1. Actualizar programación del sábado 2026-11-07 si aún figuraba Gabriel Farro
  UPDATE public.programaciones
  SET id_tecnico = v_juan_id
  WHERE id_tecnico = v_farro_id AND fecha = '2026-11-07';

  -- 2. Asegurar programación de Juan Castro para el día de ayer (2026-11-08)
  SELECT id INTO v_prog_08
  FROM public.programaciones
  WHERE id_tecnico = v_juan_id AND fecha = '2026-11-08';

  IF v_prog_08 IS NULL THEN
    INSERT INTO public.programaciones (id, id_tecnico, fecha, notas, created_at)
    VALUES (
      gen_random_uuid(),
      v_juan_id,
      '2026-11-08',
      '{"personal_ids":["' || v_juan_id || '"],"texto":"Levantamiento de Observaciones en AM-0177-A01 - LA VICTORIA"}',
      NOW()
    )
    RETURNING id INTO v_prog_08;
  END IF;

  -- Mover AM-0177-A01 a la programación de Juan Castro del 2026-11-08
  UPDATE public.programacion_sitios
  SET id_programacion = v_prog_08
  WHERE id_sitio = 'AM-0177-A01'
    AND id_programacion IN (SELECT id FROM public.programaciones WHERE fecha = '2026-11-08');

  -- 3. Asegurar programación de Juan Castro para el día de hoy (2026-11-09)
  SELECT id INTO v_prog_09
  FROM public.programaciones
  WHERE id_tecnico = v_juan_id AND fecha = '2026-11-09';

  IF v_prog_09 IS NULL THEN
    INSERT INTO public.programaciones (id, id_tecnico, fecha, notas, created_at)
    VALUES (
      gen_random_uuid(),
      v_juan_id,
      '2026-11-09',
      '{"personal_ids":["' || v_juan_id || '"],"texto":"Levantamiento de Observaciones en AM-0177-A01 - LA VICTORIA"}',
      NOW()
    )
    RETURNING id INTO v_prog_09;
  END IF;

  -- Mover AM-0177-A01 a la programación de Juan Castro del 2026-11-09
  UPDATE public.programacion_sitios
  SET id_programacion = v_prog_09
  WHERE id_sitio = 'AM-0177-A01'
    AND id_programacion IN (SELECT id FROM public.programaciones WHERE fecha = '2026-11-09');

  -- 4. Registrar la asignación oficial de AM-0177 a CUADRILLA 6 en sitios_cuadrillas
  INSERT INTO public.sitios_cuadrillas (id_site, cuadrilla, zona, activo)
  VALUES 
    ('AM-0177-A01', 'CUADRILLA 6', 'ZONA 7', true),
    ('AM-0177-HS01', 'CUADRILLA 6', 'ZONA 7', true)
  ON CONFLICT (id_site) DO UPDATE
  SET cuadrilla = 'CUADRILLA 6', zona = 'ZONA 7', activo = true;

END $$;
