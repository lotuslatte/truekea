// Checks that the text/background pairs of the theme meet WCAG AA (4.5:1).
// Usage: node scripts/check-contrast.mjs
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/theme/tokens.ts', import.meta.url), 'utf8');
const block = name => Object.fromEntries([...src.split(`const ${name}`)[1].split('};')[0].matchAll(/(\w+): '(#[0-9A-Fa-f]{6})'/g)].map(m => [m[1], m[2]]));
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [text, background, where it is used]
const PAIRS = [
  ['surface', 'primary', 'primary button label'], ['primary', 'primaryFaint', 'secondary button, success badge'], ['primary', 'sand', 'links'],
  ['accentInk', 'accentFaint', 'skill and circle badges'], ['goldInk', 'goldFaint', 'pending badge'], ['festiveInk', 'festiveFaint', 'circle dates'],
  ['ink', 'sand', 'body text'], ['inkMuted', 'sand', 'secondary text'], ['inkMuted', 'surface', 'secondary text on cards'], ['inkFaint', 'surface', 'placeholders'],
  ['danger', 'dangerFaint', 'error badge'], ['surface', 'danger', 'danger button label'],
];
let failed = 0;
for (const scheme of ['light', 'dark']) {
  const c = block(scheme);
  for (const [fg, bg, use] of PAIRS) {
    const r = ratio(c[fg], c[bg]); const ok = r >= 4.5; if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${scheme.padEnd(5)} ${fg} on ${bg}: ${r.toFixed(2)}  (${use})`);
  }
}
process.exit(failed ? 1 : 0);
