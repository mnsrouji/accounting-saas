// =============================================================
// Platform Admin Plans Page — SaaS Tiers & Entitlements Config
// Phase 14: SaaS Platform Administration & Subscriptions
// =============================================================

import { PlanService } from '@/lib/services/plan-service'
import { prisma } from '@/lib/db/prisma'
import { CreditCard, Check, X, Users, FileText, Layers, Shield } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlatformPlansPage() {
  const plans = await PlanService.getPlans(true)

  // Get active subscription counts per plan
  const subCounts = await prisma.subscription.groupBy({
    by: ['planId'],
    _count: { id: true },
  })

  const subCountMap = new Map(subCounts.map((s) => [s.planId, s._count.id]))

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <CreditCard size={24} color="#34d399" />
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
              Subscription Plans & Entitlements
            </h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Configure tier pricing, feature entitlements, and tenant resource ceilings
          </p>
        </div>
      </div>

      {/* Plan Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        {plans.map((p) => {
          const activeSubCount = subCountMap.get(p.id) || 0
          const features = (p.features as Record<string, boolean>) || {}

          return (
            <div
              key={p.id}
              style={{
                background: '#0d1322',
                border: p.code === 'professional' ? '2px solid #4f46e5' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {p.code === 'professional' && (
                <div
                  style={{
                    position: 'absolute',
                    top: -12,
                    right: 16,
                    background: '#4f46e5',
                    color: '#ffffff',
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.5rem',
                    borderRadius: 6,
                    textTransform: 'uppercase',
                  }}
                >
                  Most Popular
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  {p.name}
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '0.375rem', minHeight: 40 }}>
                  {p.description}
                </p>
              </div>

              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc' }}>
                  ${Number(p.price)}
                </span>
                <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  / {p.billingInterval}
                </span>
              </div>

              {/* Metrics / Limits */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 8,
                  padding: '0.875rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '0.8125rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Max Users:</span>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>{p.maxUsers} seats</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Max Invoices:</span>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>{p.maxInvoicesPerMonth} / mo</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Active Tenants:</span>
                  <span style={{ fontWeight: 600, color: '#38bdf8' }}>{activeSubCount}</span>
                </div>
              </div>

              {/* Feature Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem', flex: 1, marginBottom: '1.5rem' }}>
                {[
                  { key: 'crm', label: 'CRM & Pipelines' },
                  { key: 'advanced_crm', label: 'Advanced CRM 360' },
                  { key: 'treasury', label: 'Treasury & Cash' },
                  { key: 'bank_reconciliation', label: 'Bank Auto-Reconciliation' },
                  { key: 'advanced_inventory', label: 'Batch/Serial & Transfers' },
                  { key: 'multi_currency', label: 'Multi-Currency GL' },
                  { key: 'financial_reports', label: 'Financial BI Statements' },
                  { key: 'api_access', label: 'REST API Access' },
                ].map((feat) => {
                  const isIncluded = features[feat.key] ?? false
                  return (
                    <div key={feat.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {isIncluded ? (
                        <Check size={14} color="#34d399" />
                      ) : (
                        <X size={14} color="#64748b" />
                      )}
                      <span style={{ color: isIncluded ? '#f1f5f9' : '#64748b' }}>
                        {feat.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
