'use client'

import { useState, useTransition } from 'react'
import { createBusinessAction } from '@/actions/businesses/business-actions'
import { logoutAction } from '@/actions/auth/auth-actions'
import { Building2, Globe, CheckCircle, LogOut } from 'lucide-react'

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
  { code: 'TRY', label: 'Turkish Lira (TRY)' },
  { code: 'AED', label: 'UAE Dirham (AED)' },
  { code: 'SAR', label: 'Saudi Riyal (SAR)' },
  { code: 'EGP', label: 'Egyptian Pound (EGP)' },
  { code: 'CAD', label: 'Canadian Dollar (CAD)' },
  { code: 'AUD', label: 'Australian Dollar (AUD)' },
]

const COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'TR', label: 'Turkey' },
  { code: 'EG', label: 'Egypt' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'OTHER', label: 'Other' },
]

interface OnboardingClientProps {
  userEmail: string
}

export default function OnboardingClient({ userEmail }: OnboardingClientProps) {
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    taxNumber: '',
    defaultCurrency: 'USD',
    country: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    setError(null)
    const data = new FormData()
    Object.entries(formData).forEach(([k, v]) => data.append(k, v))

    startTransition(async () => {
      const result = await createBusinessAction(data)
      if (result && !result.success) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="onboarding-container">
      <div className="onboarding-card animate-fade-in">
        {/* Header with Logo and Logout */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.25rem', fontWeight: 800, color: 'white', fontFamily: 'Outfit, sans-serif',
              boxShadow: '0 4px 14px rgba(99,102,241,0.5)',
            }}>A</div>
            <div>
              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.15rem', fontWeight: 700, color: 'white' }}>
                AccountFlow
              </div>
              {userEmail && (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {userEmail}
                </div>
              )}
            </div>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#f87171',
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </form>
        </div>

        {/* Step indicator */}
        <div className="step-indicator">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`step-dot ${s < step ? 'done' : s === step ? 'active' : ''}`}
            />
          ))}
        </div>

        {/* Step 1: Business Name */}
        {step === 1 && (
          <div className="animate-fade-in">
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
                <Building2 size={20} style={{ color: '#818cf8' }} />
                <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'white', fontFamily: 'Outfit, sans-serif' }}>
                  Name your business
                </h1>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                You can always change this later in settings.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="auth-label" htmlFor="bus-name">Business Name *</label>
                <input
                  id="bus-name"
                  className="auth-input"
                  placeholder="e.g. Acme Trading Co."
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="auth-label" htmlFor="bus-legal-name">Legal Name (Optional)</label>
                <input
                  id="bus-legal-name"
                  className="auth-input"
                  placeholder="Official registered name"
                  value={formData.legalName}
                  onChange={(e) => updateField('legalName', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="auth-label" htmlFor="bus-tax">Tax / VAT Number (Optional)</label>
                <input
                  id="bus-tax"
                  className="auth-input"
                  placeholder="e.g. GB123456789"
                  value={formData.taxNumber}
                  onChange={(e) => updateField('taxNumber', e.target.value)}
                />
              </div>

              <button
                id="onboarding-next-1"
                className="btn btn-primary btn-lg btn-full"
                onClick={() => {
                  if (!formData.name.trim()) {
                    setError('Business name is required.')
                    return
                  }
                  setError(null)
                  setStep(2)
                }}
                style={{ marginTop: '0.5rem' }}
              >
                Continue →
              </button>
              {error && <p style={{ color: '#fca5a5', fontSize: '0.875rem', textAlign: 'center' }}>{error}</p>}
            </div>
          </div>
        )}

        {/* Step 2: Currency & Country */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
                <Globe size={20} style={{ color: '#818cf8' }} />
                <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'white', fontFamily: 'Outfit, sans-serif' }}>
                  Region & Currency
                </h1>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                This determines your default reporting currency.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="auth-label" htmlFor="bus-currency">Default Currency *</label>
                <select
                  id="bus-currency"
                  className="form-select"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'white', borderColor: 'rgba(255,255,255,0.1)' }}
                  value={formData.defaultCurrency}
                  onChange={(e) => updateField('defaultCurrency', e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="auth-label" htmlFor="bus-country">Country</label>
                <select
                  id="bus-country"
                  className="form-select"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'white', borderColor: 'rgba(255,255,255,0.1)' }}
                  value={formData.country}
                  onChange={(e) => updateField('country', e.target.value)}
                >
                  <option value="">Select country...</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className="btn btn-secondary btn-lg" onClick={() => setStep(1)} style={{ flex: 1 }}>
                  ← Back
                </button>
                <button
                  id="onboarding-next-2"
                  className="btn btn-primary btn-lg"
                  onClick={() => { setError(null); setStep(3) }}
                  style={{ flex: 2 }}
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="animate-fade-in">
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
                <CheckCircle size={20} style={{ color: '#10b981' }} />
                <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'white', fontFamily: 'Outfit, sans-serif' }}>
                  Ready to launch!
                </h1>
              </div>
              <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                Review your business details and create your workspace.
              </p>
            </div>

            {/* Summary */}
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '1.25rem',
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.875rem',
            }}>
              {[
                { label: 'Business Name', value: formData.name },
                { label: 'Currency', value: formData.defaultCurrency },
                { label: 'Country', value: formData.country || 'Not specified' },
                { label: 'Timezone', value: formData.timezone },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: '#64748b' }}>{row.label}</span>
                  <span style={{ color: 'white', fontWeight: 500 }}>{row.value}</span>
                </div>
              ))}
            </div>

            <div style={{
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 10,
              padding: '0.875rem',
              marginBottom: '1.5rem',
              fontSize: '0.8125rem',
              color: '#a5b4fc',
            }}>
              ✓ A default Chart of Accounts will be created automatically<br />
              ✓ A default Cash account will be set up<br />
              ✓ You will be the Owner of this business
            </div>

            {error && (
              <div style={{ color: '#fca5a5', fontSize: '0.875rem', marginBottom: '1rem', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary btn-lg" onClick={() => setStep(2)} style={{ flex: 1 }}>
                ← Back
              </button>
              <button
                id="onboarding-create-btn"
                className={`btn btn-primary btn-lg${isPending ? ' btn-loading' : ''}`}
                onClick={handleSubmit}
                disabled={isPending}
                style={{ flex: 2 }}
              >
                {isPending ? 'Creating...' : '🚀 Create Business'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
