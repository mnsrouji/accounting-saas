'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import { Search, ChevronDown, Check, X, Building2, Tag } from 'lucide-react'

export interface SearchableAccountItem {
  id: string
  code: string
  name: string
  type?: string
  normalBalance?: string
  isHeader?: boolean
  isActive?: boolean
  description?: string | null
}

interface AccountSearchSelectProps {
  accounts: SearchableAccountItem[]
  value: string
  onChange: (accountId: string, selectedAccount?: SearchableAccountItem) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  allowHeaders?: boolean
  style?: React.CSSProperties
  className?: string
  id?: string
}

const TYPE_TRANSLATIONS: Record<string, { label: string; color: string; bg: string }> = {
  asset: { label: 'أصول (Asset)', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)' },
  liability: { label: 'خصوم (Liability)', color: '#d97706', bg: 'rgba(217, 119, 6, 0.08)' },
  equity: { label: 'حقوق ملكية (Equity)', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)' },
  revenue: { label: 'إيرادات (Revenue)', color: '#059669', bg: 'rgba(5, 150, 105, 0.08)' },
  expense: { label: 'مصروفات (Expense)', color: '#dc2626', bg: 'rgba(220, 38, 38, 0.08)' },
}

export function AccountSearchSelect({
  accounts,
  value,
  onChange,
  placeholder = '-- ابحث بكود أو اسم الحساب --',
  disabled = false,
  required = false,
  allowHeaders = true,
  style,
  className = '',
  id,
}: AccountSearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Find currently selected account
  const selectedAccount = useMemo(() => {
    return accounts.find((a) => a.id === value)
  }, [accounts, value])

  // Filter accounts based on query
  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return accounts

    return accounts.filter((acc) => {
      const matchCode = acc.code.toLowerCase().includes(q)
      const matchName = acc.name.toLowerCase().includes(q)
      const matchType = acc.type?.toLowerCase().includes(q)
      const matchDesc = acc.description?.toLowerCase().includes(q)
      return matchCode || matchName || matchType || matchDesc
    })
  }, [accounts, searchQuery])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('')
      setHighlightedIndex(0)
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < filteredAccounts.length - 1 ? prev + 1 : prev))
      scrollIntoView(highlightedIndex + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0))
      scrollIntoView(highlightedIndex - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = filteredAccounts[highlightedIndex]
      if (target) {
        handleSelect(target)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  const scrollIntoView = (index: number) => {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll('[data-account-item]')
    const item = items[index] as HTMLElement
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }

  const handleSelect = (account: SearchableAccountItem) => {
    onChange(account.id, account)
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('', undefined)
    setSearchQuery('')
  }

  return (
    <div
      ref={containerRef}
      className={`account-search-select ${className}`}
      style={{ position: 'relative', width: '100%', minWidth: '180px', ...style }}
      onKeyDown={handleKeyDown}
      id={id}
    >
      {/* Hidden input for HTML form validation */}
      {required && (
        <input
          type="text"
          value={value}
          required={required}
          onChange={() => {}}
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            height: '100%',
            width: '100%',
            left: 0,
            top: 0,
          }}
          tabIndex={-1}
        />
      )}

      {/* Main Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.45rem 0.625rem',
          backgroundColor: disabled ? 'var(--bg-secondary)' : 'var(--bg-card)',
          border: `1px solid ${isOpen ? 'var(--primary-color)' : 'var(--border-color)'}`,
          borderRadius: 'var(--border-radius)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isOpen ? '0 0 0 2px rgba(59, 130, 246, 0.15)' : 'none',
          transition: 'all 0.15s ease',
          fontSize: '0.8125rem',
          minHeight: '36px',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden', flex: 1 }}>
          {selectedAccount ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  color: 'var(--primary-color)',
                  flexShrink: 0,
                }}
              >
                {selectedAccount.code}
              </span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedAccount.name}
              </span>
              {selectedAccount.isHeader && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    padding: '0.05rem 0.3rem',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(100, 116, 139, 0.12)',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                  }}
                >
                  رئيسي
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{placeholder}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0, marginInlineStart: '0.375rem' }}>
          {selectedAccount && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="مسح الاختيار"
            >
              <X size={13} />
            </button>
          )}
          <ChevronDown
            size={14}
            style={{
              color: 'var(--text-muted)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </div>
      </div>

      {/* Dropdown Popup */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            minWidth: '280px',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* Search Box */}
          <div
            style={{
              padding: '0.5rem',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '0.85rem',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setHighlightedIndex(0)
              }}
              placeholder="اكتب للبحث بالاسم أو الكود..."
              style={{
                width: '100%',
                padding: '0.4rem 0.5rem 0.4rem 2rem',
                fontSize: '0.8125rem',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius)',
                backgroundColor: '#ffffff',
                outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--primary-color)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '0.85rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Accounts List */}
          <div
            ref={listRef}
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '0.25rem 0',
            }}
          >
            {filteredAccounts.length === 0 ? (
              <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                لا توجد حسابات مطابقة للبحث &quot;{searchQuery}&quot;
              </div>
            ) : (
              filteredAccounts.map((acc, index) => {
                const isSelected = acc.id === value
                const isHighlighted = index === highlightedIndex
                const typeConfig = acc.type ? TYPE_TRANSLATIONS[acc.type] : null

                return (
                  <div
                    key={acc.id}
                    data-account-item
                    onClick={() => handleSelect(acc)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      backgroundColor: isHighlighted
                        ? 'rgba(59, 130, 246, 0.08)'
                        : isSelected
                        ? 'rgba(59, 130, 246, 0.04)'
                        : 'transparent',
                      borderRight: isSelected ? '3px solid var(--primary-color)' : '3px solid transparent',
                      transition: 'background-color 0.1s ease',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: '0.775rem',
                          color: 'var(--primary-color)',
                          backgroundColor: 'rgba(59, 130, 246, 0.08)',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          flexShrink: 0,
                        }}
                      >
                        {acc.code}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span
                          style={{
                            fontSize: '0.825rem',
                            fontWeight: acc.isHeader ? 700 : 500,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {acc.name}
                        </span>
                        {acc.description && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {acc.description}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                      {typeConfig && (
                        <span
                          style={{
                            fontSize: '0.675rem',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            color: typeConfig.color,
                            backgroundColor: typeConfig.bg,
                            fontWeight: 500,
                          }}
                        >
                          {typeConfig.label.split(' ')[0]}
                        </span>
                      )}
                      {acc.isHeader && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.05rem 0.25rem',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(100, 116, 139, 0.1)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          رئيسي
                        </span>
                      )}
                      {isSelected && <Check size={14} style={{ color: 'var(--primary-color)', marginInlineStart: '0.25rem' }} />}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer stats / helper */}
          <div
            style={{
              padding: '0.35rem 0.75rem',
              backgroundColor: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
            }}
          >
            <span>{filteredAccounts.length} حساب متاح</span>
            <span>استخدم ⬆ ⬇ و Enter للاختيار السريع</span>
          </div>
        </div>
      )}
    </div>
  )
}
