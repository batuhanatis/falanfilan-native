import english from './en.json';

const caseVariants = Object.fromEntries(Object.entries(english).flatMap(([key, value]) => [[key.toLocaleUpperCase('tr-TR'), value.toUpperCase()], [key.toLocaleLowerCase('tr-TR'), value.toLowerCase()]]));
let language = 'tr';
const listeners = new Set();
export function getLanguage() { return language; }
export function getLocale() { return language === 'en' ? 'en-GB' : 'tr-TR'; }
export function setLanguageValue(value) {
  if (!['tr', 'en'].includes(value)) throw new Error('Unsupported language');
  if (language === value) return;
  language = value;
  listeners.forEach(listener => listener());
}
export function subscribeLanguage(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function t(value, params = {}) {
  if (typeof value !== 'string') return value;
  const key = value.trim();
  const translated = language === 'en' ? (english[value] ?? english[key] ?? caseVariants[key] ?? value) : value;
  const spaced = translated !== value && !Object.hasOwn(english, value)
    ? value.slice(0, value.indexOf(key)) + translated + value.slice(value.indexOf(key) + key.length)
    : translated;
  return spaced.replace(/\{(\d+)\}/g, (match, index) => Object.hasOwn(params, index) ? String(params[index] ?? '') : match);
}
