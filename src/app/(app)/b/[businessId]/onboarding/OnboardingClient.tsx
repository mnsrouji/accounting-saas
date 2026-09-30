'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import {
  saveOnboardingStepAction,
  completeOnboardingAction,
} from '@/actions/saas/onboarding-actions'
import {
  Building2,
  Globe,
  Calendar,
  Percent,
  Layers,
  Warehouse,
  Users,
  CreditCard,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  SkipForward,
  Sparkles,
} from 'lucide-react'

interface PlanItem {
  id: string
  code: string
  name: string
  price: any
  maxUsers: number
  maxInvoicesPerMonth: number
  features: any
}

interface OnboardingClientProps {
  initialData: {
    businessId: string
    currentStep: number
    isCompleted: boolean
    business: {
      id: string
      name: string
      legalName?: string | null
      defaultCurrency: string
      country?: string | null
      timezone: string
      fiscalYearStart: string
      taxNumber?: string | null
    }
    stepData: Record<string, any>
    totalSteps: number
  }
  plans: PlanItem[]
}

const STEP_METADATA = [
  { step: 1, title: 'Business Profile', icon: Building2 },
  { step: 2, title: 'Region & Currency', icon: Globe },
  { step: 3, title: 'Fiscal Year', icon: Calendar },
  { step: 4, title: 'Tax & VAT', icon: Percent },
  { step: 5, title: 'Chart of Accounts', icon: Layers },
  { step: 6, title: 'Warehouse', icon: Warehouse },
  { step: 7, title: 'Team Members', icon: Users },
  { step: 8, title: 'Subscription Plan', icon: CreditCard },
  { step: 9, title: 'Launch', icon: CheckCircle },
]

export default function OnboardingClient({ initialData, plans }: OnboardingClientProps) {
  const router = useRouter()
  const activeLocale = useLocale()
  const [step, setStep] = useState(initialData.currentStep || 1)
  const [locale, setLocale] = useState<'en' | 'ar' | 'tr'>(
    (activeLocale === 'ar' || activeLocale === 'tr' || activeLocale === 'en') ? activeLocale : 'ar'
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isRtl = locale === 'ar'

  // Form states initialized with existing business values
  const [businessName, setBusinessName] = useState(initialData.business.name || '')
  const [legalName, setLegalName] = useState(initialData.business.legalName || '')
  const [taxNumber, setTaxNumber] = useState(initialData.business.taxNumber || '')
  const [currency, setCurrency] = useState(initialData.business.defaultCurrency || 'USD')
  const [country, setCountry] = useState(initialData.business.country || 'US')
  const [timezone, setTimezone] = useState(initialData.business.timezone || 'UTC')
  const [fiscalYearStart, setFiscalYearStart] = useState(initialData.business.fiscalYearStart || '01-01')
  const [taxName, setTaxName] = useState('Standard VAT')
  const [taxRate, setTaxRate] = useState('15')
  const [coaTemplate, setCoaTemplate] = useState('standard')
  const [warehouseName, setWarehouseName] = useState('Main Distribution Warehouse')
  const [warehouseCode, setWarehouseCode] = useState('WH-01')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'accountant' | 'sales_user' | 'inventory_user'>('accountant')
  const [invitations, setInvitations] = useState<Array<{ email: string; role: any }>>([])
  const [selectedPlan, setSelectedPlan] = useState('starter')

  function addInvitation() {
    if (inviteEmail.trim() && !invitations.some((i) => i.email === inviteEmail.trim())) {
      setInvitations([...invitations, { email: inviteEmail.trim(), role: inviteRole }])
      setInviteEmail('')
    }
  }

  function handleNext(skip = false) {
    setError(null)
    startTransition(async () => {
      const payload: Record<string, any> = {}

      if (step === 1) payload.name = businessName; payload.legalName = legalName; payload.taxNumber = taxNumber
      if (step === 2) payload.defaultCurrency = currency; payload.country = country; payload.timezone = timezone
      if (step === 3) payload.fiscalYearStart = fiscalYearStart
      if (step === 4) payload.taxName = taxName; payload.defaultTaxRate = Number(taxRate)
      if (step === 5) payload.coaTemplate = coaTemplate
      if (step === 6) payload.warehouseName = warehouseName; payload.warehouseCode = warehouseCode
      if (step === 7) payload.invitations = invitations
      if (step === 8) payload.planCode = selectedPlan

      if (!skip) {
        const res = await saveOnboardingStepAction(initialData.businessId, step, payload)
        if (!res.success) {
          setError(res.error)
          return
        }
      }

      if (step < 9) {
        setStep(step + 1)
      } else {
        await completeOnboardingAction(initialData.businessId)
        router.push(`/b/${initialData.businessId}/dashboard`)
      }
    })
  }

  async function handleFinish() {
    startTransition(async () => {
      await completeOnboardingAction(initialData.businessId)
      router.push(`/b/${initialData.businessId}/dashboard`)
    })
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #09090b 100%)',
        color: '#f8fafc',
        padding: '2rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          width: '100%',
          maxWidth: 800,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.125rem',
            }}
          >
            A
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>AccountFlow ERP</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Guided Workspace Onboarding</div>
          </div>
        </div>

        {/* Language selector */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['en', 'ar', 'tr'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              style={{
                background: locale === l ? '#4f46e5' : 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: locale === l ? 700 : 400,
              }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 800,
          background: 'rgba(24, 24, 27, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: '2.5rem',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Step Progress Bar */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#818cf8' }}>
              Step {step} of 9: {STEP_METADATA[step - 1].title}
            </span>
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
              {Math.round((step / 9) * 100)}% Complete
            </span>
          </div>
          <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                width: `${(step / 9) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {/* Step 1: Business Profile */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Company Profile</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Enter your official company details for invoices and statutory reporting.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#cbd5e1', marginBottom: 4 }}>Display Name *</label>
                <input
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff' }}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Acme Global Ltd"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#cbd5e1', marginBottom: 4 }}>Legal Registered Name</label>
                <input
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff' }}
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Official legal entity name"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#cbd5e1', marginBottom: 4 }}>Tax / VAT Registration Number</label>
                <input
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff' }}
                  value={taxNumber}
                  onChange={(e) => setTaxNumber(e.target.value)}
                  placeholder="e.g. VAT-99887766"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Region & Currency */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Region & Currency</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Set your primary operating currency and timezone for transactions.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#cbd5e1', marginBottom: 4 }}>Base Operating Currency *</label>
                <select
                  style={{ width: '100%', padding: '10px 12px', background: '#18181b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff' }}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="TRY">TRY — Turkish Lira</option>
                  <option value="AED">AED — UAE Dirham</option>
                  <option value="SAR">SAR — Saudi Riyal</option>
                  <option value="GBP">GBP — British Pound</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#cbd5e1', marginBottom: 4 }}>Country Code</label>
                <input
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff' }}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. US, AE, TR, SA"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#cbd5e1', marginBottom: 4 }}>Timezone</label>
                <input
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff' }}
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Fiscal Year */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Fiscal Year Setup</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Define when your annual accounting cycle begins for balance sheet closing.
            </p>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: '#cbd5e1', marginBottom: 4 }}>Fiscal Year Start (MM-DD)</label>
              <input
                style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff' }}
                value={fiscalYearStart}
                onChange={(e) => setFiscalYearStart(e.target.value)}
                placeholder="01-01 (Calendar Year)"
              />
            </div>
          </div>
        )}

        {/* Step 4: Tax Configuration */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Tax & VAT Configuration</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Configure your default sales and purchase tax rates.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#cbd5e1', marginBottom: 4 }}>Tax Name</label>
                <input
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff' }}
                  value={taxName}
                  onChange={(e) => setTaxName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#cbd5e1', marginBottom: 4 }}>Default Rate (%)</label>
                <input
                  type="number"
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff' }}
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Chart of Accounts Setup */}
        {step === 5 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Chart of Accounts</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Choose an industry template for your double-entry General Ledger structure.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { id: 'standard', name: 'Standard Commercial & Trading', desc: 'Standard 4-digit accounts covering Cash, AR, AP, Inventory, Sales, COGS' },
                { id: 'services', name: 'Professional Services & Consulting', desc: 'Optimized for non-inventory businesses, hourly billing, and consulting fees' },
                { id: 'retail', name: 'Retail & Multi-Warehouse Distribution', desc: 'Detailed cost tracking with shrinkage, POS clearing, and multiple warehouses' },
              ].map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => setCoaTemplate(tpl.id)}
                  style={{
                    padding: '1rem',
                    borderRadius: 8,
                    border: `1px solid ${coaTemplate === tpl.id ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                    background: coaTemplate === tpl.id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, color: coaTemplate === tpl.id ? '#818cf8' : '#fff' }}>{tpl.name}</div>
                  <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: 2 }}>{tpl.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 6: Warehouse Setup */}
        {step === 6 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Primary Warehouse</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Configure your default inventory storage location.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#cbd5e1', marginBottom: 4 }}>Warehouse Name</label>
                <input
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff' }}
                  value={warehouseName}
                  onChange={(e) => setWarehouseName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', color: '#cbd5e1', marginBottom: 4 }}>Warehouse Code</label>
                <input
                  style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff' }}
                  value={warehouseCode}
                  onChange={(e) => setWarehouseCode(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 7: Team Members */}
        {step === 7 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Invite Teammates</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Add colleagues to your business with specific roles.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <input
                style={{ flex: 2, padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff' }}
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <select
                style={{ flex: 1, padding: '10px 12px', background: '#18181b', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: '#fff' }}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
              >
                <option value="accountant">Accountant</option>
                <option value="sales_user">Sales User</option>
                <option value="inventory_user">Inventory User</option>
              </select>
              <button
                type="button"
                onClick={addInvitation}
                style={{ background: '#4f46e5', color: '#fff', padding: '10px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                Add
              </button>
            </div>

            {invitations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {invitations.map((inv, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, fontSize: '0.875rem' }}>
                    <span>{inv.email}</span>
                    <span style={{ color: '#818cf8', fontWeight: 600 }}>{inv.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 8: Subscription Plan Selection */}
        {step === 8 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Select Subscription Tier</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Choose the plan that fits your business scale. All tiers include a 14-day trial period.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {plans.map((p) => (
                <div
                  key={p.code}
                  onClick={() => setSelectedPlan(p.code)}
                  style={{
                    padding: '1.25rem',
                    borderRadius: 12,
                    border: `1px solid ${selectedPlan === p.code ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                    background: selectedPlan === p.code ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '1.125rem', color: '#fff' }}>{p.name}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#818cf8', margin: '0.5rem 0' }}>
                    ${Number(p.price)} <span style={{ fontSize: '0.8125rem', color: '#94a3b8', fontWeight: 400 }}>/ mo</span>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#cbd5e1' }}>
                    ✓ Up to {p.maxUsers} users<br />
                    ✓ Up to {p.maxInvoicesPerMonth} invoices/mo
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 9: Ready to Launch */}
        {step === 9 && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <Sparkles size={36} />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.75rem' }}>You are Ready to Launch!</h2>
            <p style={{ color: '#94a3b8', maxWidth: 480, margin: '0 auto 2rem', fontSize: '0.9375rem', lineHeight: 1.6 }}>
              Your workspace <strong>{businessName}</strong> is fully configured with multi-currency GL, warehouse inventory, and automated billing.
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                disabled={isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#94a3b8',
                  padding: '8px 16px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                <ArrowLeft size={16} /> Back
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {step < 9 && (
              <button
                type="button"
                onClick={() => handleNext(true)}
                disabled={isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Skip <SkipForward size={16} />
              </button>
            )}

            {step < 9 ? (
              <button
                type="button"
                onClick={() => handleNext(false)}
                disabled={isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#4f46e5',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 24px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                {isPending ? 'Saving...' : 'Continue'} <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={isPending}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 32px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '1rem',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                }}
              >
                {isPending ? 'Launching...' : '🚀 Open ERP Dashboard'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
