// Builds the admin pages' light theme from the dark classes they actually use.
//
// The admin is styled dark with Tailwind classes. Rather than restyle every
// section, this reads every colour class in src/, works out its light
// counterpart, and writes overrides that apply only under `html.admin-light`
// (set on /admin routes when Light is chosen). Surfaces go to white and
// off-white, white text to near-black, faint white borders and fills to faint
// black ones, greys mirror across the scale, and pale accents deepen so they
// read on white. Photos are untouched. Runs before `dev` and `build`.
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'src/styles/admin-light.generated.css');

const files = [];
const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(tsx|ts)$/.test(f) && files.push(p); } };
walk(join(ROOT, 'src'));

// Tailwind's default palette, for the families the admin uses.
const P = {
  neutral: { 50:'#fafafa',100:'#f5f5f5',200:'#e5e5e5',300:'#d4d4d4',400:'#a3a3a3',500:'#737373',600:'#525252',700:'#404040',800:'#262626',900:'#171717',950:'#0a0a0a' },
  gray:    { 50:'#f9fafb',100:'#f3f4f6',200:'#e5e7eb',300:'#d1d5db',400:'#9ca3af',500:'#6b7280',600:'#4b5563',700:'#374151',750:'#2d3748',800:'#1f2937',900:'#111827',950:'#030712' },
  zinc:    { 50:'#fafafa',100:'#f4f4f5',200:'#e4e4e7',300:'#d4d4d8',400:'#a1a1aa',500:'#71717a',600:'#52525b',700:'#3f3f46',800:'#27272a',900:'#18181b',950:'#09090b' },
  slate:   { 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155',800:'#1e293b',900:'#0f172a',950:'#020617' },
  stone:   { 50:'#fafaf9',100:'#f5f5f4',200:'#e7e5e4',300:'#d6d3d1',400:'#a8a29e',500:'#78716c',600:'#57534e',700:'#44403c',800:'#292524',900:'#1c1917',950:'#0c0a09' },
  emerald: { 50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',600:'#059669',700:'#047857',800:'#065f46',900:'#064e3b' },
  green:   { 50:'#f0fdf4',100:'#dcfce7',200:'#bbf7d0',300:'#86efac',400:'#4ade80',500:'#22c55e',600:'#16a34a',700:'#15803d',800:'#166534',900:'#14532d' },
  rose:    { 50:'#fff1f2',100:'#ffe4e6',200:'#fecdd3',300:'#fda4af',400:'#fb7185',500:'#f43f5e',600:'#e11d48',700:'#be123c',800:'#9f1239',900:'#881337' },
  red:     { 50:'#fef2f2',100:'#fee2e2',200:'#fecaca',300:'#fca5a5',400:'#f87171',500:'#ef4444',600:'#dc2626',700:'#b91c1c',800:'#991b1b',900:'#7f1d1d' },
  amber:   { 50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309',800:'#92400e',900:'#78350f' },
  yellow:  { 50:'#fefce8',100:'#fef9c3',200:'#fef08a',300:'#fde047',400:'#facc15',500:'#eab308',600:'#ca8a04',700:'#a16207',800:'#854d0e',900:'#713f12' },
  orange:  { 50:'#fff7ed',100:'#ffedd5',200:'#fed7aa',300:'#fdba74',400:'#fb923c',500:'#f97316',600:'#ea580c',700:'#c2410c',800:'#9a3412',900:'#7c2d12' },
  sky:     { 50:'#f0f9ff',100:'#e0f2fe',200:'#bae6fd',300:'#7dd3fc',400:'#38bdf8',500:'#0ea5e9',600:'#0284c7',700:'#0369a1',800:'#075985',900:'#0c4a6e' },
  blue:    { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a' },
  cyan:    { 50:'#ecfeff',100:'#cffafe',200:'#a5f3fc',300:'#67e8f9',400:'#22d3ee',500:'#06b6d4',600:'#0891b2',700:'#0e7490',800:'#155e75',900:'#164e63' },
  teal:    { 50:'#f0fdfa',100:'#ccfbf1',200:'#99f6e4',300:'#5eead4',400:'#2dd4bf',500:'#14b8a6',600:'#0d9488',700:'#0f766e',800:'#115e59',900:'#134e4a' },
  purple:  { 50:'#faf5ff',100:'#f3e8ff',200:'#e9d5ff',300:'#d8b4fe',400:'#c084fc',500:'#a855f7',600:'#9333ea',700:'#7e22ce',800:'#6b21a8',900:'#581c87' },
  violet:  { 50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',300:'#c4b5fd',400:'#a78bfa',500:'#8b5cf6',600:'#7c3aed',700:'#6d28d9',800:'#5b21b6',900:'#4c1d95' },
  indigo:  { 50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#6366f1',600:'#4f46e5',700:'#4338ca',800:'#3730a3',900:'#312e81' },
  pink:    { 50:'#fdf2f8',100:'#fce7f3',200:'#fbcfe8',300:'#f9a8d4',400:'#f472b6',500:'#ec4899',600:'#db2777',700:'#be185d',800:'#9d174d',900:'#831843' },
  lime:    { 50:'#f7fee7',100:'#ecfccb',200:'#d9f99d',300:'#bef264',400:'#a3e635',500:'#84cc16',600:'#65a30d',700:'#4d7c0f',800:'#3f6212',900:'#365314' },
  fuchsia: { 50:'#fdf4ff',100:'#fae8ff',200:'#f5d0fe',300:'#f0abfc',400:'#e879f9',500:'#d946ef',600:'#c026d3',700:'#a21caf',800:'#86198f',900:'#701a75' },
};
const GREYS = new Set(['neutral', 'gray', 'zinc', 'slate', 'stone']);

const hexToRgb = h => {
  let x = h.replace('#', '');
  if (x.length === 3) x = [...x].map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(x.slice(i, i + 2), 16));
};
const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return a === 1 ? hex : `rgba(${r},${g},${b},${+a.toFixed(3)})`; };
const lum = hex => { const [r, g, b] = hexToRgb(hex).map(v => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const nearest = (fam, n) => {
  const keys = Object.keys(P[fam]).map(Number);
  return keys.reduce((best, k) => (Math.abs(k - n) < Math.abs(best - n) ? k : best), keys[0]);
};

const INK = '#141414';        // text on light
const PAGE = '#f6f6f4';       // the page itself
const PANEL = '#ffffff';      // cards and panels
const RAISED = '#efefec';     // inputs, wells and tiles inside panels

// Returns [cssProperty, lightValue] for one utility, or null to leave it.
function lightFor(prop, color, shade, alpha) {
  const a = alpha ?? 1;
  const cssProp = { bg: 'background-color', text: 'color', border: 'border-color', divide: 'border-color', ring: '--tw-ring-color', placeholder: 'color' }[prop];
  if (!cssProp) return null;

  if (color === 'white') {
    if (prop === 'bg') return [cssProp, a === 1 ? INK : rgba('#000000', Math.min(1, a))];
    if (prop === 'border' || prop === 'divide' || prop === 'ring') return [cssProp, rgba('#000000', Math.min(0.9, a * 1.35))];
    return [cssProp, rgba(INK, a)];
  }
  if (color === 'black') {
    if (prop === 'bg') return [cssProp, a === 1 ? PAGE : rgba('#000000', Math.min(0.6, a * 0.55))];
    if (prop === 'text') return [cssProp, a === 1 ? '#ffffff' : rgba('#ffffff', a)];
    return null;
  }
  if (color.startsWith('#')) {
    const L = lum(color);
    if (prop === 'bg') {
      if (L > 0.75) return [cssProp, rgba(INK, a)];
      if (L < 0.055) return [cssProp, rgba(PAGE, a)];
      if (L < 0.1) return [cssProp, rgba(PANEL, a)];
      if (L < 0.3) return [cssProp, rgba(RAISED, a)];
      return null;
    }
    if (prop === 'text') return L > 0.6 ? [cssProp, rgba(INK, a)] : null;
    if (prop === 'border') return L < 0.3 ? [cssProp, 'rgba(0,0,0,0.1)'] : null;
    return null;
  }
  if (!P[color] || shade == null) return null;
  if (GREYS.has(color)) {
    const m = nearest(color, 1000 - shade);
    return [cssProp, rgba(P[color][m], a)];
  }
  // Accents: pale shades deepen for white; tinted fills stay as they are.
  if (prop === 'bg') return a < 0.35 ? null : (shade >= 800 ? [cssProp, rgba(P[color][Math.max(100, 1000 - shade)] ?? P[color][100], a)] : null);
  const deep = shade <= 300 ? 700 : shade <= 500 ? 600 : shade;
  return [cssProp, rgba(P[color][nearest(color, deep)], a)];
}

const TOKEN = /(?<![\w-])((?:(?:hover|focus|focus-visible|group-hover|placeholder|disabled|active):)*)(bg|text|border|divide|ring|placeholder)-(white|black|\[#[0-9a-fA-F]{3,8}\]|[a-z]+-[0-9]{2,3})(?:\/(\[[0-9.]+\]|[0-9]{1,3}))?(?![\w-])/g;

const esc = s => s.replace(/([:\/\[\]#.%])/g, '\\$1');
const rules = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(TOKEN)) {
    const [whole, variants, prop, rawColor, rawAlpha] = m;
    let color = rawColor, shade = null;
    if (rawColor.startsWith('[')) color = rawColor.slice(1, -1);
    else if (rawColor.includes('-')) { const i = rawColor.lastIndexOf('-'); color = rawColor.slice(0, i); shade = +rawColor.slice(i + 1); }
    if (prop === 'text' && /^(xs|sm|base|lg|xl|left|right|center)$/.test(color)) continue;
    const alpha = rawAlpha == null ? null : rawAlpha.startsWith('[') ? +rawAlpha.slice(1, -1) : +rawAlpha / 100;
    const out = lightFor(variants.includes('placeholder') ? 'placeholder' : prop, color, shade, alpha);
    if (!out) continue;
    const v = variants.split(':').filter(Boolean);
    let sel = `html.admin-light .${esc(whole)}`;
    if (v.includes('group-hover')) sel = `html.admin-light .group:hover .${esc(whole)}`;
    if (v.includes('hover')) sel += ':hover';
    if (v.includes('focus')) sel += ':focus';
    if (v.includes('focus-visible')) sel += ':focus-visible';
    if (v.includes('active')) sel += ':active';
    if (v.includes('disabled')) sel += ':disabled';
    if (v.includes('placeholder') || prop === 'placeholder') sel += '::placeholder';
    if (prop === 'divide') sel += ' > :not([hidden]) ~ :not([hidden])';
    rules.set(sel, `${out[0]}: ${out[1]} !important;`);
  }
}

// White text on a solid coloured fill (a green Accept, a red Delete) stays
// white: those fills keep their colour, so dark text would vanish into them.
const solidFills = new Set();
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(/(?<![\w-])((?:hover:)?)bg-([a-z]+)-([5-9]00)(?![\w\/-])/g)) {
    if (!GREYS.has(m[2]) && P[m[2]]) solidFills.add(m[0]);
  }
}
for (const fill of solidFills) {
  const hover = fill.startsWith('hover:');
  const base = `html.admin-light .${esc(fill)}${hover ? ':hover' : ''}`;
  rules.set(`${base}.text-white, ${base}.hover\\:text-white`, 'color: #ffffff !important;');
}

const css = [
  '/* Generated by scripts/gen-admin-light.mjs — do not edit by hand. */',
  `html.admin-light { color-scheme: light; background: ${PAGE}; }`,
  `html.admin-light body { background: ${PAGE}; color: ${INK}; }`,
  ...[...rules].map(([sel, decl]) => `${sel} { ${decl} }`),
].join('\n') + '\n';
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, css);
console.log(`admin light theme: ${rules.size} rules from ${files.length} files`);
