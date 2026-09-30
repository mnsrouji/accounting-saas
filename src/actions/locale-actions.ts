'use server'

import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/prisma'
import { createServerClient } from '@supabase/ssr'
import { locales, type Locale, defaultLocale } from '@/i18n/locales'

export async function setLocaleAction(locale: string) {
  if (!locales.includes(locale as Locale)) {
    return { success: false, error: 'Invalid locale' }
  }

  const cookieStore = await cookies()
  // Set cookie for 1 year
  cookieStore.set('locale', locale, {
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
    sameSite: 'lax',
  })

  // Also try updating user record in DB if logged in
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id) {
      await prisma.user.update({
        where: { id: user.id },
        data: { preferredLanguage: locale },
      }).catch(() => null)
    }
  } catch {
    // Non-blocking if auth fails or during public browsing
  }

  return { success: true, locale }
}
