import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ar from '@/src/i18n/ar.json';
import en from '@/src/i18n/en.json';
import { normalizeLocale } from '@/src/utils/date';

let initialized = false;

export const getDeviceLocale = (): 'ar' | 'en' => {
  const locale = Localization.getLocales()[0]?.languageTag ?? 'ar';
  return normalizeLocale(locale);
};

export const initI18n = async (preferredLocale?: 'ar' | 'en') => {
  if (initialized) {
    if (preferredLocale) {
      await i18n.changeLanguage(preferredLocale);
    }
    return i18n;
  }

  const fallback = getDeviceLocale();
  await i18n.use(initReactI18next).init({
    compatibilityJSON: 'v4',
    lng: preferredLocale ?? fallback,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
  });

  initialized = true;
  return i18n;
};

export default i18n;
