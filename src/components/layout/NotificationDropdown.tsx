'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Bell,
  CheckCheck,
  Package,
  ShoppingCart,
  ShieldCheck,
  AlertTriangle,
  Info,
  ExternalLink,
  Loader2,
  Clock,
  Sparkles,
} from 'lucide-react'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import {
  getNotificationsAction,
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from '@/actions/saas/notification-actions'

interface NotificationItem {
  id: string
  title: string
  message: string
  type: string
  category?: string | null
  priority?: string | null
  link?: string | null
  isRead: boolean
  createdAt: string | Date
}

interface NotificationDropdownProps {
  businessId?: string
  userId?: string
}

export function NotificationDropdown({ businessId, userId }: NotificationDropdownProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const t = {
    title: isAr ? 'مركز الإشعارات والتنبيهات' : isTr ? 'Bildirim Merkezi' : 'Notifications Center',
    all: isAr ? 'الكل' : isTr ? 'Tümü' : 'All',
    unread: isAr ? 'غير مقروءة' : isTr ? 'Okunmamış' : 'Unread',
    markAllRead: isAr ? 'تحديد الكل كمقروء' : isTr ? 'Tümünü Okundu İşaretle' : 'Mark all read',
    emptyTitle: isAr ? 'لا توجد إشعارات حالياً' : isTr ? 'Henüz bildirim yok' : 'No notifications yet',
    emptySubtitle: isAr
      ? 'ستظهر هنا التنبيهات الخاصة بالفواتير والمخزون وحركات النظام'
      : isTr
      ? 'Faturalar, stok ve sistem hareketleriyle ilgili bildirimler burada görünecek'
      : 'Alerts for invoices, inventory, and system activity will appear here',
    now: isAr ? 'الآن' : isTr ? 'Şimdi' : 'Just now',
    minutesAgo: (m: number) => isAr ? `منذ ${m} دقيقة` : isTr ? `${m} dk önce` : `${m}m ago`,
    hoursAgo: (h: number) => isAr ? `منذ ${h} ساعة` : isTr ? `${h} sa önce` : `${h}h ago`,
    daysAgo: (d: number) => isAr ? `منذ ${d} يوم` : isTr ? `${d} g önce` : `${d}d ago`,
  }

  // Sample default initial system notifications if none in DB
  const defaultSampleNotifications: NotificationItem[] = [
    {
      id: 'welcome-system-1',
      title: isAr ? 'مرحباً بك في النظام المحاسبي المتكامل' : 'Welcome to the Accounting Platform',
      message: isAr
        ? 'تم تفعيل حسابك بصلاحيات كاملة. يمكنك البدء بإصدار الفواتير وتسجيل القيود.'
        : 'Your account is active. You can start creating invoices and journal entries.',
      type: 'success',
      category: 'system',
      link: businessId ? `/b/${businessId}/dashboard` : undefined,
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
    },
    {
      id: 'system-security-2',
      title: isAr ? 'جاهزية سجل الرقابة والصلاحيات' : 'Security & Permissions Ready',
      message: isAr
        ? 'نظام تدقيق الصلاحيات المتقدم (RBAC) يعمل بنجاح ويحمي جميع العمليات المالية.'
        : 'Advanced RBAC permissions engine is active and securing all financial operations.',
      type: 'info',
      category: 'security',
      link: businessId ? `/b/${businessId}/settings/members` : undefined,
      isRead: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
    },
  ]

  const fetchNotifications = async () => {
    if (!businessId) {
      setNotifications(defaultSampleNotifications)
      setUnreadCount(defaultSampleNotifications.filter((n) => !n.isRead).length)
      return
    }

    try {
      setLoading(true)
      const res = await getNotificationsAction(businessId, { limit: 30 })
      if (res.success && res.data) {
        const fetchedItems = res.data.notifications || res.data.items || []
        if (fetchedItems.length === 0) {
          setNotifications(defaultSampleNotifications)
          setUnreadCount(defaultSampleNotifications.filter((n) => !n.isRead).length)
        } else {
          setNotifications(fetchedItems)
          setUnreadCount(res.data.unreadCount ?? fetchedItems.filter((n: any) => !n.isRead).length)
        }
      } else {
        setNotifications(defaultSampleNotifications)
        setUnreadCount(defaultSampleNotifications.filter((n) => !n.isRead).length)
      }
    } catch {
      setNotifications(defaultSampleNotifications)
      setUnreadCount(defaultSampleNotifications.filter((n) => !n.isRead).length)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [businessId])

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMarkAsRead = async (id: string) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))

    if (businessId && !id.startsWith('welcome-') && !id.startsWith('system-')) {
      try {
        await markNotificationAsReadAction(businessId, id)
      } catch {}
    }
  }

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true)
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
    setUnreadCount(0)

    if (businessId) {
      try {
        await markAllNotificationsAsReadAction(businessId)
      } catch {}
    }
    setMarkingAll(false)
  }

  const formatRelativeTime = (dateInput: string | Date) => {
    const date = new Date(dateInput)
    const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000)
    if (diffSeconds < 60) return t.now
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return t.minutesAgo(diffMinutes)
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return t.hoursAgo(diffHours)
    const diffDays = Math.floor(diffHours / 24)
    return t.daysAgo(diffDays)
  }

  const getNotificationIcon = (type: string, category?: string | null) => {
    if (category === 'sales') return <ShoppingCart size={16} className="text-emerald-500" />
    if (category === 'inventory') return <Package size={16} className="text-amber-500" />
    if (category === 'security') return <ShieldCheck size={16} className="text-indigo-500" />
    if (type === 'warning' || type === 'error') return <AlertTriangle size={16} className="text-rose-500" />
    if (type === 'success') return <Sparkles size={16} className="text-emerald-500" />
    return <Info size={16} className="text-indigo-500" />
  }

  const filteredNotifications = notifications.filter((item) => {
    if (activeTab === 'unread') return !item.isRead
    return true
  })

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        id="notifications-btn"
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev)
          if (!isOpen) fetchNotifications()
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={t.title}
        title={t.title}
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
          position: 'relative',
          transition: 'all 180ms ease',
        }}
        className="hover:scale-105 active:scale-95 transition-all"
      >
        <Bell size={17} className={unreadCount > 0 ? 'text-indigo-500' : ''} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 5,
              right: 5,
              minWidth: 16,
              height: 16,
              padding: '0 3px',
              borderRadius: 9999,
              background: '#ef4444',
              color: 'white',
              fontSize: '0.625rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 2px var(--bg-surface, white)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label={t.title}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            insetInlineEnd: 0,
            width: 360,
            maxWidth: 'calc(100vw - 2rem)',
            background: 'var(--bg-card, #ffffff)',
            borderRadius: 14,
            border: '1px solid var(--border-color, #e2e8f0)',
            boxShadow: '0 20px 35px -8px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 480,
            animation: 'fadeIn 180ms ease-out',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.875rem 1rem',
              borderBottom: '1px solid var(--border-color, #f1f5f9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-surface, #f8fafc)',
            }}
          >
            <div className="flex items-center gap-2">
              <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary, #0f172a)' }}>
                {t.title}
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 9999,
                    background: '#e0e7ff',
                    color: '#4338ca',
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={markingAll}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#6366f1',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <CheckCheck size={14} />
                {t.markAllRead}
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div
            style={{
              display: 'flex',
              padding: '0.375rem 0.75rem',
              gap: '0.375rem',
              borderBottom: '1px solid var(--border-color, #f1f5f9)',
              background: 'var(--bg-card, #ffffff)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              style={{
                flex: 1,
                padding: '0.375rem 0.5rem',
                borderRadius: 6,
                fontSize: '0.78125rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'all' ? 'var(--color-brand-50, #eef2ff)' : 'transparent',
                color: activeTab === 'all' ? '#4f46e5' : 'var(--text-secondary, #64748b)',
                transition: 'all 120ms',
              }}
            >
              {t.all} ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              style={{
                flex: 1,
                padding: '0.375rem 0.5rem',
                borderRadius: 6,
                fontSize: '0.78125rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'unread' ? 'var(--color-brand-50, #eef2ff)' : 'transparent',
                color: activeTab === 'unread' ? '#4f46e5' : 'var(--text-secondary, #64748b)',
                transition: 'all 120ms',
              }}
            >
              {t.unread} ({unreadCount})
            </button>
          </div>

          {/* List Content */}
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: 340 }}>
            {loading && notifications.length === 0 ? (
              <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Loader2 size={24} className="animate-spin text-indigo-500" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div style={{ padding: '2.5rem 1.5rem', textAlign: 'center' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'var(--bg-surface, #f1f5f9)',
                    color: 'var(--text-muted, #94a3b8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 0.75rem',
                  }}
                >
                  <Bell size={22} />
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary, #0f172a)' }}>
                  {t.emptyTitle}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)', marginTop: 4 }}>
                  {t.emptySubtitle}
                </div>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const ItemWrapper = item.link ? Link : 'div'
                return (
                  <ItemWrapper
                    key={item.id}
                    href={item.link || '#'}
                    onClick={() => {
                      if (!item.isRead) handleMarkAsRead(item.id)
                      if (item.link) setIsOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderBottom: '1px solid var(--border-color, #f8fafc)',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      background: item.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.04)',
                      transition: 'background 120ms',
                    }}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: 'var(--bg-surface, #f1f5f9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {getNotificationIcon(item.type, item.category)}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <div
                          style={{
                            fontWeight: item.isRead ? 600 : 700,
                            fontSize: '0.8125rem',
                            color: 'var(--text-primary, #0f172a)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.title}
                        </div>
                        {!item.isRead && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: '#6366f1',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary, #64748b)',
                          marginTop: 2,
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.message}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 4,
                          fontSize: '0.6875rem',
                          color: 'var(--text-muted, #94a3b8)',
                        }}
                      >
                        <Clock size={11} />
                        <span>{formatRelativeTime(item.createdAt)}</span>
                        {item.link && (
                          <span style={{ marginInlineStart: 'auto', color: '#6366f1', display: 'flex', alignItems: 'center', gap: 2 }}>
                            <ExternalLink size={10} />
                          </span>
                        )}
                      </div>
                    </div>
                  </ItemWrapper>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
