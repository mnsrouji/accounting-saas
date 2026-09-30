'use client'

import { useLocale } from 'next-intl'

interface RangeSelectProps {
  defaultValue: string
}

export function RangeSelect({ defaultValue }: RangeSelectProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  return (
    <form method="GET" style={{ display: 'inline' }}>
      <select
        name="range"
        defaultValue={defaultValue}
        onChange={(e) => e.target.form?.submit()}
        style={{
          border: 'none',
          background: 'transparent',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <option value="all">{isAr ? 'كل الفترات' : isTr ? 'Tüm Zamanlar' : 'All Time'}</option>
        <option value="month">{isAr ? 'هذا الشهر' : isTr ? 'Bu Ay' : 'This Month'}</option>
        <option value="30d">{isAr ? 'آخر 30 يوماً' : isTr ? 'Son 30 Gün' : 'Last 30 Days'}</option>
        <option value="quarter">{isAr ? 'هذا الربع' : isTr ? 'Bu Çeyrek' : 'This Quarter'}</option>
        <option value="ytd">{isAr ? 'من بداية السنة' : isTr ? 'Yılbaşından Bugüne' : 'Year to Date'}</option>
      </select>
    </form>
  )
}
