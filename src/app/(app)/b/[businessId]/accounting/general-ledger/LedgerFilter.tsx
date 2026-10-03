'use client'

import React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Filter } from 'lucide-react'
import { useLocale } from 'next-intl'
import { getLocalizedAccountName, getLocalizedAccountType } from '@/lib/i18n/account-i18n'

interface AccountOption {
  id: string
  code: string
  name: string
  type: string
}

interface LedgerFilterProps {
  accounts: AccountOption[]
  selectedAccountId: string
  fromDate?: string
  toDate?: string
}

export function LedgerFilter({
  accounts,
  selectedAccountId,
  fromDate = '',
  toDate = '',
}: LedgerFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const t = {
    selectAccount: isAr ? 'تحديد الحساب المالي' : isTr ? 'Hesap Seçin' : 'Select Account',
    fromDate: isAr ? 'من تاريخ' : isTr ? 'Başlangıç Tarihi' : 'From Date',
    toDate: isAr ? 'إلى تاريخ' : isTr ? 'Bitiş Tarihi' : 'To Date',
  }

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
      <form
        onSubmit={(e) => e.preventDefault()}
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: '1rem' }}
      >
        <div style={{ flex: 1, minWidth: 260 }}>
          <label className="form-label required" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Filter size={14} /> {t.selectAccount}
          </label>
          <select
            name="accountId"
            value={selectedAccountId}
            onChange={(e) => handleFilterChange('accountId', e.target.value)}
            className="form-control"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} - {getLocalizedAccountName(a.code, a.name, locale)} ({getLocalizedAccountType(a.type, locale)})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">{t.fromDate}</label>
          <input
            type="date"
            name="fromDate"
            defaultValue={fromDate}
            onChange={(e) => handleFilterChange('fromDate', e.target.value)}
            className="form-control"
          />
        </div>

        <div>
          <label className="form-label">{t.toDate}</label>
          <input
            type="date"
            name="toDate"
            defaultValue={toDate}
            onChange={(e) => handleFilterChange('toDate', e.target.value)}
            className="form-control"
          />
        </div>
      </form>
    </div>
  )
}

