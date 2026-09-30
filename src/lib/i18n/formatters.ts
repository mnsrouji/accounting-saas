// =============================================================
// Formatting Utilities — Localized Dates, Numbers & Currencies
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { SupportedLocale } from './translations'

export function formatLocalizedCurrency(
  amount: number,
  currencyCode = 'USD',
  locale: SupportedLocale = 'en',
  decimalPlaces = 2
): string {
  const intlLocale = locale === 'ar' ? 'ar-SA' : locale === 'tr' ? 'tr-TR' : 'en-US'

  try {
    const formatted = new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(amount)

    return formatted
  } catch {
    // Fallback if currency code is custom
    const num = amount.toLocaleString(intlLocale, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    })
    return `${currencyCode} ${num}`
  }
}

export function formatLocalizedDate(
  date: Date | string,
  formatPattern = 'YYYY-MM-DD',
  locale: SupportedLocale = 'en'
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  switch (formatPattern) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`
    case 'YYYY-MM-DD':
    default:
      return `${year}-${month}-${day}`
  }
}

export function formatLocalizedNumber(
  num: number,
  precision = 2,
  locale: SupportedLocale = 'en',
  numberFormat = 'standard'
): string {
  const intlLocale = locale === 'ar' ? 'ar-SA' : locale === 'tr' ? 'tr-TR' : 'en-US'

  return num.toLocaleString(intlLocale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    useGrouping: numberFormat !== 'none',
  })
}
