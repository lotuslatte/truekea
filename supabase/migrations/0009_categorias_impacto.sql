-- Truekea 0009: categorías reducidas y separadas por tipo (objetos vs saberes)
-- + impacto comunitario (CO₂ evitado).

-- 1. Las categorías declaran a qué tipo aplican (null = ambos, ej. Otros)
alter table public.categories add column kind public.item_kind;

-- 2. Nuevas categorías de saberes
insert into public.categories (id, slug, name, icon, sort_order, kind) values
  (20, 'musica-arte', 'Música y arte', '🎨', 20, 'knowledge'),
  (21, 'idiomas', 'Idiomas', '🗣️', 21, 'knowledge'),
  (22, 'cocina', 'Cocina', '🍳', 22, 'knowledge'),
  (23, 'bienestar', 'Deporte y bienestar', '🧘', 23, 'knowledge'),
  (24, 'tecnologia', 'Tecnología', '💻', 24, 'knowledge'),
  (25, 'academico', 'Académico', '📖', 25, 'knowledge')
on conflict (id) do nothing;

-- 3. Remapear saberes existentes a sus categorías nuevas (antes del remap genérico)
update public.items set category_id = 20 where kind = 'knowledge' and category_id = 8;   -- música
update public.items set category_id = 21 where kind = 'knowledge' and category_id = 99;  -- idiomas/otros → idiomas (demo)
update public.items set category_id = 23 where kind = 'knowledge' and category_id = 10;  -- plantas → bienestar
update public.items set category_id = 25 where kind = 'knowledge' and category_id in (4, 6); -- juegos mentales → académico
update public.items set category_id = 25 where kind = 'knowledge' and category_id < 20;  -- resto de saberes huérfanos

-- 4. Remapear objetos de las categorías que se van
update public.items set category_id = 4 where category_id = 6;   -- Juguetes → Libros y juegos
update public.items set category_id = 3 where category_id = 9;   -- Bebés y niños → Ropa
update public.items set category_id = 2 where category_id = 10;  -- Plantas y jardín → Hogar
update public.items set category_id = 99 where category_id = 8;  -- Música e instrumentos → Otros
update public.wishlists set category_id = null where category_id in (6, 8, 9, 10);

-- 5. Renombrar y etiquetar las que quedan
update public.categories set name = 'Ropa', kind = 'object' where id = 3;
update public.categories set name = 'Libros y juegos', icon = '📚', kind = 'object' where id = 4;
update public.categories set kind = 'object' where id in (1, 2, 5, 7);
update public.categories set kind = null where id = 99; -- Otros aplica a ambos

-- 6. Adiós a las demás
delete from public.categories where id in (6, 8, 9, 10);

-- 7. Impacto comunitario: objetos que cambiaron de manos y CO₂ estimado
-- (≈5 kg CO₂e por objeto reutilizado que no se fabrica nuevo — estimación conservadora)
create or replace function public.community_impact()
returns table (items_saved integer, circles_held integer, co2_kg numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::integer from public.items where status = 'traded' and kind = 'object'),
    (select count(*)::integer from public.items where status = 'traded' and format = 'circle'),
    (select count(*) * 5 from public.items where status = 'traded' and kind = 'object')::numeric
$$;

grant execute on function public.community_impact to anon, authenticated;
