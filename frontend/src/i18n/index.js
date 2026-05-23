/**
 * @file Setup de i18next para Collector's Forge Studio.
 *
 * Idiomas soportados: es (default), en. Persistencia en localStorage
 * bajo la key `cfs-lang` (no usamos auto-detect del navegador para que
 * el usuario tenga control explícito vía Settings).
 *
 * Migración gradual: cada componente nuevo usa `useTranslation` +
 * `t('namespace.key')`. Los componentes existentes en español hardcoded
 * se traducen on-demand cuando se tocan.
 *
 * @module i18n
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import es from './messages/es.json';
import en from './messages/en.json';

export const SUPPORTED_LANGS = [
  { code: 'es', label: 'Español', flag: '🇨🇴' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];

const STORAGE_KEY = 'cfs-lang';

function getInitialLang() {
  if (typeof window === 'undefined') return 'es';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGS.some((l) => l.code === saved)) return saved;
  } catch {
    /* ignore */
  }
  return 'es';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    lng: getInitialLang(),
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false, // React ya escapa
    },
    returnNull: false,
  });

/**
 * Cambia el idioma activo y persiste en localStorage.
 * @param {string} code - 'es' | 'en'
 */
export function setLanguage(code) {
  if (!SUPPORTED_LANGS.some((l) => l.code === code)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
  i18n.changeLanguage(code);
}

export default i18n;
