import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { AccountingService } from '@/lib/services/accounting-service'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { LedgerFilter } from './LedgerFilter'
import { formatCurrency, formatDate } from '@/utils/decimal'
import { getLocalizedAccountName, getLocalizedAccountType, getLocalizedNormalBalance } from '@/lib/i18n/account-i18n'

export const metadata: Metadata = {
  title: 'General Ledger | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
  searchParams?: Promise<{ accountId?: string; fromDate?: string; toDate?: string }>
}

export default async function GeneralLedgerPage({ params, searchParams }: PageProps) {
  const { businessId } = await params
  const sParams = (await searchParams) || {}
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  const { business } = await requireBusinessAccess(businessId)

  const t = {
    title: isAr ? 'دفتر الأستاذ العام' : isTr ? 'Büyük Defter (Kebir)' : 'General Ledger',
    subtitle: isAr
      ? 'استعراض كشوفات الحسابات وحركات المدين والدائن مع حساب الرصيد المتراكم لحظياً'
      : isTr
      ? 'Kronolojik yürüyen bakiye hesaplamalı ayrıntılı işlem defteri'
      : 'Detailed transaction ledger with chronological running balance calculation',
    back: isAr ? 'العودة للمحاسبة' : isTr ? 'Muhasebeye Dön' : 'Back to Accounting',
    endingBalance: isAr ? 'الرصيد الختامي المتراكم:' : isTr ? 'Kapanış Yürüyen Bakiyesi:' : 'Ending Running Balance:',
    normal: isAr ? 'طبيعة الحساب' : isTr ? 'normal' : 'normal',
    date: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    entryNumber: isAr ? 'رقم القيد' : isTr ? 'Yevmiye No' : 'Entry #',
    descParty: isAr ? 'البيان / الطرف المعني' : isTr ? 'Açıklama / İlgili Taraf' : 'Description / Party',
    debit: isAr ? 'مدين' : isTr ? 'Borç' : 'Debit',
    credit: isAr ? 'دائن' : isTr ? 'Alacak' : 'Credit',
    runningBalance: isAr ? 'الرصيد التراكمي' : isTr ? 'Yürüyen Bakiye' : 'Running Balance',
    noEntries: isAr
      ? 'لا توجد قيود مرحلة لهذا الحساب خلال الفترة المحددة.'
      : isTr
      ? 'Seçilen dönemde bu hesap için kayıtlı yevmiye satırı bulunamadı.'
      : 'No posted journal entry lines for this account during the selected period.',
    party: isAr ? 'الطرف:' : isTr ? 'Taraf:' : 'Party:',
  }

  const accounts = await prisma.chartOfAccount.findMany({
    where: { businessId, isActive: true },
    select: { id: true, code: true, name: true, type: true },
    orderBy: { code: 'asc' },
  })

  const selectedAccountId = sParams.accountId || accounts[0]?.id

  let ledgerResult: any = null
  if (selectedAccountId) {
    try {
      const fromDate = sParams.fromDate ? new Date(sParams.fromDate) : undefined
      const toDate = sParams.toDate ? new Date(sParams.toDate) : undefined
      ledgerResult = await AccountingService.getGeneralLedger(businessId, selectedAccountId, fromDate, toDate)
    } catch (e) {
      ledgerResult = null
    }
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
            <p className="page-subtitle">{t.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Account Selector Filter */}
      <LedgerFilter
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        fromDate={sParams.fromDate || ''}
        toDate={sParams.toDate || ''}
      />

      {/* Ledger Report Display */}
      {ledgerResult && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            className="card-header"
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div>
              <span className="card-title">
                {ledgerResult.account.code} - {getLocalizedAccountName(ledgerResult.account.code, ledgerResult.account.name, locale)}
              </span>
              <span className="badge badge-primary" style={{ marginInlineStart: '0.5rem' }}>
                {getLocalizedAccountType(ledgerResult.account.type, locale)} ({getLocalizedNormalBalance(ledgerResult.account.normalBalance, locale)})
              </span>
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>
              {t.endingBalance}{' '}
              <span style={{ color: 'var(--color-brand-500)' }}>
                {formatCurrency(ledgerResult.endingBalance, business.defaultCurrency)}
              </span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: isAr ? 'right' : 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.date}</th>
                  <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.entryNumber}</th>
                  <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem' }}>{t.descParty}</th>
                  <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: 'right' }}>{t.debit}</th>
                  <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: 'right' }}>{t.credit}</th>
                  <th style={{ padding: '0.625rem 1rem', fontSize: '0.75rem', textAlign: 'right' }}>{t.runningBalance}</th>
                </tr>
              </thead>
              <tbody>
                {ledgerResult.entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      {t.noEntries}
                    </td>
                  </tr>
                ) : (
                  ledgerResult.entries.map((entry: any) => (
                    <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{formatDate(entry.entryDate)}</td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-brand-500)' }}>
                        {entry.entryNumber}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                        <div>{entry.description || '—'}</div>
                        {entry.partyName && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {t.party} {entry.partyName}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: entry.debit > 0 ? 600 : 400 }}>
                        {entry.debit > 0 ? formatCurrency(entry.debit, business.defaultCurrency) : '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: entry.credit > 0 ? 600 : 400 }}>
                        {entry.credit > 0 ? formatCurrency(entry.credit, business.defaultCurrency) : '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', textAlign: 'right', fontWeight: 700 }}>
                        {formatCurrency(entry.runningBalance, business.defaultCurrency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

