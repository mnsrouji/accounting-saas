import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { AccountingService } from '@/lib/services/accounting-service'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'
import { ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react'
import { TrialBalanceFilter } from './TrialBalanceFilter'
import { formatCurrency, formatDate } from '@/utils/decimal'
import { AccountingHealthModal } from '@/components/accounting/AccountingHealthModal'

export const metadata: Metadata = {
  title: 'Trial Balance | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
  searchParams?: Promise<{ asOfDate?: string }>
}

export default async function TrialBalancePage({ params, searchParams }: PageProps) {
  const { businessId } = await params
  const sParams = (await searchParams) || {}
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  const { business } = await requireBusinessAccess(businessId)

  const asOfDate = sParams.asOfDate ? new Date(sParams.asOfDate) : undefined
  const tb = await AccountingService.getTrialBalance(businessId, asOfDate)

  const t = {
    title: isAr ? 'تقرير ميزان المراجعة' : isTr ? 'Mizan Raporu' : 'Trial Balance Report',
    subtitle: (d: string) =>
      isAr
        ? `التحقق من توازن قيود اليومية والحسابات كما في ${d}`
        : isTr
        ? `${d} tarihi itibarıyla çift taraflı kayıt dengesi doğrulaması`
        : `Verification of double-entry ledger balance as of ${d}`,
    back: isAr ? 'العودة للمحاسبة' : isTr ? 'Muhasebeye Dön' : 'Back to Accounting',
    balanced: isAr ? 'ميزان المراجعة متزن' : isTr ? 'Mizan Denk' : 'Double-Entry Balanced',
    unbalanced: isAr ? 'ميزان المراجعة غير متزن!' : isTr ? 'Mizan Denk Değil!' : 'Ledger Unbalanced!',
    code: isAr ? 'رمز الحساب' : isTr ? 'Hesap Kodu' : 'Code',
    accountName: isAr ? 'اسم الحساب' : isTr ? 'Hesap Adı' : 'Account Name',
    type: isAr ? 'النوع' : isTr ? 'Tür' : 'Type',
    netDebit: isAr ? 'صافي المدين' : isTr ? 'Net Borç' : 'Net Debit',
    netCredit: isAr ? 'صافي الدائن' : isTr ? 'Net Alacak' : 'Net Credit',
    totals: isAr ? 'الإجمالي العام:' : isTr ? 'TOPLAM:' : 'TOTALS:',
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            href={`/b/${businessId}/accounting`}
            className="btn btn-secondary btn-sm"
            style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={t.back}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="page-title">{t.title}</h1>
            <p className="page-subtitle">{t.subtitle(formatDate(tb.asOfDate))}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AccountingHealthModal businessId={businessId} />
          {tb.isBalanced ? (
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
              <CheckCircle size={16} /> {t.balanced}
            </span>
          ) : (
            <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}>
              <AlertTriangle size={16} /> {t.unbalanced}
            </span>
          )}
        </div>
      </div>

      {/* Filter */}
      <TrialBalanceFilter asOfDate={sParams.asOfDate || ''} />

      {/* Trial Balance Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-page)', borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', width: '15%' }}>{t.code}</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', width: '35%' }}>{t.accountName}</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', width: '15%' }}>{t.type}</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', width: '17.5%', textAlign: 'right' }}>{t.netDebit}</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', width: '17.5%', textAlign: 'right' }}>{t.netCredit}</th>
              </tr>
            </thead>
            <tbody>
              {tb.accounts.map((acc) => {
                if (acc.netDebit === 0 && acc.netCredit === 0) return null

                return (
                  <tr key={acc.accountId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600 }}>{acc.code}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{acc.name}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem' }}>
                      <span className="badge badge-secondary">{acc.type}</span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: acc.netDebit > 0 ? 600 : 400 }}>
                      {acc.netDebit > 0 ? formatCurrency(acc.netDebit, business.defaultCurrency) : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: acc.netCredit > 0 ? 600 : 400 }}>
                      {acc.netCredit > 0 ? formatCurrency(acc.netCredit, business.defaultCurrency) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-page)', borderTop: '2px solid var(--border-color)', fontWeight: 700, fontSize: '1rem' }}>
                <td colSpan={3} style={{ padding: '1rem', textAlign: isAr ? 'left' : 'right' }}>
                  {t.totals}
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--color-brand-500)' }}>
                  {formatCurrency(tb.totalNetDebit, business.defaultCurrency)}
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--color-brand-500)' }}>
                  {formatCurrency(tb.totalNetCredit, business.defaultCurrency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

