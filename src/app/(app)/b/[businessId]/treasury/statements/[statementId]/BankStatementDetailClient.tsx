'use client'

import React from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import {
  FileSpreadsheet,
  Landmark,
  CheckCheck,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Printer,
} from 'lucide-react'
import { formatCurrency } from '@/utils/decimal'
import { printElement } from '@/utils/print-report'

interface BankStatementDetailClientProps {
  businessId: string
  defaultCurrency: string
  statement: {
    id: string
    statementNumber: string
    bankAccountId: string
    bankAccountName: string
    bankName: string
    accountNumber: string
    currency: string
    startDate: string
    endDate: string
    openingBalance: number
    closingBalance: number
    totalDebit: number
    totalCredit: number
    createdAt: string
  }
  lines: Array<{
    id: string
    date: string
    valueDate: string | null
    description: string
    reference: string | null
    amount: number
    type: string
    externalTxnId: string | null
    runningBalance: number
    isMatched: boolean
    matchedCount: number
  }>
}

export function BankStatementDetailClient({
  businessId,
  defaultCurrency,
  statement,
  lines,
}: BankStatementDetailClientProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const matchedLinesCount = lines.filter((l) => l.isMatched).length
  const matchRate = lines.length > 0 ? Math.round((matchedLinesCount / lines.length) * 100) : 0

  const t = {
    treasury: isAr ? 'الخزينة والمصارف' : isTr ? 'Hazine ve Bankalar' : 'Treasury',
    bankStatements: isAr ? 'كشوف الحسابات البنكية' : isTr ? 'Banka Ekstreleri' : 'Bank Statements',
    statementPrefix: isAr ? 'كشف حساب رقم' : isTr ? 'Ekstre No' : 'Statement #',
    period: isAr ? 'الفترة:' : isTr ? 'Dönem:' : 'Period:',
    to: isAr ? 'إلى' : isTr ? '-' : 'to',
    printStatement: isAr ? 'طباعة كشف الحساب' : isTr ? 'Ekstreyi Yazdır' : 'Print Statement',
    reconcileStatement: isAr ? 'تسوية هذا الكشف' : isTr ? 'Bu Ekstreyi Mutabakat Yap' : 'Reconcile This Statement',
    
    // KPIs
    openingBalance: isAr ? 'الرصيد الافتتاحي للكشف' : isTr ? 'Ekstre Açılış Bakiyesi' : 'Opening Statement Balance',
    closingBalance: isAr ? 'الرصيد الختامي للكشف' : isTr ? 'Ekstre Kapanış Bakiyesi' : 'Closing Statement Balance',
    totalDebits: isAr ? 'إجمالي السحوبات (مدين)' : isTr ? 'Toplam Borç (Çıkışlar)' : 'Total Debits (Withdrawals)',
    totalCredits: isAr ? 'إجمالي الإيداعات (دائن)' : isTr ? 'Toplam Alacak (Girişler)' : 'Total Credits (Deposits)',
    asOf: isAr ? 'كما في' : isTr ? 'Tarihi itibarıyla' : 'As of',
    outflowLines: isAr ? 'بنود التدفق الصادر' : isTr ? 'Çıkış Kalemleri' : 'Outflow Lines',
    inflowLines: isAr ? 'بنود التدفق الوارد' : isTr ? 'Giriş Kalemleri' : 'Inflow Lines',
    reconProgress: isAr ? 'نسبة إنجاز التسوية' : isTr ? 'Mutabakat İlerlemesi' : 'Reconciliation Progress',
    linesMatchedProgress: (matched: number, total: number) =>
      isAr ? `تمت مطابقة ${matched} من أصل ${total} بند` : isTr ? `${total} satırdan ${matched} tanesi eşleşti` : `${matched} of ${total} lines matched`,
      
    // Table
    statementLinesTitle: isAr ? 'بنود وسطور كشف الحساب' : isTr ? 'Ekstre Hareket Satırları' : 'Statement Transaction Lines',
    bookingDate: isAr ? 'تاريخ القيد' : isTr ? 'İşlem Tarihi' : 'Booking Date',
    valueDate: isAr ? 'تاريخ القيمة' : isTr ? 'Valör Tarihi' : 'Value Date',
    description: isAr ? 'البيان / الوصف' : isTr ? 'Açıklama' : 'Description',
    reference: isAr ? 'المرجع' : isTr ? 'Referans' : 'Reference',
    txnId: isAr ? 'معرف الحركة' : isTr ? 'İşlem No' : 'Txn ID',
    debit: isAr ? 'مدين / سحب (-)' : isTr ? 'Borç (-)' : 'Debit (-)',
    credit: isAr ? 'دائن / إيداع (+)' : isTr ? 'Alacak (+)' : 'Credit (+)',
    runningBalance: isAr ? 'الرصيد التراكمي' : isTr ? 'Yürüyen Bakiye' : 'Running Balance',
    reconciliationStatus: isAr ? 'حالة المطابقة' : isTr ? 'Mutabakat Durumu' : 'Reconciliation',
    matchedBadge: isAr ? 'مطابق' : isTr ? 'Eşleşti' : 'Matched',
    unmatchedBadge: isAr ? 'غير مطابق' : isTr ? 'Eşleşmedi' : 'Unmatched',
  }

  return (
    <div className="page-content" style={{ maxWidth: 1400, margin: '0 auto', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href={`/b/${businessId}/treasury`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {t.treasury}
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <Link href={`/b/${businessId}/treasury/statements`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {t.bankStatements}
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-brand-600)', fontWeight: 600 }}>{statement.statementNumber}</span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileSpreadsheet size={26} className="text-brand-600" /> {t.statementPrefix} {statement.statementNumber}
          </h1>
          <p className="page-subtitle">
            {statement.bankAccountName} ({statement.bankName} - {statement.accountNumber}) • {t.period} {new Date(statement.startDate).toLocaleDateString(locale)} {t.to} {new Date(statement.endDate).toLocaleDateString(locale)}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => printElement('bank-statement-detail-card', { title: `Bank Statement - ${statement.bankAccountName}` })}>
            <Printer size={16} /> {t.printStatement}
          </button>
          <Link href={`/b/${businessId}/treasury/reconciliation`} className="btn btn-primary">
            <CheckCheck size={16} /> {t.reconcileStatement}
          </Link>
        </div>
      </div>

      <div id="bank-statement-detail-card" className="report-paper-card">
        {/* Summary KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="stat-card" style={{ borderInlineStart: '4px solid #64748b' }}>
            <div className="stat-card-label">{t.openingBalance}</div>
            <div className="stat-card-value" style={{ fontSize: '1.5rem' }}>
              {formatCurrency(statement.openingBalance, statement.currency)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {t.asOf} {new Date(statement.startDate).toLocaleDateString(locale)}
            </div>
          </div>

          <div className="stat-card" style={{ borderInlineStart: '4px solid var(--color-danger)' }}>
            <div className="stat-card-label">{t.totalDebits}</div>
            <div className="stat-card-value" style={{ fontSize: '1.5rem', color: 'var(--color-danger)' }}>
              -{formatCurrency(statement.totalDebit, statement.currency)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {t.outflowLines}
            </div>
          </div>

          <div className="stat-card" style={{ borderInlineStart: '4px solid var(--color-success)' }}>
            <div className="stat-card-label">{t.totalCredits}</div>
            <div className="stat-card-value" style={{ fontSize: '1.5rem', color: 'var(--color-success)' }}>
              +{formatCurrency(statement.totalCredit, statement.currency)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {t.inflowLines}
            </div>
          </div>

          <div className="stat-card" style={{ borderInlineStart: '4px solid var(--color-brand-600)' }}>
            <div className="stat-card-label">{t.closingBalance}</div>
            <div className="stat-card-value" style={{ fontSize: '1.5rem', color: 'var(--color-brand-600)' }}>
              {formatCurrency(statement.closingBalance, statement.currency)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {t.asOf} {new Date(statement.endDate).toLocaleDateString(locale)}
            </div>
          </div>

          <div className="stat-card" style={{ borderInlineStart: '4px solid #8b5cf6' }}>
            <div className="stat-card-label">{t.reconProgress}</div>
            <div className="stat-card-value" style={{ fontSize: '1.5rem', color: '#8b5cf6' }}>
              {matchRate}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {t.linesMatchedProgress(matchedLinesCount, lines.length)}
            </div>
          </div>
        </div>

        {/* Transaction Lines Table */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{t.statementLinesTitle} ({lines.length})</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.bookingDate}</th>
                    <th>{t.valueDate}</th>
                    <th>{t.description}</th>
                    <th>{t.reference}</th>
                    <th>{t.txnId}</th>
                    <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.debit}</th>
                    <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.credit}</th>
                    <th style={{ textAlign: isAr ? 'left' : 'right' }}>{t.runningBalance}</th>
                    <th>{t.reconciliationStatus}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(l.date).toLocaleDateString(locale)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {l.valueDate ? new Date(l.valueDate).toLocaleDateString(locale) : '—'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{l.description}</div>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{l.reference || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                        {l.externalTxnId ? <code>{l.externalTxnId}</code> : '—'}
                      </td>
                      <td style={{ textAlign: isAr ? 'left' : 'right', color: 'var(--color-danger)', fontWeight: l.type === 'debit' ? 600 : 400 }}>
                        {l.type === 'debit' ? `-${formatCurrency(l.amount, statement.currency)}` : '—'}
                      </td>
                      <td style={{ textAlign: isAr ? 'left' : 'right', color: 'var(--color-success)', fontWeight: l.type === 'credit' ? 600 : 400 }}>
                        {l.type === 'credit' ? `+${formatCurrency(l.amount, statement.currency)}` : '—'}
                      </td>
                      <td style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 600 }}>
                        {formatCurrency(l.runningBalance, statement.currency)}
                      </td>
                      <td>
                        {l.isMatched ? (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <CheckCircle2 size={12} /> {t.matchedBadge}
                          </span>
                        ) : (
                          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={12} /> {t.unmatchedBadge}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
