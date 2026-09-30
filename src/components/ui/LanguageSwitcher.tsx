'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, ChevronDown, Check } from 'lucide-react'
import { locales, localeConfig, type Locale } from '@/i18n/locales'
import { setLocaleAction } from '@/actions/locale-actions'

export function LanguageSwitcher() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [currentLocale, setCurrentLocale] = useState<Locale>('ar')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Detect current locale from document or cookie
  useEffect(() => {
    const docLang = document.documentElement.lang as Locale
    if (locales.includes(docLang)) {
      setCurrentLocale(docLang)
    } else {
      const match = document.cookie.match(/(^|;)\s*locale=([^;]+)/)
      if (match && locales.includes(match[2] as Locale)) {
        setCurrentLocale(match[2] as Locale)
      }
    }
  }, [])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectLocale = async (loc: Locale) => {
    if (loc === currentLocale || isPending) return
    setIsPending(true)
    setCurrentLocale(loc)
    setIsOpen(false)

    try {
      await setLocaleAction(loc)
      // Hard refresh to reload layout with new direction (dir) and messages
      window.location.reload()
    } catch {
      setIsPending(false)
    }
  }

  const currentConfig = localeConfig[currentLocale] || localeConfig.ar

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        id="language-switcher-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.375rem 0.65rem',
          borderRadius: 8,
          border: '1px solid var(--border-color, #e2e8f0)',
          background: 'var(--bg-surface, #ffffff)',
          cursor: isPending ? 'wait' : 'pointer',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--text-primary, #0f172a)',
          transition: 'all 150ms ease',
          opacity: isPending ? 0.7 : 1,
        }}
        title="تغيير اللغة / Change Language / Dili Değiştir"
        aria-label="Language Selector"
        aria-expanded={isOpen}
      >
        <span style={{ fontSize: '1rem', lineHeight: 1 }}>{currentConfig.flag}</span>
        <span style={{ display: 'none', minWidth: '45px', textAlign: 'start' }} className="lang-label-desktop">
          {currentConfig.label}
        </span>
        <ChevronDown
          size={13}
          style={{
            color: 'var(--text-muted, #94a3b8)',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 150ms ease',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            insetInlineEnd: 0,
            width: 175,
            background: 'var(--bg-surface, #ffffff)',
            borderRadius: 10,
            border: '1px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            overflow: 'hidden',
            padding: '0.35rem',
            animation: 'fadeInScale 0.15s ease-out forwards',
          }}
        >
          <div
            style={{
              padding: '0.375rem 0.5rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted, #64748b)',
              borderBottom: '1px solid var(--border-color, #f1f5f9)',
              marginBottom: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Globe size={12} />
            <span>اللغة / Language</span>
          </div>

          {locales.map((loc) => {
            const config = localeConfig[loc]
            const isSelected = currentLocale === loc

            return (
              <button
                key={loc}
                type="button"
                onClick={() => handleSelectLocale(loc)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '0.5rem 0.625rem',
                  borderRadius: 6,
                  border: 'none',
                  background: isSelected ? 'var(--color-brand-50, rgba(99, 102, 241, 0.08))' : 'transparent',
                  color: isSelected ? 'var(--color-brand-600, #4f46e5)' : 'var(--text-primary, #1e293b)',
                  fontWeight: isSelected ? 700 : 500,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  textAlign: 'start',
                  transition: 'background 120ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover, #f8fafc)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{config.flag}</span>
                  <span>{config.label}</span>
                </div>
                {isSelected && <Check size={14} style={{ color: 'var(--color-brand-600, #4f46e5)' }} />}
              </button>
            )
          })}
        </div>
      )}

      <style jsx>{`
        @media (min-width: 640px) {
          .lang-label-desktop {
            display: inline-block !important;
          }
        }
      `}</style>
    </div>
  )
}
