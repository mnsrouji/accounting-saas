import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { localeConfig } from '@/i18n/locales'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'AccountFlow — Smart Business Accounting',
    template: '%s | AccountFlow',
  },
  description:
    'Professional multi-tenant accounting and business management platform. Manage customers, suppliers, invoices, payments, inventory, and financial reports.',
  keywords: ['accounting', 'invoicing', 'business management', 'SaaS', 'double-entry', 'financial reports'],
  authors: [{ name: 'AccountFlow' }],
  robots: 'index, follow',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    type: 'website',
    siteName: 'AccountFlow',
    title: 'AccountFlow — Smart Business Accounting',
    description: 'Professional multi-tenant accounting and business management platform.',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()
  const dir = localeConfig[locale as keyof typeof localeConfig]?.dir ?? 'ltr'

  return (
    <html lang={locale} dir={dir}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
