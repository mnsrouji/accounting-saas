'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { registerAction } from '@/actions/auth/auth-actions'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'

export default function RegisterPage() {
  const t = useTranslations('auth')
  const tApp = useTranslations('app')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const result = await registerAction(formData)
      if (result && !result.success) {
        setError(result.error)
      }
    })
  }

  return (
    <main className="auth-page">
      <div className="auth-page-header">
        <LanguageSwitcher />
      </div>

      <div className="auth-card animate-fade-in">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-mark">A</div>
          <span className="auth-logo-name">{tApp('name')}</span>
        </div>

        <h1 className="auth-title">{t('register')}</h1>
        <p className="auth-subtitle">{tApp('tagline')}</p>

        {/* Error */}
        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: '0.5rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="auth-label" htmlFor="fullName">{t('full_name')}</label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              className="auth-input"
              placeholder="John Smith"
              required
              autoComplete="name"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="auth-label" htmlFor="email">{t('email')}</label>
            <input
              id="email"
              name="email"
              type="email"
              className="auth-input"
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="auth-label" htmlFor="password">{t('password')}</label>
            <input
              id="password"
              name="password"
              type="password"
              className="auth-input"
              placeholder="Min. 8 characters"
              required
              autoComplete="new-password"
            />
          </div>

          <button
            id="register-submit-btn"
            type="submit"
            className={`btn btn-primary btn-lg btn-full${isPending ? ' btn-loading' : ''}`}
            disabled={isPending}
            style={{ marginTop: '0.5rem' }}
          >
            {isPending ? '...' : t('register')}
          </button>
        </form>

        <div className="auth-footer">
          {t('have_account')}{' '}
          <Link href="/login">{t('login')}</Link>
        </div>
      </div>
    </main>
  )
}

