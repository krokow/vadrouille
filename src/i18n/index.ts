/**
 * i18n : les clés SONT les textes français (keySeparator désactivé).
 * Pour traduire en anglais, il suffit de compléter `en.json` (clé française → texte anglais).
 * Une clé absente retombe sur le texte français.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'

const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('vadrouille-lang') : null

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: {} }, en: { translation: en } },
  lng: saved ?? 'fr',
  fallbackLng: false,
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnEmptyString: false,
})

export function setLanguage(lng: 'fr' | 'en') {
  localStorage.setItem('vadrouille-lang', lng)
  void i18n.changeLanguage(lng)
  document.documentElement.lang = lng
}

export default i18n
