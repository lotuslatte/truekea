// Truekea e2e v2: intro inmersiva → feed de visitante → gate de registro →
// signup con dropdown de distrito → publicar un saber sin foto.
import { chromium } from 'playwright-core';

const OUT = process.env.OUT_DIR;
const EXE = process.env.CHROME_BIN;
const BASE = 'http://localhost:8081';
const PHONE = process.env.PHONE ?? '900000002';
const USERNAME = process.env.USERNAME_ ?? 'robo_tester';
const NAME = process.env.NAME_ ?? 'Robo Tester';

const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
const page = await ctx.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 250));
});
page.setDefaultTimeout(30000);

const shot = async (name, settle = 800) => {
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`📸 ${name}`);
};

try {
  // 1. Intro inmersiva (primera apertura)
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByText('Papa por pescado', { exact: false }).waitFor();
  await shot('20-intro-1-incas');
  await page.mouse.click(210, 430);
  await page.getByText('Llegó la moneda.').waitFor();
  await shot('21-intro-2-conquista');
  await page.mouse.click(210, 430);
  await page.getByText('Compramos.', { exact: false }).waitFor();
  await shot('22-intro-3-consumo');
  await page.mouse.click(210, 430);
  await page.getByText('Volvamos al trueke.').waitFor();
  await shot('23-intro-4-regreso');
  await page.getByText('Empezar 🌱').click();

  // 2. Feed como VISITANTE (sin cuenta)
  await page.getByPlaceholder('¿Qué buscas? ej: bici, tablet…').waitFor();
  await page.waitForTimeout(2500);
  await shot('24-feed-visitante');

  // 3. Filtro de saberes + detalle de un saber
  await page.getByText('🧠 Saberes').click();
  await page.waitForTimeout(1500);
  await shot('25-feed-saberes');
  await page.getByText('Clases de piano para principiantes').first().click();
  await page.getByText('Ofrecer trueke', { exact: false }).waitFor();
  await shot('26-detalle-saber');

  // 4. Visitante intenta ofertar → gate de registro
  await page.getByText('Ofrecer trueke', { exact: false }).click();
  await page.getByText('Únete al trueke').waitFor();
  await shot('27-unete');

  // 5. Registro con celular de prueba
  await page.getByText('Continuar con mi celular').click();
  await page.getByPlaceholder('987 654 321').fill(PHONE);
  await page.getByText('Enviar código', { exact: true }).click();
  await page.getByPlaceholder('123456').fill('123456');
  await page.getByText('Verificar', { exact: true }).click();

  // 6. Perfil con dropdown de distrito
  let state = '';
  for (let i = 0; i < 40 && !state; i++) {
    if (await page.getByText('¡Ya casi! Crea tu perfil').isVisible().catch(() => false)) {
      await page.waitForTimeout(1500);
      if (await page.getByText('¡Ya casi! Crea tu perfil').isVisible().catch(() => false)) state = 'setup';
    } else if (await page.getByPlaceholder('¿Qué buscas? ej: bici, tablet…').isVisible().catch(() => false)) {
      await page.waitForTimeout(1000);
      if (!(await page.getByText('¡Ya casi! Crea tu perfil').isVisible().catch(() => false))) state = 'feed';
    } else await page.waitForTimeout(500);
  }
  if (state === 'setup') {
    await page.getByPlaceholder('María Fernández').fill(NAME);
    await page.getByPlaceholder('maria_f').fill(USERNAME);
    await page.getByText('Elige tu distrito').click();
    await page.getByPlaceholder('Buscar…').fill('Mira');
    await shot('28-dropdown-distrito', 400);
    await page.getByText('Miraflores', { exact: true }).click();
    await page.getByText('Empezar a truekear').click();
  }
  await page.getByPlaceholder('¿Qué buscas? ej: bici, tablet…').waitFor();

  // 7. Publicar un SABER sin foto
  await page.goto(`${BASE}/item/nuevo`, { waitUntil: 'networkidle' });
  await page.getByText('Un saber').waitFor();
  await page.getByText('Un saber').click();
  await shot('29-publicar-saber-tipo');
  await page.getByText('Siguiente', { exact: true }).click();
  await page.getByPlaceholder('ej: Clases de piano para principiantes').fill('Clases de ajedrez desde cero');
  await page.getByPlaceholder('¿Qué enseñas? Tu experiencia, duración de la sesión, modalidad…').fill('Aprende aperturas, táctica y finales. Sesiones de 1 hora, presencial o por videollamada.');
  await page.getByText('📦 Otros').click();
  // El distrito viene precargado del perfil; solo se elige si está vacío.
  if (await page.getByText('Elige tu distrito').isVisible().catch(() => false)) {
    await page.getByText('Elige tu distrito').click();
    await page.getByPlaceholder('Buscar…').fill('Mira');
    await page.getByText('Miraflores', { exact: true }).click();
  }
  await page.getByText('Siguiente', { exact: true }).click();
  await page.getByPlaceholder('ej: otro saber, un objeto, lo que me sorprenda').fill('Un libro de ajedrez o clases de guitarra');
  await shot('30-publicar-saber-resumen');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await page.getByText('Clases de ajedrez desde cero').waitFor({ timeout: 45000 });
  await shot('31-perfil-con-saber');

  console.log('E2E_OK');
} catch (e) {
  console.error('E2E_FAIL:', e.message?.slice(0, 400));
  await shot('99-fail', 300);
  process.exitCode = 1;
} finally {
  await browser.close();
}
