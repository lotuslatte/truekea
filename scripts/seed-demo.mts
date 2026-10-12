// Truekea — siembra de contenido demo contra un proyecto Supabase real.
//
// Crea dos usuarios demo (con teléfono confirmado y contraseña, así el script
// puede iniciar sesión sin SMS), ~12 publicaciones con fotos, y un escenario
// vivo entre ellos usando la máquina de estados real (RPCs): una oferta
// pendiente, un trueke acordado con chat, y un trueke completado con
// calificaciones. Es idempotente: se puede correr varias veces.
//
// Uso:
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-demo.mts
// (SUPABASE_URL y ANON_KEY se leen de .env si no están en el entorno)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

function envFromDotenv(): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].trim();
    }
    return out;
  } catch {
    return {};
  }
}

const dotenv = envFromDotenv();
const URL_ = process.env.SUPABASE_URL ?? dotenv.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY ?? dotenv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !ANON || !SERVICE) {
  console.error('Faltan credenciales: SUPABASE_URL / SUPABASE_ANON_KEY (o .env) y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'change-me';

type DemoUser = {
  phone: string;
  username: string;
  displayName: string;
  district: string;
  bio: string;
  lat: number;
  lng: number;
};

const USERS: DemoUser[] = [
  {
    phone: '51911111111',
    username: 'vale_miraflores',
    displayName: 'Vale Rojas',
    district: 'Miraflores',
    bio: 'Fan de darle segunda vida a todo 🌱',
    lat: -12.1211,
    lng: -77.0297,
  },
  {
    phone: '51922222222',
    username: 'jorge_surco',
    displayName: 'Jorge Campos',
    district: 'Santiago de Surco',
    bio: 'Cambio lo que no uso por lo que sí.',
    lat: -12.1356,
    lng: -76.9928,
  },
];

type DemoItem = {
  owner: string; // username
  slug: string;
  title: string;
  description: string;
  category: number;
  value: number | null;
  lookingFor: string | null;
  donation?: boolean;
  kind?: 'object' | 'knowledge';
  noPhoto?: boolean;
};

const ITEMS: DemoItem[] = [
  { owner: 'vale_miraflores', slug: 'guitarra', title: 'Guitarra acústica Yamaha', description: 'Guitarra Yamaha C40, cuerdas nuevas, suena lindo. La usé un año y ahora junta polvo.', category: 8, value: 350, lookingFor: 'Bicicleta o tablet' },
  { owner: 'vale_miraflores', slug: 'cafetera', title: 'Cafetera italiana 6 tazas', description: 'Moka clásica de aluminio, casi sin uso. Hace un café buenazo.', category: 2, value: 60, lookingFor: 'Plantas o libros de cocina' },
  { owner: 'vale_miraflores', slug: 'libros-garcia', title: 'Colección García Márquez (5 libros)', description: 'Cien años de soledad, El amor en los tiempos del cólera y 3 más. Buen estado.', category: 4, value: 90, lookingFor: 'Otros libros o juegos de mesa' },
  { owner: 'vale_miraflores', slug: 'monitor', title: 'Monitor LG 24" Full HD', description: 'Monitor IPS con HDMI, cero píxeles muertos. Vendí mi PC y ya no lo necesito.', category: 1, value: 280, lookingFor: 'Silla de escritorio o audífonos buenos' },
  { owner: 'vale_miraflores', slug: 'macetas', title: 'Macetas de cerámica (juego de 4)', description: 'Macetas artesanales de distintos tamaños. Regalo porque me mudo.', category: 10, value: null, lookingFor: null, donation: true },
  { owner: 'vale_miraflores', slug: 'raqueta', title: 'Raqueta de tenis Wilson', description: 'Raqueta Wilson Pro, grip recién cambiado. Incluye funda.', category: 5, value: 180, lookingFor: 'Pesas o banda de correr chica' },
  { owner: 'jorge_surco', slug: 'bici', title: 'Bicicleta montañera aro 26', description: 'Bici GT con frenos de disco, mantenimiento reciente. La cambio porque me compré una de ruta.', category: 5, value: 420, lookingFor: 'Instrumento musical o consola' },
  { owner: 'jorge_surco', slug: 'taladro', title: 'Taladro Bosch + juego de brocas', description: 'Taladro percutor 650W con maletín y 20 brocas. Poco uso.', category: 7, value: 200, lookingFor: 'Herramientas de jardín o escalera' },
  { owner: 'jorge_surco', slug: 'lego', title: 'LEGO Technic camión volquete', description: 'Set completo con manual, armado una sola vez. Ideal para niños 9+.', category: 6, value: 150, lookingFor: 'Juegos de mesa o libros infantiles' },
  { owner: 'jorge_surco', slug: 'zapatillas', title: 'Zapatillas Nike Pegasus talla 42 (nuevas)', description: 'Me quedaron chicas, están con etiqueta. Talla 42 US 9.', category: 3, value: 260, lookingFor: 'Zapatillas 43 o ropa deportiva L' },
  { owner: 'jorge_surco', slug: 'ropa-bebe', title: 'Ropa de bebé 0-6 meses (lote)', description: 'Bolsa grande de bodies, pijamas y gorritos. Todo limpio y en buen estado. Lo regalo.', category: 9, value: null, lookingFor: null, donation: true },
  { owner: 'jorge_surco', slug: 'parlante', title: 'Parlante JBL Flip 5', description: 'Sonido potente, batería dura ~10 horas. Con cable y funda.', category: 1, value: 300, lookingFor: 'Teclado mecánico o monitor' },
  { owner: 'vale_miraflores', slug: 'clases-piano', title: 'Clases de piano para principiantes', description: 'Sesiones de 1 hora, en Miraflores o por videollamada. Toco hace 10 años y he enseñado a niños y adultos. Aprende tu primera canción en un mes.', category: 8, value: null, lookingFor: 'Un libro que te haya marcado, o plantas', kind: 'knowledge', noPhoto: true },
  { owner: 'jorge_surco', slug: 'clases-ingles', title: 'Inglés conversacional, 1 a 1', description: 'Practica conversación real para viajes o trabajo. Sesiones de 45 min, nivel básico a intermedio. Certificado C1.', category: 99, value: null, lookingFor: 'Herramientas o algo para mi bici', kind: 'knowledge', noPhoto: true },
  { owner: 'vale_miraflores', slug: 'taller-plantas', title: 'Te enseño a cuidar tus plantas', description: 'Taller práctico en tu casa: riego, luz, sustrato y cómo revivir esa planta que ya diste por perdida.', category: 10, value: null, lookingFor: 'Macetas, semillas o un buen café', kind: 'knowledge', noPhoto: true },
];

// Ítems dedicados a los escenarios (no tocar los del feed):
const SCENARIO_ITEMS: DemoItem[] = [
  { owner: 'vale_miraflores', slug: 'polaroid', title: 'Cámara instantánea Fujifilm', description: 'Instax Mini 11 con 10 películas. Funciona perfecto.', category: 1, value: 220, lookingFor: 'Audífonos o parlante' },
  { owner: 'jorge_surco', slug: 'audifonos', title: 'Audífonos Sony WH-CH720', description: 'Bluetooth, cancelación de ruido, con estuche.', category: 1, value: 250, lookingFor: 'Cámara o smartwatch' },
  { owner: 'vale_miraflores', slug: 'patines', title: 'Patines en línea talla 40', description: 'Patines Rollerblade, poco uso, con protecciones.', category: 5, value: 160, lookingFor: 'Lo que me sorprenda' },
  { owner: 'jorge_surco', slug: 'mochila', title: 'Mochila de trekking 40L', description: 'Mochila Quechua 40 litros, impermeable.', category: 5, value: 140, lookingFor: 'Carpa o cocinilla de camping' },
];

const wkt = (lng: number, lat: number) => `POINT(${lng} ${lat})`;

async function ensureUser(u: DemoUser): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    phone: `+${u.phone}`,
    phone_confirm: true,
    password: DEMO_PASSWORD,
  });
  let userId = data?.user?.id;
  if (error) {
    // Ya existe: búscalo por teléfono
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    userId = list?.users.find((x) => x.phone === u.phone || x.phone === `+${u.phone}`)?.id;
    if (!userId) throw new Error(`No pude crear ni encontrar al usuario ${u.username}: ${error.message}`);
    await admin.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD });
  }
  const { error: pErr } = await admin.from('profiles').upsert(
    {
      id: userId,
      username: u.username,
      display_name: u.displayName,
      district: u.district,
      bio: u.bio,
      location: wkt(u.lng, u.lat),
    },
    { onConflict: 'id' },
  );
  if (pErr) throw new Error(`profiles upsert ${u.username}: ${pErr.message}`);
  console.log(`✓ usuario ${u.username} (${userId})`);
  return userId!;
}

async function ensureItem(spec: DemoItem, ownerId: string, coords: { lat: number; lng: number }, district: string): Promise<string> {
  const { data: existing } = await admin
    .from('items')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('title', spec.title)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: item, error } = await admin
    .from('items')
    .insert({
      owner_id: ownerId,
      category_id: spec.category,
      title: spec.title,
      description: spec.description,
      estimated_value_pen: spec.donation ? null : spec.value,
      looking_for: spec.lookingFor,
      is_donation: spec.donation ?? false,
      kind: spec.kind ?? 'object',
      district,
      location: wkt(coords.lng, coords.lat),
      status: 'available',
    })
    .select('id')
    .single();
  if (error) throw new Error(`items insert ${spec.slug}: ${error.message}`);

  // Foto placeholder determinística por slug (los saberes pueden ir sin foto)
  if (spec.noPhoto) {
    console.log(`✓ item ${spec.title} (sin foto)`);
    return item.id;
  }
  const photoRes = await fetch(`https://picsum.photos/seed/truekea-${spec.slug}/800/600.jpg`);
  if (photoRes.ok) {
    const buf = await photoRes.arrayBuffer();
    const path = `${ownerId}/demo-${spec.slug}.jpg`;
    const { error: upErr } = await admin.storage
      .from('item-photos')
      .upload(path, buf, { contentType: 'image/jpeg', upsert: true });
    if (!upErr) {
      await admin.from('item_photos').insert({ item_id: item.id, storage_path: path, position: 0 });
    } else {
      console.warn(`  (sin foto para ${spec.slug}: ${upErr.message})`);
    }
  } else {
    console.warn(`  (no pude descargar foto para ${spec.slug})`);
  }
  console.log(`✓ item ${spec.title}`);
  return item.id;
}

async function signIn(phone: string): Promise<SupabaseClient> {
  const client = createClient(URL_!, ANON!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ phone: `+${phone}`, password: DEMO_PASSWORD });
  if (error) throw new Error(`signIn ${phone}: ${error.message}`);
  return client;
}

async function main() {
  const ids: Record<string, string> = {};
  for (const u of USERS) ids[u.username] = await ensureUser(u);

  const byUser = (username: string) => USERS.find((u) => u.username === username)!;
  const itemIds: Record<string, string> = {};
  for (const spec of [...ITEMS, ...SCENARIO_ITEMS]) {
    const owner = byUser(spec.owner);
    itemIds[spec.slug] = await ensureItem(spec, ids[spec.owner], { lat: owner.lat, lng: owner.lng }, owner.district);
  }

  // Regalo perecible demo: comida que se rescata hoy
  const { data: existingFood } = await admin
    .from('items').select('id, pickup_until, status').eq('title', 'Tallarines verdes recién hechos (2 porciones)').maybeSingle();
  const tonight = new Date();
  tonight.setHours(21, 0, 0, 0);
  if (tonight.getTime() < Date.now()) tonight.setDate(tonight.getDate() + 1);
  if (!existingFood) {
    const vale = byUser('vale_miraflores');
    const { error: fErr } = await admin.from('items').insert({
      owner_id: ids.vale_miraflores,
      category_id: 99,
      title: 'Tallarines verdes recién hechos (2 porciones)',
      description: 'Cociné de más 🍝 Dos porciones generosas de tallarines verdes con papa a la huancaína. Recién hechos hoy, en tápers limpios. ¡Que no se boten!',
      looking_for: null,
      is_donation: true,
      kind: 'object',
      pickup_until: tonight.toISOString(),
      district: vale.district,
      location: wkt(vale.lng, vale.lat),
      status: 'available',
    });
    if (fErr) throw new Error(`perecible demo: ${fErr.message}`);
    console.log('✓ regalo perecible demo (tallarines, recojo hasta las 9pm)');
  } else {
    // renovar la hora límite para que siga visible en demos
    await admin.from('items').update({ pickup_until: tonight.toISOString(), status: 'available' }).eq('id', existingFood.id);
    console.log('✓ perecible demo renovado');
  }

  // Círculo de saber demo (ejercita join_circle/respond_circle_request)
  const { data: existingCircle } = await admin
    .from('items').select('id').eq('title', 'Círculo de ajedrez en el parque').maybeSingle();
  if (!existingCircle) {
    const nextSaturday = new Date();
    nextSaturday.setDate(nextSaturday.getDate() + ((6 - nextSaturday.getDay() + 7) % 7 || 7));
    nextSaturday.setHours(16, 0, 0, 0);
    const valeUser = byUser('vale_miraflores');
    const { data: circle, error: cErr } = await admin.from('items').insert({
      owner_id: ids.vale_miraflores,
      category_id: 6,
      title: 'Círculo de ajedrez en el parque',
      description: 'Tarde de ajedrez para principiantes: reglas, aperturas básicas y partidas guiadas. Trae tus ganas — los tableros los pongo yo.',
      looking_for: 'Trae un libro usado o algo rico para compartir',
      is_donation: false,
      kind: 'knowledge',
      format: 'circle',
      modality: 'in_person',
      event_at: nextSaturday.toISOString(),
      capacity: 6,
      district: valeUser.district,
      location: wkt(valeUser.lng, valeUser.lat),
      status: 'available',
    }).select('id').single();
    if (cErr) throw new Error(`círculo demo: ${cErr.message}`);

    const jorgeClient = await signIn(byUser('jorge_surco').phone);
    const { data: memberId, error: jErr } = await jorgeClient.rpc('join_circle', {
      p_item_id: circle.id,
      p_offering: 'Llevo una colección de cuentos y galletas de avena 🍪',
    });
    if (jErr) throw new Error(`join_circle: ${jErr.message}`);

    const valeClient = await signIn(valeUser.phone);
    const { error: rErr } = await valeClient.rpc('respond_circle_request', {
      p_member_id: memberId,
      p_accept: true,
    });
    if (rErr) throw new Error(`respond_circle_request: ${rErr.message}`);
    console.log('✓ círculo demo: ajedrez en el parque (Jorge con cupo aceptado + chat grupal)');
  } else {
    console.log('✓ círculo demo ya existe');
  }

  // ¿Escenarios ya sembrados? (idempotencia)
  const { data: anyTrade } = await admin.from('trades').select('id').limit(1).maybeSingle();
  if (anyTrade) {
    console.log('✓ escenarios ya existen, no se duplican');
    return;
  }

  const vale = await signIn(byUser('vale_miraflores').phone);
  const jorge = await signIn(byUser('jorge_surco').phone);
  const jorgeId = ids.jorge_surco;
  const valeId = ids.vale_miraflores;

  // 1) Oferta PENDIENTE: Jorge ofrece sus audífonos por la cámara de Vale (+ S/ 20)
  const { error: o1Err } = await jorge.from('offers').insert({
    item_id: itemIds.polaroid,
    offerer_id: jorgeId,
    offered_item_id: itemIds.audifonos,
    cash_top_up_pen: 20,
    message: '¡Hola! Mis audífonos están casi nuevos, te sumo 20 soles. ¿Te animas?',
  });
  if (o1Err) throw new Error(`oferta pendiente: ${o1Err.message}`);
  console.log('✓ escenario: oferta pendiente (audífonos ↔ cámara + S/20)');

  // 2) Trueke ACORDADO con chat: Vale ofrece patines por la mochila de Jorge; Jorge acepta
  const { data: offer2, error: o2Err } = await vale
    .from('offers')
    .insert({
      item_id: itemIds.mochila,
      offerer_id: valeId,
      offered_item_id: itemIds.patines,
      cash_top_up_pen: 0,
      message: 'Mis patines por tu mochila, ¡trato directo!',
    })
    .select('id')
    .single();
  if (o2Err) throw new Error(`oferta 2: ${o2Err.message}`);

  const { data: tradeId, error: aErr } = await jorge.rpc('accept_offer', { p_offer_id: offer2.id });
  if (aErr) throw new Error(`accept_offer: ${aErr.message}`);

  const { data: chat } = await jorge.from('chats').select('id').eq('trade_id', tradeId).single();
  const send = async (client: SupabaseClient, sender: string, body: string) => {
    const { error } = await client.from('messages').insert({ chat_id: chat!.id, sender_id: sender, body });
    if (error) throw new Error(`mensaje: ${error.message}`);
  };
  await send(jorge, jorgeId, '¡Acepté tu oferta! ¿Cuándo puedes?');
  await send(vale, valeId, 'El sábado por la tarde me queda bien 😊');
  await send(jorge, jorgeId, 'Perfecto. ¿Te parece en el Parque Kennedy?');
  console.log(`✓ escenario: trueke acordado con chat (patines ↔ mochila), trade ${tradeId}`);

  console.log('\nListo 🌱 Datos demo sembrados.');
  console.log(`Cuentas demo (contraseña ${DEMO_PASSWORD}):`);
  for (const u of USERS) console.log(`  +${u.phone} — ${u.displayName} (@${u.username})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
