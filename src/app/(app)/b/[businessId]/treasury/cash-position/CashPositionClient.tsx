'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  Layers,
  Coins,
  Landmark,
  WalletCards,
  Lock,
  Unlock,
  Eye,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { useLocale } from 'next-intl'
import { formatCurrency } from '@/utils/decimal'
import { DataTable, Column } from '@/components/ui/DataTable'

interface AccountPosition {
  id: string
  name: string
  type: 'cash' | 'bank'
  currency: string
  balance: number
  availableBalance: number
  restrictedAmount: number
  glAccountCode: string
  glAccountName: string
  bankName?: string
  accountNumber?: string
  isPettyCash?: boolean
}

interface CurrencyPosition {
  currency: string
  totalCash: number
  totalBank: number
  pettyCash: number
  restrictedFunds: number
  availableLiquidity: number
  totalLiquidFunds: number
  accounts: AccountPosition[]
}

interface CashPositionClientProps {
  businessId: string
  defaultCurrency: string
  data: {
    positions: CurrencyPosition[]
    asOfDate: string
  }
}

export function CashPositionClient({
  businessId,
  defaultCurrency,
  data,
}: CashPositionClientProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const { positions = [], asOfDate } = data || {}
  const [selectedCurrency, setSelectedCurrency] = useState<string>(
    positions[0]?.currency || defaultCurrency
  )

  const activePosition = positions.find((p) => p.currency === selectedCurrency) || positions[0]

  const t = {
    treasuryBreadcrumb: isAr ? 'الخزينة والسيولة' : isTr ? 'Hazine ve Kasa' : 'Treasury',
    cashPositionBreadcrumb: isAr ? 'الموقف المالي والسيولة' : isTr ? 'Nakit Pozisyonu' : 'Cash Position',
    title: isAr ? 'الموقف المالي والسيولة النقدية الحية' : isTr ? 'Anlık Nakit ve Likidite Pozisyonu' : 'Real-Time Cash & Liquidity Position',
    subtitle: isAr
      ? 'الأرصدة النقدية المجمعة، الودائع البنكية، والاحتياطيات المتاحة مفصلة بحسب العملة'
      : isTr
      ? 'Para birimi bazında konsolide likit fonlar, banka mevduatları ve kullanılabilir rezervler'
      : 'Consolidated liquid funds, bank deposits, and available reserves isolated by currency',
    totalLiquidFunds: isAr ? 'إجمالي الأموال والسيولة' : isTr ? 'Toplam Likit Fonlar' : 'Total Liquid Funds',
    totalLiquidSubtitle: (curr: string) => isAr ? `كافة الأرصدة النقدية والبنكية بعملة ${curr}` : isTr ? `${curr} cinsinden tüm kasa ve banka bakiyeleri` : `All Cash + Bank Balances in ${curr}`,
    bankBalances: isAr ? 'أرصدة البنوك والمصارف' : isTr ? 'Banka Bakiyeleri' : 'Bank Balances',
    bankSubtitle: isAr ? 'الحسابات الجارية وحسابات الودائع' : isTr ? 'Vadesiz ve Mevduat Hesapları' : 'Operating & Deposit Accounts',
    cashOnHand: isAr ? 'النقد في الصناديق والخزائن' : isTr ? 'Kasadaki Nakit' : 'Cash on Hand',
    pettyCashPrefix: isAr ? 'العهد النقدية:' : isTr ? 'Küçük Kasa / Avans:' : 'Petty Cash:',
    availableLiquidity: isAr ? 'السيولة الحرة المتاحة' : isTr ? 'Kullanılabilir Likidite' : 'Available Liquidity',
    restrictedPrefix: isAr ? 'المجمد / المحجوز:' : isTr ? 'Bloke / Kısıtlı:' : 'Restricted:',
    tableTitle: (curr: string) => isAr ? `تفصيل الحسابات والأرصدة (${curr})` : isTr ? `Hesap Bazında Pozisyon Dağılımı (${curr})` : `Account-Level Position Breakdown (${curr})`,
    colAccountName: isAr ? 'اسم الحساب والجهة' : isTr ? 'Hesap ve Banka Adı' : 'Account Name',
    colType: isAr ? 'النوع' : isTr ? 'Tür' : 'Type',
    colGlAccount: isAr ? 'حساب شجرة الحسابات (GL)' : isTr ? 'Muhasebe Hesabı (GL)' : 'General Ledger Account',
    colBalance: isAr ? 'الرصيد الدفتري الإجمالي' : isTr ? 'Toplam Kayıtlı Bakiye' : 'Total Book Balance',
    colAvailable: isAr ? 'السيولة المتاحة' : isTr ? 'Kullanılabilir Bakiye' : 'Available Liquidity',
    colAction: isAr ? 'الإجراء' : isTr ? 'İşlem' : 'Action',
    view: isAr ? 'عرض' : isTr ? 'Görüntüle' : 'View',
    typeBank: isAr ? 'حساب مصرفي' : isTr ? 'Banka Hesabı' : 'Commercial Bank',
    typePetty: isAr ? 'عهدة نقدية' : isTr ? 'Küçük Kasa' : 'Petty Cash',
    typeGeneral: isAr ? 'خزينة نقدية' : isTr ? 'Genel Kasa' : 'General Cash',
    subPettyFloat: isAr ? 'رصيد عهدة نقدية' : isTr ? 'Avans Fonu' : 'Petty Cash Float',
    subVault: isAr ? 'صندوق خزينة' : isTr ? 'Kasa' : 'Cash Vault',
    searchPlaceholder: isAr ? 'بحث باسم الحساب أو رمز شجرة الحسابات...' : isTr ? 'Hesap adı veya koduna göre ara...' : 'Search accounts by name or GL code...',
    emptyTitle: isAr ? 'لا توجد حسابات بهذه العملة' : isTr ? 'Bu para biriminde hesap bulunamadı' : 'No accounts in this currency',
    emptySubtext: isAr ? 'أضف حساباً نقدياً أو بنكياً بهذه العملة لعرض تفاصيل الموقف المالي.' : isTr ? 'Pozisyon dökümünü görmek için bu para biriminde kasa veya banka hesabı ekleyin.' : 'Create a cash or bank account in this currency to see position breakdown.',
    noPositions: isAr ? 'لا توجد أي أرصدة نقدية أو بنكية مسجلة في النظام.' : isTr ? 'Sistemde kayıtlı kasa veya banka pozisyonu bulunamadı.' : 'No cash or bank positions found in the system.',
  }

  const columns: Column<AccountPosition>[] = [
    {
      key: 'name',
      header: t.colAccountName,
      sortable: true,
      sortValue: (r) => r.name,
      accessor: (r) => (
        <div>
          <Link
            href={`/b/${businessId}/treasury/${r.type === 'cash' ? 'cash' : 'banks'}/${r.id}`}
            style={{ fontWeight: 600, color: 'var(--color-brand-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            {r.type === 'cash' ? <Coins size={14} /> : <Landmark size={14} />}
            {r.name}
          </Link>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {r.bankName ? `${r.bankName} • ${r.accountNumber}` : r.isPettyCash ? t.subPettyFloat : t.subVault}
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: t.colType,
      sortable: true,
      sortValue: (r) => (r.type === 'cash' ? (r.isPettyCash ? 'Petty Cash' : 'Cash') : 'Bank'),
      accessor: (r) => (
        <span className={`badge ${r.type === 'bank' ? 'badge-info' : r.isPettyCash ? 'badge-warning' : 'badge-neutral'}`} style={{ textTransform: 'capitalize' }}>
          {r.type === 'bank' ? t.typeBank : r.isPettyCash ? t.typePetty : t.typeGeneral}
        </span>
      ),
    },
    {
      key: 'glAccount',
      header: t.colGlAccount,
      accessor: (r) => (
        <div>
          <span className="badge badge-neutral">{r.glAccountCode}</span>
          <span style={{ fontSize: '0.75rem', marginInlineStart: '0.375rem', color: 'var(--text-secondary)' }}>{r.glAccountName}</span>
        </div>
      ),
    },
    {
      key: 'balance',
      header: t.colBalance,
      sortable: true,
      sortValue: (r) => r.balance,
      accessor: (r) => (
        <div style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 700, direction: 'ltr' }}>
          {formatCurrency(r.balance, r.currency)}
        </div>
      ),
    },
    {
      key: 'available',
      header: t.colAvailable,
      sortable: true,
      sortValue: (r) => r.availableBalance,
      accessor: (r) => (
        <div style={{ textAlign: isAr ? 'left' : 'right', fontWeight: 700, color: 'var(--color-brand-600)', direction: 'ltr' }}>
          {formatCurrency(r.availableBalance, r.currency)}
        </div>
      ),
    },
    {
      key: 'actions',
      header: t.colAction,
      accessor: (r) => (
        <Link
          href={`/b/${businessId}/treasury/${r.type === 'cash' ? 'cash' : 'banks'}/${r.id}`}
          className="btn btn-ghost btn-sm"
        >
          <Eye size={14} /> {t.view}
        </Link>
      ),
    },
  ]

  return (
    <div className="page-content" style={{ maxWidth: 1400, margin: '0 auto', direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Link href={`/b/${businessId}/treasury`} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
              {t.treasuryBreadcrumb}
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--color-brand-600)', fontWeight: 600 }}>{t.cashPositionBreadcrumb}</span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={26} className="text-brand-600" /> {t.title}
          </h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>

        {/* Currency Switcher Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-card)', padding: '0.375rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          {positions.map((p) => (
            <button
              key={p.currency}
              onClick={() => setSelectedCurrency(p.currency)}
              className={`btn btn-sm ${selectedCurrency === p.currency ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontWeight: 600 }}
            >
              {p.currency} ({formatCurrency(p.totalLiquidFunds, p.currency)})
            </button>
          ))}
        </div>
      </div>

      {activePosition ? (
        <>
          {/* Main KPI Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            
            {/* Total Liquid Funds */}
            <div className="stat-card" style={{ borderInlineStart: '4px solid var(--color-brand-600)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-card-label">{t.totalLiquidFunds}</div>
                  <div className="stat-card-value" style={{ color: 'var(--color-brand-600)', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                    {formatCurrency(activePosition.totalLiquidFunds, activePosition.currency)}
                  </div>
                </div>
                <div className="stat-card-icon" style={{ background: 'var(--color-brand-50)', color: 'var(--color-brand-600)' }}>
                  <Layers size={22} />
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {t.totalLiquidSubtitle(activePosition.currency)}
              </div>
            </div>

            {/* Commercial Banks */}
            <div className="stat-card" style={{ borderInlineStart: '4px solid #0284c7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-card-label">{t.bankBalances}</div>
                  <div className="stat-card-value" style={{ color: '#0284c7', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                    {formatCurrency(activePosition.totalBank, activePosition.currency)}
                  </div>
                </div>
                <div className="stat-card-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                  <Landmark size={22} />
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {t.bankSubtitle}
              </div>
            </div>

            {/* Cash on Hand */}
            <div className="stat-card" style={{ borderInlineStart: '4px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-card-label">{t.cashOnHand}</div>
                  <div className="stat-card-value" style={{ color: '#10b981', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                    {formatCurrency(activePosition.totalCash, activePosition.currency)}
                  </div>
                </div>
                <div className="stat-card-icon" style={{ background: '#d1fae5', color: '#10b981' }}>
                  <Coins size={22} />
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {t.pettyCashPrefix} <span style={{ direction: 'ltr', display: 'inline-block' }}>{formatCurrency(activePosition.pettyCash, activePosition.currency)}</span>
              </div>
            </div>

            {/* Available Liquidity */}
            <div className="stat-card" style={{ borderInlineStart: '4px solid #8b5cf6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-card-label">{t.availableLiquidity}</div>
                  <div className="stat-card-value" style={{ color: '#8b5cf6', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                    {formatCurrency(activePosition.availableLiquidity, activePosition.currency)}
                  </div>
                </div>
                <div className="stat-card-icon" style={{ background: '#ede9fe', color: '#8b5cf6' }}>
                  <Unlock size={22} />
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {t.restrictedPrefix} <span style={{ direction: 'ltr', display: 'inline-block' }}>{formatCurrency(activePosition.restrictedFunds, activePosition.currency)}</span>
              </div>
            </div>
          </div>

          {/* Account Breakdown Table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t.tableTitle(activePosition.currency)}</span>
            </div>
            <div className="card-body">
              <DataTable
                data={activePosition.accounts}
                columns={columns}
                searchKey={(r) => `${r.name} ${r.glAccountCode} ${r.type}`}
                searchPlaceholder={t.searchPlaceholder}
                emptyTitle={t.emptyTitle}
                emptySubtext={t.emptySubtext}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          {t.noPositions}
        </div>
      )}
    </div>
  )
}
