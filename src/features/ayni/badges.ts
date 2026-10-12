// Insignias coleccionables: honores derivados de lo que ya hizo la persona.
// Se calculan en el cliente a partir del Profile y de las estadísticas del
// RPC `profile_stats` (via useProfileStats). `getAchievements` devuelve
// SIEMPRE las 38 (desbloqueadas o no) para la galería, agrupadas por `group`;
// `getProfileBadges` conserva la forma antigua (solo desbloqueadas).
// Si `stats` aún no llega (null), las insignias que dependen de él quedan
// bloqueadas y sin progreso, sin romper nada.

import type { Profile } from '@/types/database';

import type { ProfileStats } from './useProfileStats';

export type ProfileBadge = {
  key: string;
  emoji: string;
  label: string;
};

export type AchievementBadge = {
  key: string;
  emoji: string;
  label: string;
  hint: string;
  group: string;
  unlocked: boolean;
  progress?: string;
};

/** Kilos de CO₂e evitados: cada objeto reutilizado ≈ 5 kg. */
export function getCo2SavedKg(profile: Profile): number {
  return (profile.trades_completed + profile.donations_given) * 5;
}

/** Progreso "actual/meta", con tope en la meta para no mostrar "7/5". */
function ratio(current: number, target: number): string {
  return `${Math.min(current, target)}/${target}`;
}

function accountAgeDays(createdAt: string): number {
  const ms = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function getAchievements(
  profile: Profile,
  stats: ProfileStats | null,
): AchievementBadge[] {
  const trades = profile.trades_completed;
  const circles = profile.circles_hosted;
  const donations = profile.donations_given;
  const rating = profile.rating_avg ?? 0;
  const ratings = profile.rating_count;
  const co2 = getCo2SavedKg(profile);
  const days = accountAgeDays(profile.created_at);

  // Las 36 "normales"; las dos meta (mitad y colección) se calculan al final.
  const base: AchievementBadge[] = [
    // ── Truekes ──────────────────────────────────────────────────────────
    {
      key: 'primer-trueke',
      emoji: '🌱',
      label: 'Primer trueke',
      hint: 'Completa tu primer trueke',
      group: 'Truekes',
      unlocked: trades >= 1,
    },
    {
      key: 'truekero-activo',
      emoji: '🔁',
      label: 'Truekero/a activo/a',
      hint: 'Completa 5 truekes',
      group: 'Truekes',
      unlocked: trades >= 5,
      progress: ratio(trades, 5),
    },
    {
      key: 'leyenda-trueke',
      emoji: '🏆',
      label: 'Leyenda del trueke',
      hint: 'Completa 20 truekes',
      group: 'Truekes',
      unlocked: trades >= 20,
      progress: ratio(trades, 20),
    },
    {
      key: 'apu-trueke',
      emoji: '🗿',
      label: 'Apu del trueke',
      hint: 'Completa 50 truekes, como los grandes',
      group: 'Truekes',
      unlocked: trades >= 50,
      progress: ratio(trades, 50),
    },
    // ── Círculos ─────────────────────────────────────────────────────────
    {
      key: 'maestro-circulo',
      emoji: '🏔️',
      label: 'Maestro/a de círculo',
      hint: 'Dicta tu primer círculo',
      group: 'Círculos',
      unlocked: circles >= 1,
    },
    {
      key: 'anfitrion-estrella',
      emoji: '🎪',
      label: 'Anfitrión/a estrella',
      hint: 'Dicta 5 círculos',
      group: 'Círculos',
      unlocked: circles >= 5,
      progress: ratio(circles, 5),
    },
    {
      key: 'inti',
      emoji: '☀️',
      label: 'Inti',
      hint: 'Dicta 10 círculos e ilumina a tu comunidad',
      group: 'Círculos',
      unlocked: circles >= 10,
      progress: ratio(circles, 10),
    },
    {
      key: 'maestro-querido',
      emoji: '📚',
      label: 'Maestro/a querido/a',
      hint: 'Que 20 personas asistan a tus círculos',
      group: 'Círculos',
      unlocked: (stats?.circle_attendees_total ?? 0) >= 20,
      ...(stats ? { progress: ratio(stats.circle_attendees_total, 20) } : {}),
    },
    {
      key: 'aprendiz',
      emoji: '🎓',
      label: 'Aprendiz',
      hint: 'Asiste a tu primer círculo',
      group: 'Círculos',
      unlocked: (stats?.circles_attended ?? 0) >= 1,
    },
    // ── Regalos ──────────────────────────────────────────────────────────
    {
      key: 'primer-regalo',
      emoji: '🎁',
      label: 'Primer regalo',
      hint: 'Regala tu primer objeto',
      group: 'Regalos',
      unlocked: donations >= 1,
    },
    {
      key: 'manos-verdes',
      emoji: '💚',
      label: 'Manos verdes',
      hint: 'Regala 3 objetos',
      group: 'Regalos',
      unlocked: donations >= 3,
      progress: ratio(donations, 3),
    },
    {
      key: 'corazon-gigante',
      emoji: '💝',
      label: 'Corazón gigante',
      hint: 'Regala 10 objetos',
      group: 'Regalos',
      unlocked: donations >= 10,
      progress: ratio(donations, 10),
    },
    {
      key: 'que-no-se-bote',
      emoji: '🍝',
      label: 'Que no se bote',
      hint: 'Regala un alimento antes de que se pase',
      group: 'Regalos',
      unlocked: (stats?.perishables_given ?? 0) >= 1,
    },
    {
      key: 'heroe-cocina',
      emoji: '🥘',
      label: 'Héroe/ína de la cocina',
      hint: 'Regala 5 alimentos perecibles',
      group: 'Regalos',
      unlocked: (stats?.perishables_given ?? 0) >= 5,
      ...(stats ? { progress: ratio(stats.perishables_given, 5) } : {}),
    },
    {
      key: 'al-toque',
      emoji: '⏰',
      label: 'Al toque',
      hint: 'Que recojan un perecible tuyo en menos de 3 horas',
      group: 'Regalos',
      unlocked: (stats?.perishable_fast ?? 0) >= 1,
    },
    // ── Saberes ──────────────────────────────────────────────────────────
    {
      key: 'primer-saber',
      emoji: '📖',
      label: 'Primer saber',
      hint: 'Publica tu primer saber para compartir',
      group: 'Saberes',
      unlocked: (stats?.knowledge_published ?? 0) >= 1,
    },
    {
      key: 'sabelotodo',
      emoji: '🌈',
      label: 'Sabelotodo',
      hint: 'Publica saberes en 3 categorías distintas',
      group: 'Saberes',
      unlocked: (stats?.knowledge_categories ?? 0) >= 3,
      ...(stats ? { progress: ratio(stats.knowledge_categories, 3) } : {}),
    },
    {
      key: 'todoterreno',
      emoji: '🔀',
      label: 'Todoterreno',
      hint: 'Completa un trueke de objeto y uno de saber',
      group: 'Saberes',
      unlocked:
        (stats?.object_trades ?? 0) >= 1 && (stats?.knowledge_trades ?? 0) >= 1,
    },
    // ── Exploración ──────────────────────────────────────────────────────
    {
      key: 'de-barrio',
      emoji: '🏘️',
      label: 'De barrio',
      hint: 'Completa 5 truekes en tu propio distrito',
      group: 'Exploración',
      unlocked: (stats?.own_district_trades ?? 0) >= 5,
      ...(stats ? { progress: ratio(stats.own_district_trades, 5) } : {}),
    },
    {
      key: 'puente',
      emoji: '🌉',
      label: 'Puente',
      hint: 'Truekea con alguien de otro distrito',
      group: 'Exploración',
      unlocked: (stats?.cross_district_trades ?? 0) >= 1,
    },
    {
      key: 'limeno-total',
      emoji: '🗺️',
      label: 'Limeño/a total',
      hint: 'Truekea en 5 distritos distintos',
      group: 'Exploración',
      unlocked: (stats?.distinct_districts ?? 0) >= 5,
      ...(stats ? { progress: ratio(stats.distinct_districts, 5) } : {}),
    },
    // ── Rachas ───────────────────────────────────────────────────────────
    {
      key: 'en-racha',
      emoji: '🔥',
      label: 'En racha',
      hint: 'Completa 2 truekes en una misma semana',
      group: 'Rachas',
      unlocked: stats?.week_pair === true,
    },
    {
      key: 'madrugador',
      emoji: '🌅',
      label: 'Madrugador/a',
      hint: 'Publica entre 4 y 7 de la mañana',
      group: 'Rachas',
      unlocked: (stats?.early_posts ?? 0) >= 1,
    },
    {
      key: 'buho-truekero',
      emoji: '🦉',
      label: 'Búho truekero',
      hint: 'Publica pasada la medianoche',
      group: 'Rachas',
      unlocked: (stats?.night_posts ?? 0) >= 1,
    },
    // ── Comunidad ────────────────────────────────────────────────────────
    {
      key: 'buena-conversa',
      emoji: '💬',
      label: 'Buena conversa',
      hint: 'Envía 100 mensajes en tus chats',
      group: 'Comunidad',
      unlocked: (stats?.messages_sent ?? 0) >= 100,
      ...(stats ? { progress: ratio(stats.messages_sent, 100) } : {}),
    },
    {
      key: 'calificador-constante',
      emoji: '📝',
      label: 'Calificador/a constante',
      hint: 'Califica a 5 truekeros después de tus tratos',
      group: 'Comunidad',
      unlocked: (stats?.ratings_given ?? 0) >= 5,
      ...(stats ? { progress: ratio(stats.ratings_given, 5) } : {}),
    },
    {
      key: 'vecino-confiable',
      emoji: '🤝',
      label: 'Vecino/a confiable',
      hint: 'Recibe 10 calificaciones de la comunidad',
      group: 'Comunidad',
      unlocked: ratings >= 10,
      progress: ratio(ratings, 10),
    },
    {
      key: 'bien-calificado',
      emoji: '⭐',
      label: 'Bien calificado/a',
      hint: 'Logra 4.5+ estrellas con 3 calificaciones',
      group: 'Comunidad',
      unlocked: rating >= 4.5 && ratings >= 3,
    },
    {
      key: 'impecable',
      emoji: '✨',
      label: 'Impecable',
      hint: 'Logra 5 estrellas perfectas con 5 calificaciones',
      group: 'Comunidad',
      unlocked: rating === 5 && ratings >= 5,
    },
    {
      key: 'guardian-planeta',
      emoji: '🌎',
      label: 'Guardián/a del planeta',
      hint: 'Evita 50 kg de CO₂ reutilizando',
      group: 'Comunidad',
      unlocked: co2 >= 50,
      progress: `${Math.min(co2, 50)}/50 kg`,
    },
    // ── Primeros pasos ───────────────────────────────────────────────────
    {
      key: 'perfil-completo',
      emoji: '📸',
      label: 'Perfil completo',
      hint: 'Ponle foto y bio a tu perfil',
      group: 'Primeros pasos',
      unlocked: !!(profile.avatar_url && profile.bio),
    },
    {
      key: 'primera-oferta',
      emoji: '📨',
      label: 'Primera oferta',
      hint: 'Anímate y envía tu primera oferta',
      group: 'Primeros pasos',
      unlocked: (stats?.offers_sent ?? 0) >= 1,
    },
    {
      key: 'primer-trato',
      emoji: '✅',
      label: 'Primer trato',
      hint: 'Que alguien acepte una oferta tuya',
      group: 'Primeros pasos',
      unlocked: (stats?.offers_accepted ?? 0) >= 1,
    },
    {
      key: 'fundador',
      emoji: '🌿',
      label: 'Fundador/a',
      hint: 'Únete a Truekea antes del 2027',
      group: 'Primeros pasos',
      unlocked: new Date(profile.created_at).getFullYear() < 2027,
    },
    {
      key: 'veterano',
      emoji: '🗓️',
      label: 'Veterano/a',
      hint: 'Cumple 30 días en la comunidad',
      group: 'Primeros pasos',
      unlocked: days > 30,
      progress: `${Math.min(days, 30)}/30 días`,
    },
    // ── Especiales ───────────────────────────────────────────────────────
    {
      key: 'full-chakana',
      emoji: '🧩',
      label: 'Full chakana',
      hint: 'Haz todo: publica, trueka, regala, dicta y asiste',
      group: 'Especiales',
      unlocked:
        stats?.has_published === true &&
        trades >= 1 &&
        donations >= 1 &&
        circles >= 1 &&
        (stats?.circles_attended ?? 0) >= 1,
    },
  ];

  // Las dos meta se calculan sobre las 36 anteriores.
  const unlockedCount = base.filter((badge) => badge.unlocked).length;
  const halfTarget = Math.ceil(base.length / 2);

  const meta: AchievementBadge[] = [
    {
      key: 'mitad-camino',
      emoji: '🏅',
      label: 'Mitad del camino',
      hint: `Desbloquea ${halfTarget} insignias, la mitad de la colección`,
      group: 'Especiales',
      unlocked: unlockedCount >= halfTarget,
      progress: ratio(unlockedCount, halfTarget),
    },
    {
      key: 'coleccion-completa',
      emoji: '👑',
      label: 'Colección completa',
      hint: 'Desbloquea todas las demás insignias',
      group: 'Especiales',
      unlocked: unlockedCount >= base.length,
      progress: ratio(unlockedCount, base.length),
    },
  ];

  return [...base, ...meta];
}

/** Compat: solo las insignias ya desbloqueadas, en la forma antigua. */
export function getProfileBadges(profile: Profile, stats: ProfileStats | null): ProfileBadge[] {
  return getAchievements(profile, stats)
    .filter((badge) => badge.unlocked)
    .map(({ key, emoji, label }) => ({ key, emoji, label }));
}
