// =============================================================
// Billing Settings Page — Invoice History & Provider Management
// Phase 15: Billing Integration, Webhooks & Production Infrastructure
// =============================================================

'use client'

import { useState, useTransition } from 'react'
import {
  CreditCard,
  Receipt,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  ArrowRight,
  Zap,
  Shield,
  Loader2,
} from 'lucide-react'
import { useLocale } from 'next-intl'
import { createBillingCheckout, createBillingPortal, cancelSubscription } from '@/actions/saas/billing-actions'

interface Invoice {
  providerId: string
  amount: number
  currency: string
  status: string
  paidAt?: Date
  invoiceUrl?: string
  invoicePdfUrl?: string
  periodStart?: Date
  periodEnd?: Date
}

interface BillingPageClientProps {
  businessId: string
  providerName: string
  subscription: {
    status: string
    isTrial: boolean
    daysRemainingInTrial?: number
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: Date
    plan: {
      name: string
      code: string
      price: number
      billingInterval: string
    }
  }
  invoices: Invoice[]
}

export default function BillingPageClient({
  businessId,
  providerName,
  subscription,
  invoices,
}: BillingPageClientProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const t = {
    provider: isAr ? 'بوابة الدفع:' : isTr ? 'Ödeme Sağlayıcı:' : 'Provider:',
    currentPlan: isAr ? 'الخطة الحالية' : isTr ? 'Mevcut Paket' : 'Current Plan',
    monthlyPrice: isAr ? 'السعر الشهري' : isTr ? 'Aylık Ücret' : 'Monthly Price',
    renewsDate: isAr ? 'تاريخ التجديد / الانتهاء' : isTr ? 'Yenilenme / Bitiş Tarihi' : 'Renews / Ends',
    trialDaysLeft: isAr ? 'الأيام المتبقية للتجربة' : isTr ? 'Kalan Deneme Günü' : 'Trial Days Left',
    cancelingNotice: isAr ? 'سيتم الإلغاء عند نهاية الفترة' : isTr ? 'Dönem sonunda iptal edilecek' : 'Canceling at period end',
    upgradeBtn: isAr ? 'ترقية الباقة' : isTr ? 'Paketi Yükselt' : 'Upgrade Plan',
    manageBillingBtn: isAr ? 'إدارة الفوترة والبطاقات' : isTr ? 'Faturalandırmayı Yönet' : 'Manage Billing',
    cancelSubBtn: isAr ? 'إلغاء تجديد الاشتراك' : isTr ? 'Aboneliği İptal Et' : 'Cancel Subscription',
    confirmCancelQ: isAr ? 'تأكيد إلغاء التجديد؟' : isTr ? 'İptal onaylansın mı?' : 'Confirm cancellation?',
    yesCancel: isAr ? 'نعم، قم بالإلغاء' : isTr ? 'Evet, iptal et' : 'Yes, cancel',
    noKeep: isAr ? 'تراجع' : isTr ? 'Vazgeç' : 'No, keep',
    invoicesTitle: isAr ? 'سجل المدفوعات والفواتير' : isTr ? 'Fatura ve Ödeme Geçmişi' : 'Payment History',
    noInvoices: isAr ? 'لا توجد فواتير سابقة' : isTr ? 'Henüz fatura yok' : 'No invoices yet',
    noInvoicesDesc: isAr ? 'ستظهر الفواتير هنا بعد إتمام عمليات الدفع' : isTr ? 'Faturalar ilk ödemenizden sonra burada görünecektir' : 'Invoices appear after your first payment',
    days: isAr ? 'أيام' : isTr ? 'gün' : 'days',
    downloadPdf: isAr ? 'تحميل الفاتورة PDF' : isTr ? 'Fatura PDF İndir' : 'Download PDF',
  }

  function formatCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat(isAr ? 'ar-SA' : isTr ? 'tr-TR' : 'en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100)
  }

  function formatDate(date: Date | string | undefined) {
    if (!date) return '—'
    return new Date(date).toLocaleDateString(isAr ? 'ar-SA' : isTr ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  function handleManageBilling() {
    startTransition(async () => {
      const result = await createBillingPortal(businessId)
      if (result.success && result.url) {
        window.location.href = result.url
      } else {
        setMessage({ type: 'error', text: result.error || (isAr ? 'فشل فتح بوابة الفوترة' : 'Failed to open billing portal') })
      }
    })
  }

  function handleUpgrade(planCode: string) {
    startTransition(async () => {
      const result = await createBillingCheckout(businessId, {
        planCode,
        billingInterval: 'month',
      })
      if (result.success && result.url) {
        window.location.href = result.url
      } else {
        setMessage({ type: 'error', text: result.error || (isAr ? 'فشل بدء عملية الترقية' : 'Failed to start checkout') })
      }
    })
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelSubscription(businessId, false)
      if (result.success) {
        setMessage({ type: 'success', text: isAr ? 'سيتم إلغاء الاشتراك عند نهاية الفترة الحالية.' : 'Subscription will cancel at end of billing period.' })
        setConfirmCancel(false)
      } else {
        setMessage({ type: 'error', text: result.error || (isAr ? 'فشل إلغاء الاشتراك' : 'Failed to cancel subscription') })
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Feedback message */}
      {message && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem',
            borderRadius: '12px',
            border: message.type === 'success' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
            color: message.type === 'success' ? '#10b981' : '#ef4444',
            fontSize: '0.875rem',
            fontWeight: 600,
          }}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{message.text}</span>
          <button
            onClick={() => setMessage(null)}
            style={{ marginInlineStart: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Current Subscription Card */}
      <div
        className="card"
        style={{
          background: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '16px',
          padding: '1.75rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                background: 'rgba(79, 70, 229, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-brand-500, #4f46e5)',
              }}
            >
              <CreditCard size={22} />
            </div>
            <div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>{t.currentPlan}</p>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.15rem 0 0 0' }}>
                {subscription.plan.name}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.25rem 0.65rem',
                borderRadius: '6px',
                background: subscription.status === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                color: subscription.status === 'active' ? '#10b981' : '#f59e0b',
                border: subscription.status === 'active' ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
              }}
            >
              {subscription.status}
            </span>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.25rem 0.65rem',
                borderRadius: '6px',
                background: 'var(--bg-muted, #f8fafc)',
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
              }}
            >
              <Shield size={12} />
              <span>{t.provider} <strong>{providerName}</strong></span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginTop: '1.5rem',
          }}
        >
          <div
            style={{
              padding: '1rem',
              background: 'var(--bg-muted, #f8fafc)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
            }}
          >
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{t.monthlyPrice}</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0 0 0' }}>
              ${subscription.plan.price.toFixed(2)}
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-secondary)', marginInlineStart: '4px' }}>
                /{subscription.plan.billingInterval === 'month' ? (isAr ? 'شهرياً' : 'mo') : subscription.plan.billingInterval}
              </span>
            </p>
          </div>

          <div
            style={{
              padding: '1rem',
              background: 'var(--bg-muted, #f8fafc)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
            }}
          >
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{t.renewsDate}</p>
            <p style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0.25rem 0 0 0' }}>
              {formatDate(subscription.currentPeriodEnd)}
            </p>
          </div>

          {subscription.isTrial && subscription.daysRemainingInTrial !== undefined && (
            <div
              style={{
                padding: '1rem',
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '12px',
              }}
            >
              <p style={{ fontSize: '0.75rem', color: '#3b82f6', margin: 0 }}>{t.trialDaysLeft}</p>
              <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb', margin: '0.25rem 0 0 0' }}>
                {subscription.daysRemainingInTrial} {t.days}
              </p>
            </div>
          )}

          {subscription.cancelAtPeriodEnd && (
            <div
              style={{
                padding: '1rem',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '12px',
              }}
            >
              <p style={{ fontSize: '0.8125rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', margin: 0 }}>
                <Clock size={15} /> {t.cancelingNotice}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ marginTop: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          {subscription.isTrial && (
            <button
              onClick={() => handleUpgrade('professional')}
              disabled={isPending}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '8px', fontWeight: 600 }}
            >
              <Zap size={16} />
              <span>{t.upgradeBtn}</span>
              <ArrowRight size={16} />
            </button>
          )}

          <button
            onClick={handleManageBilling}
            disabled={isPending}
            className="btn btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '8px', fontWeight: 600 }}
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <ExternalLink size={16} />}
            <span>{t.manageBillingBtn}</span>
          </button>

          {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
            !confirmCancel ? (
              <button
                onClick={() => setConfirmCancel(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '0.5rem',
                  textDecoration: 'underline',
                }}
              >
                {t.cancelSubBtn}
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{t.confirmCancelQ}</span>
                <button
                  onClick={handleCancel}
                  disabled={isPending}
                  style={{
                    padding: '0.35rem 0.65rem',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444',
                    color: '#ef4444',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {t.yesCancel}
                </button>
                <button
                  onClick={() => setConfirmCancel(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  {t.noKeep}
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Invoice History */}
      <div
        className="card"
        style={{
          background: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '16px',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Receipt size={18} color="var(--color-brand-500, #4f46e5)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {t.invoicesTitle}
          </h3>
        </div>

        {invoices.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Receipt size={36} style={{ margin: '0 auto 0.75rem auto', opacity: 0.3 }} />
            <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{t.noInvoices}</p>
            <p style={{ fontSize: '0.8125rem', margin: '0.25rem 0 0 0' }}>{t.noInvoicesDesc}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: isAr ? 'right' : 'left' }}>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.providerId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '8px',
                            background: 'var(--bg-muted, #f8fafc)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <Receipt size={16} />
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                            {formatCurrency(inv.amount, inv.currency)}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                            {formatDate(inv.paidAt)}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '1rem 1.5rem', textAlign: isAr ? 'left' : 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: isAr ? 'flex-start' : 'flex-end', gap: '0.75rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            background: inv.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: inv.status === 'paid' ? '#10b981' : '#f59e0b',
                          }}
                        >
                          {inv.status}
                        </span>

                        {inv.invoicePdfUrl && inv.invoicePdfUrl !== '#' && (
                          <a
                            href={inv.invoicePdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '6px',
                              borderRadius: '6px',
                              color: 'var(--text-secondary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title={t.downloadPdf}
                          >
                            <Download size={16} />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
