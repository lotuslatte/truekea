// Truekea — fan-out de notificaciones push vía Expo.
// Se invoca con un Database Webhook de Supabase: INSERT en public.notifications.
// Como todos los eventos del dominio (ofertas, mensajes, truekes, calificaciones)
// escriben en notifications vía notify_user(), este único webhook cubre todo.
//
// Config: Dashboard → Database → Webhooks → tabla notifications, evento INSERT,
// tipo "Supabase Edge Function" → send-push.

import { createClient } from 'npm:@supabase/supabase-js@2';

type NotificationRecord = {
  id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
};

function buildMessage(record: NotificationRecord): { title: string; body: string; url: string } | null {
  const p = record.payload ?? {};
  switch (record.type) {
    case 'new_offer':
      return {
        title: 'Nueva oferta 🌱',
        body: `Te ofrecen un trueke por «${p.item_title ?? 'tu objeto'}»`,
        url: `/oferta/${p.offer_id}`,
      };
    case 'offer_countered':
      return {
        title: 'Contraoferta 🔄',
        body: `Te hicieron una contraoferta por «${p.item_title ?? 'tu objeto'}»`,
        url: `/oferta/${p.offer_id}`,
      };
    case 'offer_accepted':
      return {
        title: '¡Aceptaron tu oferta! 🎉',
        body: `Tu trueke por «${p.item_title ?? ''}» está en marcha. Coordina la entrega.`,
        url: `/trueke/${p.trade_id}`,
      };
    case 'offer_rejected':
      return {
        title: 'Oferta rechazada',
        body: `Tu oferta por «${p.item_title ?? ''}» no fue aceptada esta vez.`,
        url: `/ofertas`,
      };
    case 'new_message':
      return {
        title: 'Nuevo mensaje 💬',
        body: String(p.preview ?? 'Tienes un mensaje nuevo'),
        url: `/chat/${p.chat_id}`,
      };
    case 'trade_completed':
      return {
        title: '¡Trueke completado! 🎉',
        body: 'Cuéntanos cómo te fue: califica a tu truekero.',
        url: `/trueke/${p.trade_id}`,
      };
    case 'trade_cancelled':
      return {
        title: 'Trueke cancelado',
        body: 'El otro usuario canceló el trueke. Tus objetos vuelven a estar disponibles.',
        url: `/trueke/${p.trade_id}`,
      };
    case 'rating_received':
      return {
        title: 'Nueva calificación ⭐',
        body: `Recibiste ${p.stars ?? ''} estrellas por tu último trueke.`,
        url: `/perfil`,
      };
    case 'wishlist_match':
      return {
        title: '¡Apareció lo que buscas! 👀',
        body: `Publicaron «${p.item_title ?? 'algo de tu lista'}» cerca de ti.`,
        url: `/item/${p.item_id}`,
      };
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  const webhook = await req.json();
  const record = webhook.record as NotificationRecord | undefined;
  if (!record?.user_id) return new Response('ignored', { status: 200 });

  const message = buildMessage(record);
  if (!message) return new Response('ignored type', { status: 200 });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('expo_token')
    .eq('user_id', record.user_id);

  if (!tokens || tokens.length === 0) return new Response('no tokens', { status: 200 });

  const pushMessages = tokens.map((t) => ({
    to: t.expo_token,
    title: message.title,
    body: message.body,
    data: { url: message.url },
    sound: 'default',
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pushMessages),
  });

  // Limpia tokens muertos para no pagar fan-out inútil.
  try {
    const result = await res.json();
    const tickets: Array<{ status: string; details?: { error?: string } }> = result.data ?? [];
    const dead = tickets
      .map((ticket, i) => (ticket.details?.error === 'DeviceNotRegistered' ? tokens[i].expo_token : null))
      .filter((t): t is string => t !== null);
    if (dead.length > 0) {
      await supabase.from('push_tokens').delete().in('expo_token', dead);
    }
  } catch {
    // La respuesta de Expo no es crítica para el webhook.
  }

  return new Response('ok', { status: 200 });
});
