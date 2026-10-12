-- Truekea seed: reference data

insert into public.categories (id, slug, name, icon, sort_order, kind) values
  (1, 'electronica', 'Electrónica', '📱', 1, 'object'),
  (2, 'hogar', 'Hogar', '🛋️', 2, 'object'),
  (3, 'ropa', 'Ropa', '👕', 3, 'object'),
  (4, 'libros-juegos', 'Libros y juegos', '📚', 4, 'object'),
  (5, 'deportes', 'Deportes', '⚽', 5, 'object'),
  (7, 'herramientas', 'Herramientas', '🔧', 7, 'object'),
  (20, 'musica-arte', 'Música y arte', '🎨', 20, 'knowledge'),
  (21, 'idiomas', 'Idiomas', '🗣️', 21, 'knowledge'),
  (22, 'cocina', 'Cocina', '🍳', 22, 'knowledge'),
  (23, 'bienestar', 'Deporte y bienestar', '🧘', 23, 'knowledge'),
  (24, 'tecnologia', 'Tecnología', '💻', 24, 'knowledge'),
  (25, 'academico', 'Académico', '📖', 25, 'knowledge'),
  (99, 'otros', 'Otros', '📦', 99, null)
on conflict (id) do update set name = excluded.name, icon = excluded.icon, sort_order = excluded.sort_order, kind = excluded.kind;

insert into public.feature_flags (key, enabled, payload) values
  ('ads_feed', false, '{"frequency": 10, "admob_unit_android": "", "admob_unit_ios": ""}'),
  ('wishlist_alerts', false, '{}')
on conflict (key) do nothing;

-- Curated safe meeting points in Lima (public, busy, well-lit places)
insert into public.meeting_points (name, description, address, district, location) values
  ('CC Real Plaza Salaverry — entrada principal', 'Centro comercial con seguridad y cámaras', 'Av. Felipe Salaverry 2370', 'Jesús María', st_setsrid(st_makepoint(-77.0523, -12.0894), 4326)),
  ('CC Jockey Plaza — puerta 1', 'Centro comercial con seguridad y cámaras', 'Av. Javier Prado Este 4200', 'Santiago de Surco', st_setsrid(st_makepoint(-76.9772, -12.0853), 4326)),
  ('CC Plaza San Miguel — entrada Av. La Marina', 'Centro comercial con seguridad y cámaras', 'Av. La Marina 2000', 'San Miguel', st_setsrid(st_makepoint(-77.0827, -12.0770), 4326)),
  ('Larcomar — plaza central', 'Centro comercial abierto con vigilancia', 'Malecón de la Reserva 610', 'Miraflores', st_setsrid(st_makepoint(-77.0300, -12.1317), 4326)),
  ('Parque Kennedy — atrio central', 'Parque concurrido con serenazgo permanente', 'Av. José Larco s/n', 'Miraflores', st_setsrid(st_makepoint(-77.0296, -12.1211), 4326)),
  ('Óvalo Gutiérrez — CC frente al cine', 'Zona comercial concurrida', 'Av. Santa Cruz 814', 'Miraflores', st_setsrid(st_makepoint(-77.0369, -12.1094), 4326)),
  ('Parque Central de Barranco', 'Plaza principal con serenazgo', 'Plaza de Armas de Barranco', 'Barranco', st_setsrid(st_makepoint(-77.0208, -12.1494), 4326)),
  ('CC El Polo — entrada principal', 'Centro comercial con seguridad', 'Av. El Polo 670', 'Santiago de Surco', st_setsrid(st_makepoint(-76.9694, -12.1069), 4326)),
  ('Plaza Mayor de Surco', 'Plaza principal con serenazgo', 'Plaza Mayor de Santiago de Surco', 'Santiago de Surco', st_setsrid(st_makepoint(-76.9917, -12.1544), 4326)),
  ('CC Mega Plaza — entrada principal', 'Centro comercial con seguridad y cámaras', 'Av. Alfredo Mendiola 3698', 'Independencia', st_setsrid(st_makepoint(-77.0614, -11.9942), 4326)),
  ('CC Plaza Norte — puerta 4', 'Centro comercial con seguridad y cámaras', 'Av. Alfredo Mendiola 1400', 'Independencia', st_setsrid(st_makepoint(-77.0567, -12.0064), 4326)),
  ('CC Mall del Sur — entrada principal', 'Centro comercial con seguridad y cámaras', 'Av. Los Lirios 301', 'San Juan de Miraflores', st_setsrid(st_makepoint(-76.9714, -12.1544), 4326)),
  ('CC Minka — entrada Av. Argentina', 'Centro comercial con seguridad', 'Av. Argentina 3093', 'Callao', st_setsrid(st_makepoint(-77.1119, -12.0464), 4326)),
  ('Parque de la Exposición — entrada Av. 28 de Julio', 'Parque con vigilancia en el centro de Lima', 'Av. 28 de Julio s/n', 'Cercado de Lima', st_setsrid(st_makepoint(-77.0364, -12.0611), 4326)),
  ('CC La Rambla San Borja — entrada principal', 'Centro comercial con seguridad', 'Av. Javier Prado Este 2050', 'San Borja', st_setsrid(st_makepoint(-77.0028, -12.0872), 4326)),
  ('Pentagonito — puerta principal', 'Zona de paseo muy concurrida y vigilada', 'Av. Del Parque Sur s/n', 'San Borja', st_setsrid(st_makepoint(-76.9950, -12.1000), 4326)),
  ('Plaza San Miguel de La Molina (CC Molina Plaza)', 'Zona comercial con seguridad', 'Av. Raúl Ferrero 1205', 'La Molina', st_setsrid(st_makepoint(-76.9469, -12.0850), 4326)),
  ('CC Agustino Plaza — entrada principal', 'Centro comercial con seguridad', 'Av. Ferrocarril 1035', 'El Agustino', st_setsrid(st_makepoint(-77.0092, -12.0447), 4326)),
  ('Parque Universitario PUCP — puerta principal', 'Campus con vigilancia (requiere acceso)', 'Av. Universitaria 1801', 'San Miguel', st_setsrid(st_makepoint(-77.0797, -12.0692), 4326)),
  ('Plaza de Armas de Magdalena', 'Plaza principal con serenazgo', 'Jr. Junín cdra. 5', 'Magdalena del Mar', st_setsrid(st_makepoint(-77.0742, -12.0906), 4326));
