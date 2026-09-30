'use client'

import React from 'react'
import { Printer } from 'lucide-react'
import { useLocale } from 'next-intl'
import { printElement } from '@/utils/print-report'

interface PrintButtonProps {
  id?: string
  targetId?: string
  title?: string
  className?: string
}

export function PrintButton({
  id,
  targetId,
  title,
  className = 'btn btn-secondary btn-sm',
}: PrintButtonProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const handleClick = () => {
    if (targetId) {
      printElement(targetId, { title, isAr })
    } else {
      // Auto-detect common report containers
      const detected =
        document.getElementById('printable-content') ||
        document.getElementById('printable-balance-sheet') ||
        document.getElementById('printable-pl-report') ||
        document.getElementById('printable-cf-report') ||
        document.getElementById('printable-document') ||
        document.querySelector('.report-paper-card') ||
        document.querySelector('.document-paper')

      if (detected) {
        printElement(detected as HTMLElement, { title, isAr })
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
      <Printer size={14} />
      <span>{isAr ? 'طباعة / تصدير PDF' : isTr ? 'Yazdır / PDF' : 'Print / Export PDF'}</span>
    </button>
  )
}
