/**
 * @file Helpers para tarifa eléctrica (issue #75).
 *
 * `isKwhTariffStale(periodYYYY-MM)` → true si el periodo no es el mes actual.
 * `formatTariffPeriod` → "Abril 2026" desde 'YYYY-MM'.
 *
 * @module utils/tariff
 */

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Determina si una tarifa configurada (`YYYY-MM`) corresponde al mes
 * actual. Si no, dispara warning de issue #75.
 *
 * @param {string} settingsPeriod - 'YYYY-MM' (ej. '2026-04').
 * @param {Date} [now=new Date()] - inyección para tests.
 * @returns {boolean}
 */
export function isKwhTariffStale(settingsPeriod, now = new Date()) {
  if (!settingsPeriod || typeof settingsPeriod !== 'string') return true;
  const [y, m] = settingsPeriod.split('-').map(Number);
  if (!y || !m) return true;
  return y !== now.getFullYear() || m !== (now.getMonth() + 1);
}

/**
 * Formatea un periodo 'YYYY-MM' a "Mes YYYY" en español.
 *
 * @param {string} periodYYYYMM - ej. '2026-04'.
 * @returns {string} ej. 'Abril 2026' (o '—' si inválido).
 */
export function formatTariffPeriod(periodYYYYMM) {
  if (!periodYYYYMM) return '—';
  const [y, m] = periodYYYYMM.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return '—';
  return `${MESES_ES[m - 1]} ${y}`;
}

/**
 * Periodo del mes actual en formato 'YYYY-MM'.
 *
 * @param {Date} [now=new Date()]
 * @returns {string}
 */
export function currentTariffPeriod(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
