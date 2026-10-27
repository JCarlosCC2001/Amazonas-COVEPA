-- ==============================================================================
-- REGISTRAR AUDITORES OFICIALES DE GILAT EN LA BASE DE DATOS EXTERNA
-- Proyecto: Amazonas-COVEPA / SELNET
-- Destino: Base de Datos EXTERNA (Amazonas-SELNET — iiwmqvnjjhaapyolaity)
-- Tabla: public.personal
-- ==============================================================================

INSERT INTO public.personal (id_personal, nombre, apellido, cargo, empresa, estado)
VALUES
  ('c3a1b021-71e4-4a25-9c88-123456789abc', 'AMILCAR', 'HANDER', 'Auditor Gilat', 'Gilat Networks', 'Activo'),
  ('d4b2c132-82f5-4b36-ad99-234567890bcd', 'THALIA', 'URQUIZO', 'Auditora Gilat', 'Gilat Networks', 'Activo')
ON CONFLICT (id_personal) DO UPDATE 
SET 
  nombre = EXCLUDED.nombre,
  apellido = EXCLUDED.apellido,
  cargo = EXCLUDED.cargo,
  empresa = EXCLUDED.empresa,
  estado = EXCLUDED.estado;
