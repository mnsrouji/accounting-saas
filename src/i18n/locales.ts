export const locales = ['en', 'ar', 'tr'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'ar'

export const localeConfig = {
  en: { label: 'English', dir: 'ltr', flag: '🇺🇸' },
  ar: { label: 'العربية', dir: 'rtl', flag: '🇸🇦' },
  tr: { label: 'Türkçe', dir: 'ltr', flag: '🇹🇷' },
} as const
