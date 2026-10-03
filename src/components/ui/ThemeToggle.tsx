'use client'

import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useLocale } from 'next-intl'

export function ThemeToggle() {
  const locale = useLocale()
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const applyTheme = (t: 'light' | 'dark') => {
    document.documentElement.setAttribute('data-theme', t)
    if (t === 'dark') {
      document.documentElement.classList.add('dark')
      document.body.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('dark')
    }
  }

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (saved === 'dark' || saved === 'light') {
      setTheme(saved)
      applyTheme(saved)
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark')
      applyTheme('dark')
    } else {
      setTheme('light')
      applyTheme('light')
    }
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    applyTheme(nextTheme)
  }

  const tooltipText =
    theme === 'light'
      ? isAr
        ? 'التبديل إلى الوضع الليلي الداكن'
        : isTr
        ? 'Karanlık moda geç'
        : 'Switch to Dark Mode'
      : isAr
      ? 'التبديل إلى الوضع النهاري الفاتح'
      : isTr
      ? 'Aydınlık moda geç'
      : 'Switch to Light Mode'

  if (!mounted) {
    return (
      <button
        id="theme-toggle-btn"
        type="button"
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          border: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-surface, var(--bg-card, white))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'var(--text-secondary, #64748b)',
        }}
        aria-label="Toggle theme"
      >
        <Moon size={16} />
      </button>
    )
  }

  return (
    <button
      id="theme-toggle-btn"
      type="button"
      onClick={toggleTheme}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        border: '1px solid var(--border-color, #e2e8f0)',
        background: 'var(--bg-surface, var(--bg-card, white))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: theme === 'dark' ? '#fbbf24' : 'var(--text-secondary, #64748b)',
        transition: 'all 200ms ease',
      }}
      className="hover:scale-105 active:scale-95 transition-all"
      aria-label={tooltipText}
      title={tooltipText}
    >
      {theme === 'light' ? (
        <Moon size={16} className="transition-transform duration-200" />
      ) : (
        <Sun size={16} className="text-amber-400 transition-transform duration-200" />
      )}
    </button>
  )
}
