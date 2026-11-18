import type { NotificationType } from '@/types/database';

export type NotificationCopy = { title: string; body: string; url: string };

type Payload = Record<string, unknown>;

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

/**
 * Title, body and destination for a row of `notifications`. Pure, so the
 * inbox, the foreground toast and the tests share one source of copy.
 */
export function notificationCopy(type: NotificationType | string, payload: unknown): NotificationCopy {
  const p: Payload = payload && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Payload) : {};
  const item = text(p.item_title, 'tu publicación');
  switch (type) {
    case 'new_offer':
      return { title: 'Nueva oferta', body: `Te ofrecen un trueke por «${item}».`, url: `/oferta/${p.offer_id}` };
    case 'offer_countered':
      return { title: 'Contraoferta', body: `Te hicieron una contraoferta por «${item}».`, url: `/oferta/${p.offer_id}` };
    case 'offer_accepted':
      return { title: 'Aceptaron tu oferta', body: `Tu trueke por «${item}» está en marcha. Coordina la entrega.`, url: `/trueke/${p.trade_id}` };
    case 'offer_rejected':
      return { title: 'Oferta rechazada', body: `Tu oferta por «${item}» no fue aceptada esta vez.`, url: '/ofertas' };
    case 'new_message':
      return { title: 'Nuevo mensaje', body: text(p.preview, 'Te enviaron una foto.'), url: `/chat/${p.chat_id}` };
    case 'trade_completed':
      return { title: 'Trueke completado', body: 'Cuenta cómo te fue y califica a la otra persona.', url: `/trueke/${p.trade_id}` };
    case 'trade_cancelled':
      return { title: 'Trueke cancelado', body: 'La otra persona canceló el trueke. Tus publicaciones vuelven a estar disponibles.', url: `/trueke/${p.trade_id}` };
    case 'rating_received':
      return { title: 'Nueva calificación', body: `Recibiste ${text(String(p.stars ?? ''), 'una')} estrellas por tu último trueke.`, url: '/perfil' };
    case 'wishlist_match':
      return { title: 'Apareció lo que buscas', body: `Publicaron «${text(p.item_title, 'algo de tu lista')}» cerca de ti.`, url: `/item/${p.item_id}` };
    case 'circle_request':
      return { title: 'Quieren unirse a tu círculo', body: `Hay una solicitud nueva en «${item}».`, url: `/item/${p.item_id}` };
    case 'circle_accepted':
      return { title: 'Ya tienes cupo', body: `Te aceptaron en el círculo «${item}».`, url: `/item/${p.item_id}` };
    case 'circle_completed':
      return { title: 'Círculo terminado', body: `Terminó «${item}». Califica a quien lo organizó.`, url: `/item/${p.item_id}` };
    case 'item_question':
      return { title: 'Pregunta nueva', body: `Preguntaron por «${item}».`, url: `/item/${p.item_id}` };
    case 'item_answer':
      return { title: 'Respondieron tu pregunta', body: `Hay una respuesta en «${item}».`, url: `/item/${p.item_id}` };
    case 'meeting_proposed':
      return { title: 'Propuesta de encuentro', body: 'Te propusieron fecha y hora para la entrega.', url: `/trueke/${p.trade_id}` };
    case 'meeting_accepted':
      return { title: 'Fecha confirmada', body: 'Aceptaron la fecha y hora que propusiste.', url: `/trueke/${p.trade_id}` };
    default:
      return { title: 'Novedad en Truekea', body: 'Abre la app para ver el detalle.', url: '/notificaciones' };
  }
}

/** True when the same destination was announced less than `windowMs` ago. */
export function createDeduper(windowMs = 10_000, now: () => number = Date.now) {
  const seen = new Map<string, number>();
  return (key: string): boolean => {
    const t = now();
    for (const [k, at] of seen) if (t - at > windowMs) seen.delete(k);
    if (seen.has(key)) return true;
    seen.set(key, t);
    return false;
  };
}
