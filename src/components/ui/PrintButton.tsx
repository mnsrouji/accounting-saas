'use client'

import React from 'react'
import { Printer } from 'lucide-react'
import { useLocale } from 'next-intl'
import { printElement } from '@/utils/print-report'

interface PrintButtonProps {
  id?: string
  targetId?: string
  label?: string
  className?: string
  iconSize?: number
}

export function PrintButton({
  id,
  targetId,
  label,
  className = 'btn btn-secondary btn-sm',
  iconSize = 14,
}: PrintButtonProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'

  const handleClick = () => {
    if (targetId) {
      printElement(targetId, { isAr })
    } else {
      const detected =
        document.getElementById('printable-content') ||
        document.getElementById('printable-balance-sheet') ||
        document.getElementById('printable-pl-report') ||
        document.getElementById('printable-cf-report') ||
        document.getElementById('printable-document') ||
        document.querySelector('.report-paper-card') ||
        document.querySelector('.document-paper')

      if (detected) {
        printElement(detected as HTMLElement, { isAr })
      } else {
        window.print()
      }
    }
  }

  return (
    <button
      type="button"
      id={id}
      onClick={handleClick}
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
    >
      <Printer size={iconSize} />
      <span>{label || (isAr ? 'طباعة / تصدير PDF' : 'Print / Export PDF')}</span>
    </button>
  )
}
