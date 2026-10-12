// E2E círculos: visitante ve el círculo en el feed → detalle → registro → pide cupo.
import { chromium } from 'playwright-core';
const OUT = process.env.OUT_DIR;
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN, headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
await ctx.addInitScript(() => localStorage.setItem('truekea:intro_seen', '1'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 200)); });
page.setDefaultTimeout(30000);
const shot = async (n, s = 900) => { await page.waitForTimeout(s); await page.screenshot({ path: `${OUT}/${n}.png` }); console.log('📸', n); };

try {
  await page.goto('http://localhost:8081', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('¿Qué buscas? ej: bici, tablet…').waitFor();
  await page.getByText('🧠 Saberes').click();
  await page.waitForTimeout(2000);
  await shot('60-feed-circulo');

  await page.getByText('Círculo de ajedrez en el parque').first().click();
  await page.getByText('Pedir mi cupo', { exact: false }).waitFor();
  await shot('61-detalle-circulo');

  // Visitante toca "Pedir mi cupo" → gate de registro
  await page.getByText('Pedir mi cupo', { exact: false }).click();
  await page.getByText('Únete al trueke').waitFor();
  await page.getByText('Continuar con mi celular').click();
  await page.getByPlaceholder('987 654 321').fill('900000002');
  await page.getByText('Enviar código', { exact: true }).click();
  await page.getByPlaceholder('123456').fill('123456');
  await page.getByText('Verificar', { exact: true }).click();

  // perfil nuevo
  let state = '';
  for (let i = 0; i < 40 && !state; i++) {
    if (await page.getByText('¡Ya casi! Crea tu perfil').isVisible().catch(() => false)) {
      await page.waitForTimeout(1500);
      if (await page.getByText('¡Ya casi! Crea tu perfil').isVisible().catch(() => false)) state = 'setup';
    } else if (await page.getByPlaceholder('¿Qué buscas? ej: bici, tablet…').isVisible().catch(() => false)) state = 'feed';
    else await page.waitForTimeout(500);
  }
  if (state === 'setup') {
    await page.getByPlaceholder('María Fernández').fill('Robo Tester');
    await page.getByPlaceholder('maria_f').fill('robo_tester');
    await page.getByText('Elige tu distrito').click();
    await page.getByPlaceholder('Buscar…').fill('Barran');
    await page.getByText('Barranco', { exact: true }).click();
    await page.getByText('Empezar a truekear').click();
    await page.getByPlaceholder('¿Qué buscas? ej: bici, tablet…').waitFor();
  }

  // De vuelta al círculo, ahora con cuenta: pide el cupo con ofrenda
  await page.getByText('🧠 Saberes').click();
  await page.waitForTimeout(1500);
  await page.getByText('Círculo de ajedrez en el parque').first().click();
  await page.getByText('Pedir mi cupo', { exact: false }).waitFor();
  await page.getByText('Pedir mi cupo', { exact: false }).click();
  await page.waitForTimeout(600);
  const field = page.getByPlaceholder(/.+/).last();
  await field.fill('Llevo mi tablero magnético y jugos 🧃');
  await shot('62-pedir-cupo');
  await page.getByRole('button', { name: /Pedir|Enviar|Confirmar/ }).last().click();
  await page.waitForTimeout(1500);
  await shot('63-cupo-pedido');
  console.log('E2E_OK');
} catch (e) {
  console.error('E2E_FAIL:', e.message?.slice(0, 300));
  await shot('99-fail', 300);
  process.exitCode = 1;
} finally { await browser.close(); }
