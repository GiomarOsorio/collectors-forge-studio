// Verifica que src/i18n/messages/{es,en}.json tengan exactamente las mismas
// claves hoja (recursivo) y el mismo set de placeholders {{var}} por clave.
//
// Adaptado de bambuddy (https://github.com/maziggy/bambuddy), AGPL-3.0 —
// `frontend/scripts/check-i18n-parity.mjs`. CFS usa JSON plano (no .ts) y
// solo 2 locales (es/en, es es el default), así que se omiten los checks
// de plurales/cognados-por-idioma del original (pensados para 10 idiomas).
//
// Sale con código 1 y listado de diffs si hay divergencia, 0 si todo OK.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
const messagesDir = path.join(scriptDir, '..', 'src/i18n/messages');

function collectLeaves(obj, prefix, leaves) {
  for (const [key, value] of Object.entries(obj)) {
    const keyPath = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      collectLeaves(value, keyPath, leaves);
    } else if (typeof value === 'string') {
      leaves.set(keyPath, value);
    } else {
      console.error(`Valor no-string en "${keyPath}": ${JSON.stringify(value)} (las hojas deben ser strings)`);
      process.exit(1);
    }
  }
}

function loadLocale(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`${filePath}: JSON inválido — ${err.message}`);
    process.exit(1);
  }
  const leaves = new Map();
  collectLeaves(parsed, '', leaves);
  if (leaves.size === 0) {
    console.error(`${filePath}: 0 claves — archivo vacío o mal formado.`);
    process.exit(1);
  }
  return leaves;
}

const placeholderRe = /\{\{[^{}]+\}\}/g;

// Comparación pura, exportada para poder testearla sin tocar el filesystem.
// Input: locales = { es: Map<clave, valor>, en: Map<...> } — 'es' es la referencia.
export function compareLocales(locales) {
  if (!locales.es) throw new Error('compareLocales requiere una entrada locales.es (referencia)');
  const reports = [];
  const add = (label, items) => {
    if (items.length) reports.push({ label, items });
  };

  const refKeys = new Set(locales.es.keys());

  for (const [code, map] of Object.entries(locales)) {
    if (code === 'es') continue;
    const keys = new Set(map.keys());
    const missing = [...refKeys].filter((k) => !keys.has(k)).sort();
    const extra = [...keys].filter((k) => !refKeys.has(k)).sort();
    add(`${code}: claves faltantes vs es`, missing);
    add(`${code}: claves de más vs es`, extra);
  }

  for (const [code, map] of Object.entries(locales)) {
    if (code === 'es') continue;
    const mismatches = [];
    for (const [key, refValue] of locales.es) {
      const otherValue = map.get(key);
      if (otherValue === undefined) continue;
      const refPh = new Set(refValue.match(placeholderRe) ?? []);
      const otherPh = new Set(otherValue.match(placeholderRe) ?? []);
      const missingPh = [...refPh].filter((p) => !otherPh.has(p));
      const extraPh = [...otherPh].filter((p) => !refPh.has(p));
      if (missingPh.length || extraPh.length) {
        mismatches.push(`${key}: es=${[...refPh].join(',') || '∅'} vs ${code}=${[...otherPh].join(',') || '∅'}`);
      }
    }
    add(`${code}: placeholders distintos vs es`, mismatches);
  }

  return { failed: reports.length > 0, reports };
}

const isMainModule = import.meta.url === url.pathToFileURL(process.argv[1] ?? '').href;
if (isMainModule) {
  const discovered = fs
    .readdirSync(messagesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort();
  if (!discovered.includes('es')) {
    console.error(`No se encontró es.json en ${messagesDir} — es es la referencia, no se puede validar sin ella.`);
    process.exit(1);
  }
  const codes = ['es', ...discovered.filter((c) => c !== 'es')];
  const locales = Object.fromEntries(
    codes.map((c) => [c, loadLocale(path.join(messagesDir, `${c}.json`))]),
  );

  const MAX_REPORT = 30;
  const { reports } = compareLocales(locales);

  if (reports.length) {
    console.error('\n=== Divergencia de i18n (es es la referencia) ===');
    for (const { label, items } of reports) {
      console.error(`\n[${label}] (${items.length})`);
      items.slice(0, MAX_REPORT).forEach((i) => console.error(`  ${i}`));
      if (items.length > MAX_REPORT) console.error(`  ... y ${items.length - MAX_REPORT} más`);
    }
  }

  console.log('\nConteo de claves por idioma:');
  for (const [code, map] of Object.entries(locales)) {
    console.log(`  ${code.padEnd(6)} ${map.size}`);
  }

  if (reports.length > 0) {
    console.error('\n❌ Falló el check de paridad i18n.');
    process.exit(1);
  }
  const others = codes.filter((c) => c !== 'es');
  console.log(`\n✓ Todos los idiomas en paridad con es (${others.join(' / ')}).`);
}
