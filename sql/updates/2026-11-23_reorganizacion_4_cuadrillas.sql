-- ==============================================================================
-- ACTUALIZACIÓN OFICIAL: REORGANIZACIÓN EN 4 CUADRILLAS OPERATIVAS (PAREJAS DE TÉCNICOS)
-- Fecha: 23 de Noviembre de 2026
-- Proyecto: Amazonas-COVEPA
-- ==============================================================================

-- 1. ACTUALIZACIÓN DE CUADRILLAS EN PERSONAL (personal_cuadrillas)
-- Desactivar asignaciones obsoletas de conductores y personal previo
UPDATE public.personal_cuadrillas
SET cuadrilla = 'SIN CUADRILLA', activo = false, updated_at = NOW()
WHERE id_personal NOT IN (
  '554a3a58-bf04-480a-8795-d85e055ee4c6', -- Jhonatan Flores (C1)
  '4f9d2cc7-3a88-42f9-b9ac-e97eec0277fe', -- Marco Chamba (C1)
  '84444118-163f-4568-8040-e60e1824fd73', -- Juan Castro (C2)
  '61d6e0fc-81ae-4e84-9841-1436795d27fd', -- Willy Fernández (C2)
  '4b56f618-981f-4f2a-a901-4a4de4543899', -- Alfonso Curi (C3)
  '19ff0cdf-7afc-4e50-94b2-f1a9998de148', -- William Avila (C3)
  '98a85d5b-9514-43f6-ae29-6a8c2ef6d06c', -- Hugo Espinoza (C4)
  '05db4c32-3c7a-42e4-a0aa-8ac33dd5c75f'  -- Daniel Javier (C4)
);

-- Cuadrilla 1: Jhonatan Flores y Marco Chamba
INSERT INTO public.personal_cuadrillas (id_personal, cargo, cuadrilla, activo, updated_at)
VALUES 
  ('554a3a58-bf04-480a-8795-d85e055ee4c6', 'TÉCNICO', 'CUADRILLA 1', true, NOW()),
  ('4f9d2cc7-3a88-42f9-b9ac-e97eec0277fe', 'TÉCNICO', 'CUADRILLA 1', true, NOW())
ON CONFLICT (id_personal) 
DO UPDATE SET cuadrilla = EXCLUDED.cuadrilla, cargo = EXCLUDED.cargo, activo = true, updated_at = NOW();

-- Cuadrilla 2: Juan Castro y Willy Fernández
INSERT INTO public.personal_cuadrillas (id_personal, cargo, cuadrilla, activo, updated_at)
VALUES 
  ('84444118-163f-4568-8040-e60e1824fd73', 'TÉCNICO', 'CUADRILLA 2', true, NOW()),
  ('61d6e0fc-81ae-4e84-9841-1436795d27fd', 'SUPERVISOR', 'CUADRILLA 2', true, NOW())
ON CONFLICT (id_personal) 
DO UPDATE SET cuadrilla = EXCLUDED.cuadrilla, cargo = EXCLUDED.cargo, activo = true, updated_at = NOW();

-- Cuadrilla 3: Alfonso Curi y William Avila
INSERT INTO public.personal_cuadrillas (id_personal, cargo, cuadrilla, activo, updated_at)
VALUES 
  ('4b56f618-981f-4f2a-a901-4a4de4543899', 'TÉCNICO', 'CUADRILLA 3', true, NOW()),
  ('19ff0cdf-7afc-4e50-94b2-f1a9998de148', 'SUPERVISOR', 'CUADRILLA 3', true, NOW())
ON CONFLICT (id_personal) 
DO UPDATE SET cuadrilla = EXCLUDED.cuadrilla, cargo = EXCLUDED.cargo, activo = true, updated_at = NOW();

-- Cuadrilla 4: Hugo Espinoza y Daniel Javier
INSERT INTO public.personal_cuadrillas (id_personal, cargo, cuadrilla, activo, updated_at)
VALUES 
  ('98a85d5b-9514-43f6-ae29-6a8c2ef6d06c', 'TÉCNICO', 'CUADRILLA 4', true, NOW()),
  ('05db4c32-3c7a-42e4-a0aa-8ac33dd5c75f', 'TÉCNICO', 'CUADRILLA 4', true, NOW())
ON CONFLICT (id_personal) 
DO UPDATE SET cuadrilla = EXCLUDED.cuadrilla, cargo = EXCLUDED.cargo, activo = true, updated_at = NOW();


-- 2. ACTUALIZACIÓN DE SITIOS DE AMPLIACIÓN (sitios_cuadrillas)
-- Asignar Cuadrilla 4 a todos los sitios de Ampliación
UPDATE public.sitios_cuadrillas
SET cuadrilla = 'CUADRILLA 4', updated_at = NOW()
WHERE cuadrilla = 'CUADRILLA 7' OR id_site LIKE 'AMEX%';
