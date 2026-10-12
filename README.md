# Truekea 🌱

App de **trueque** para Lima: publicas un objeto, dices qué buscas a cambio, recibes ofertas (con "dinero encima" opcional), chateas y quedan en persona en un punto seguro. No es un marketplace — es intercambio.

**Stack:** Expo (React Native + TypeScript, Expo Router) → iOS, Android y Web desde una sola base de código. Backend Supabase (Postgres + PostGIS, Auth por SMS, Storage, Realtime, Edge Functions, RLS).

## Estructura

```
src/app/           Rutas (expo-router): (auth), (tabs), item/, oferta/, chat/, trueke/…
src/features/      Lógica por feature: auth, items, feed, offers, trades, chat, ratings, moderation, ads
src/components/    Design system (ui/) + ItemCard
src/theme/         tokens.ts — paleta eco, tipografía (nunca colores hardcodeados fuera de aquí)
src/lib/           supabase, queryClient, location, format, confirm, notifications
supabase/          migrations/ (schema+RLS+RPCs), seed.sql, functions/send-push, tests/
```

## Desarrollo local

```bash
npm install
cp .env.example .env   # completa con tu proyecto de Supabase
npx expo start --web   # o escanea el QR con Expo Go (Android/iOS)
```

Sin `.env` la app compila pero no puede iniciar sesión (apunta a un placeholder).

### Backend (Supabase)

1. Crea un proyecto gratis en [supabase.com](https://supabase.com) y copia URL + anon key al `.env`.
2. Aplica el schema y el seed:
   ```bash
   npx supabase link --project-ref <tu-ref>
   npx supabase db push --include-seed
   ```
3. **Auth por SMS:** Dashboard → Auth → Providers → Phone → habilita y conecta Twilio Verify (o usa "Test OTP" para probar sin SMS). Activa rate limits y CAPTCHA (Auth → Rate Limits) desde el día uno: los ataques de OTP-bombing son comunes y los SMS cuestan.
4. **Push:** despliega la edge function y conéctala con un webhook:
   ```bash
   npx supabase functions deploy send-push
   ```
   Dashboard → Database → Webhooks → nueva: tabla `public.notifications`, evento INSERT → Edge Function `send-push`. Con eso, ofertas, mensajes, truekes y calificaciones disparan push automáticamente (todo el dominio escribe en `notifications` vía `notify_user()`).
5. **Datos demo (opcional, recomendado para probar):**
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=<service-key> DEMO_PASSWORD=<clave> node scripts/seed-demo.mts
   ```
   Crea 2 usuarios demo con teléfono confirmado (`+51 911 111 111` / `+51 922 222 222`, contraseña definida en `DEMO_PASSWORD`), 16 publicaciones con fotos, una oferta pendiente y un trueke acordado con chat — todo a través de la máquina de estados real. Idempotente.
6. **Verificación del schema:** `psql "$DB_URL" -f supabase/tests/rls_smoke.sql` — prueba RLS, la máquina de estados (aceptar oferta → trade → confirmación mutua → calificación) y bloqueos. Termina en ROLLBACK.
7. **Ofertas vencidas:** programa `select public.expire_stale_offers();` (pg_cron o cron de edge function) cada día.

Con Docker instalado también puedes correr todo local: `npx supabase start` y `npx supabase db reset` (aplica migraciones + seed; hay números de prueba `+51900000001/2` con OTP `123456` en `config.toml`).

## Reglas de arquitectura

- **Las transiciones de estado nunca son UPDATEs directos.** `accept_offer`, `reject_offer`, `cancel_offer`, `counter_offer`, `confirm_trade`, `cancel_trade` y `set_meeting_point` son RPCs SECURITY DEFINER transaccionales; RLS bloquea el resto. Un trigger impide poner items en `reserved/traded` a mano.
- **Feed geográfico** vía RPC `feed_items` (PostGIS `ST_DWithin` + exclusión de bloqueados). La ubicación es siempre el **centroide del distrito**, nunca una dirección exacta.
- **TanStack Query es el estado del servidor** (el chat Realtime solo acelera la cache; el fetch paginado es la fuente de verdad). Zustand solo para estado local (filtros, borradores).
- **Ads dormidos:** `insertAdSlots()` + `<AdSlot/>` tras el flag `feature_flags.ads_feed` (apagado). No hay SDK de AdMob instalado a propósito — instalarlo antes de monetizar complica la revisión de las tiendas. Al activarlo: tarjeta nativa cada ~10 items con etiqueta "Publicidad".

## Lanzamiento

- **Web:** `npx expo export --platform web` → sube `dist/` a Vercel/Netlify/Cloudflare Pages.
- **Android:** `npx eas build --profile production --platform android` → Play Console. Declara contenido generado por usuarios (tenemos reportar + bloquear + eliminación de cuenta, obligatorios) y completa el formulario Data Safety.
- **iOS (después):** el código ya es compatible; solo falta cuenta Apple Developer y `eas build --platform ios`. Los requisitos UGC de Apple (guideline 1.2) ya están cubiertos.
- Antes del lanzamiento público: siembra 100+ objetos reales (red PUCP/amigos) concentrados en 2–3 distritos — un feed vacío mata la app.

## Verificación por fases

Cada fase se prueba con **dos cuentas** (dos navegadores o dos dispositivos): publicar → ver en el feed del otro → ofertar (+ S/ encima) → contraofertar → aceptar → chat en vivo → elegir punto seguro → confirmar entrega ambos → calificar → bloquear/reportar.

Prototipo en desarrollo, abierto a colaboración y financiamiento: [Favio Samillan](https://lotuslatte.github.io).
