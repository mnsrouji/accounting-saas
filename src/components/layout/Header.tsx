'use client'

import { useState } from 'react'
import type { BusinessUser, Business } from '@prisma/client'
import { Bell, ChevronDown, LogOut, User, Settings, Search } from 'lucide-react'
import { logoutAction } from '@/actions/auth/auth-actions'
import type { User as SupabaseUser } from '@supabase/supabase-js'

import { useLocale } from 'next-intl'
import { Breadcrumbs } from '@/components/ui/Breadcrumbs'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { ToastProvider } from '@/components/ui/ToastProvider'
import { GlobalSearchModal } from '@/components/layout/GlobalSearchModal'

type MembershipWithBusiness = BusinessUser & { business: Business }

interface HeaderProps {
  user: SupabaseUser
  memberships: MembershipWithBusiness[]
}

export function Header({ user, memberships }: HeaderProps) {
  const locale = useLocale()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const userName =
    (user.user_metadata?.full_name as string) ??
    user.email?.split('@')[0] ??
    'User'

  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const [searchModalOpen, setSearchModalOpen] = useState(false)

  const t = {
    searchBtn: locale === 'ar' ? 'بحث...' : locale === 'tr' ? 'Ara...' : 'Search...',
    searchTooltip: locale === 'ar' ? 'بحث شامل (Ctrl+K)' : locale === 'tr' ? 'Genel Arama (Ctrl+K)' : 'Global Search (Ctrl+K)',
    notifications: locale === 'ar' ? 'الإشعارات' : locale === 'tr' ? 'Bildirimler' : 'Notifications',
    profile: locale === 'ar' ? 'الملف الشخصي' : locale === 'tr' ? 'Profilim' : 'My Profile',
    settings: locale === 'ar' ? 'إعدادات الحساب' : locale === 'tr' ? 'Hesap Ayarları' : 'Account Settings',
    logout: locale === 'ar' ? 'تسجيل الخروج' : locale === 'tr' ? 'Çıkış Yap' : 'Sign Out',
  }

  return (
    <header className="app-header">
      <ToastProvider />
      <GlobalSearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />

      {/* Left: breadcrumb / page context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Breadcrumbs />
      </div>

      {/* Right: actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        {/* Global Search Button */}
        <button
          id="global-search-btn"
          onClick={() => setSearchModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.375rem 0.75rem',
            borderRadius: 8,
            border: '1px solid var(--border-color, #e2e8f0)',
            background: 'var(--bg-surface, white)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            color: 'var(--text-secondary, #64748b)',
          }}
          title={t.searchTooltip}
        >
          <Search size={15} />
          <span style={{ fontWeight: 400 }}>{t.searchBtn}</span>
          <kbd style={{
            fontSize: '0.7rem',
            padding: '2px 5px',
            background: '#f1f5f9',
            borderRadius: 4,
            border: '1px solid #cbd5e1',
            color: '#64748b',
          }}>⌘K</kbd>
        </button>

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <button
          id="notifications-btn"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: '1px solid var(--border-color, #e2e8f0)',
            background: 'var(--bg-surface, white)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary, #64748b)',
            position: 'relative',
          }}
          aria-label={t.notifications}
          title={t.notifications}
        >
          <Bell size={16} />
          <span style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#6366f1',
          }} />
        </button>

        {/* User Menu */}
        <div style={{ position: 'relative' }}>
          <button
            id="user-menu-btn"
            onClick={() => setUserMenuOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.375rem 0.625rem',
              borderRadius: 8,
              border: '1px solid var(--border-color, #e2e8f0)',
              background: 'var(--bg-surface, white)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: 'var(--text-primary, #0f172a)',
              transition: 'all 150ms',
            }}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'white',
            }}>
              {initials}
            </div>
            <span style={{ fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userName}
            </span>
            <ChevronDown size={14} style={{ color: '#94a3b8', transform: userMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
          </button>

          {/* Dropdown */}
          {userMenuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                insetInlineEnd: 0,
                width: 220,
                background: 'var(--bg-surface, white)',
                borderRadius: 10,
                border: '1px solid var(--border-color, #e2e8f0)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                zIndex: 100,
                overflow: 'hidden',
              }}
            >
              {/* User info */}
              <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>{userName}</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 2 }}>{user.email}</div>
              </div>

              {/* Menu items */}
              <div style={{ padding: '0.375rem' }}>
                <MenuButton icon={<User size={14} />} label={t.profile} href="/profile" onClick={() => setUserMenuOpen(false)} />
                <MenuButton icon={<Settings size={14} />} label={t.settings} href="/account" onClick={() => setUserMenuOpen(false)} />
              </div>

              <div style={{ padding: '0.375rem', borderTop: '1px solid #f1f5f9' }}>
                <form action={logoutAction}>
                  <button
                    id="logout-btn"
                    type="submit"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: '#ef4444',
                      fontFamily: 'inherit',
                      fontWeight: 500,
                    }}
                  >
                    <LogOut size={14} />
                    {t.logout}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function MenuButton({
  icon,
  label,
  href,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  href: string
  onClick: () => void
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        padding: '0.5rem 0.75rem',
        borderRadius: 6,
        textDecoration: 'none',
        fontSize: '0.875rem',
        color: '#374151',
        fontWeight: 500,
        transition: 'background 150ms',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ color: '#94a3b8' }}>{icon}</span>
      {label}
    </a>
  )
}
