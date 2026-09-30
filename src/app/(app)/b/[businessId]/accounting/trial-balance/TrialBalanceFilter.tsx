'use client'

import React from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { useLocale } from 'next-intl'

interface TrialBalanceFilterProps {
  asOfDate?: string
}

export function TrialBalanceFilter({ asOfDate = '' }: TrialBalanceFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const tAsOf = isAr ? 'حتى تاريخ:' : isTr ? 'Tarih İtibarıyla:' : 'As Of Date:'

  const handleDateChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (val) {
      params.set('asOfDate', val)
    } else {
      params.delete('asOfDate')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
      <form
        onSubmit={(e) => e.preventDefault()}
        style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}
      >
        <label className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Calendar size={15} /> {tAsOf}
        </label>
        <input
          type="date"
          name="asOfDate"
          defaultValue={asOfDate}
          onChange={(e) => handleDateChange(e.target.value)}
          className="form-control"
          style={{ width: 180 }}
        />
      </form>
    </div>
  )
}

