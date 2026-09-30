// =============================================================
// Tenant Security Center — Session & Security Controls
// Phase 17: Commercial SaaS Experience, Onboarding & Enterprise Operations
// =============================================================

import type { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { SettingsNav } from '@/components/settings/settings-nav'
import { getLocale } from 'next-intl/server'
import { Shield, Users, Lock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Security Center | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function SecurityCenterPage({ params }: PageProps) {
  const { businessId } = await params
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'
  await requireBusinessAccess(businessId)

  // Fetch active team members, recent security audits, and pending invitations
  const [members, auditLogs] = await Promise.all([
    prisma.businessUser.findMany({
      where: { businessId, status: 'active' },
      include: {
        user: { select: { id: true, fullName: true, email: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.auditLog.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ])

  const t = {
    title: isAr ? 'مركز أمان مساحة العمل' : isTr ? 'Kiracı Güvenlik Merkezi' : 'Tenant Security Center',
    subtitle: isAr
      ? 'سلامة المصادقة المؤسسية، إدارة وصول الأعضاء النشطين، وسجل التدقيق الأمني غير القابل للتعديل'
      : isTr
      ? 'Kurumsal kimlik doğrulama bütünlüğü, aktif üye erişimi ve değişmez güvenlik denetim izleri'
      : 'Enterprise authentication integrity, active member access, and immutable security audit trails',
    isolation: {
      title: isAr ? 'عزل مساحات العمل' : isTr ? 'Kiracı İzolasyonu' : 'Tenant Isolation',
      status: isAr ? 'نظام RLS مفعّل' : isTr ? 'RLS Aktif' : 'RLS Active',
      desc: isAr
        ? 'أمان مستوى الصف في PostgreSQL يعزل بيانات كل شركة ومساحة عمل بشكل مستقل وآمن تماماً.'
        : isTr
        ? 'PostgreSQL Satır Düzeyinde Güvenlik (RLS), kiracı çalışma alanı başına veritabanı satırlarını güvenle ayırır.'
        : 'PostgreSQL Row-Level Security actively segregates database rows per tenant workspace.',
    },
    members: {
      title: isAr ? 'الأعضاء النشطون' : isTr ? 'Aktif Üyeler' : 'Active Members',
      count: (n: number) => (isAr ? `${n} مستخدمين` : isTr ? `${n} Kullanıcı` : `${n} Users`),
      desc: isAr
        ? 'التحكم الدقيق بالوصول المبني على الأدوار (RBAC) مطبق ومفروض على كل إجراء وواجهة برمجية.'
        : isTr
        ? 'Her API ve kullanıcı arayüzü işleminde zorunlu kılınan ayrıntılı Rol Tabanlı Erişim Kontrolü (RBAC).'
        : 'Granular Role-Based Access Control (RBAC) enforced on every API and UI action.',
    },
    auth: {
      title: isAr ? 'هيكلية المصادقة' : isTr ? 'Kimlik Doğrulama Mimarisi' : 'Auth Architecture',
      status: 'NextAuth JWT',
      desc: isAr
        ? 'رموز جلسات موقعة رقمياً ومشفرة مع ملفات تعريف ارتباط آمنة للحماية من الاختراق (HTTP-only cookies).'
        : isTr
        ? 'Güvenli HTTP-only çerezleriyle kriptografik olarak imzalanmış oturum belirteçleri.'
        : 'Cryptographically signed session tokens with secure HTTP-only cookies.',
    },
    audit: {
      title: isAr ? 'سجل تدقيق الأمان والعمليات الأخير' : isTr ? 'Son Güvenlik ve Veri Denetim Olayları' : 'Recent Security & Data Audit Events',
      empty: isAr ? 'لا توجد أحداث تدقيق مسجلة حتى الآن.' : isTr ? 'Henüz kaydedilmiş güvenlik denetim kaydı bulunmuyor.' : 'No security events recorded yet.',
      time: isAr ? 'الوقت والتاريخ' : isTr ? 'Zaman Damgası' : 'Timestamp',
      actor: isAr ? 'المستخدم' : isTr ? 'Kullanıcı' : 'Actor',
      action: isAr ? 'الإجراء' : isTr ? 'İşlem' : 'Action',
      module: isAr ? 'الوحدة' : isTr ? 'Modül' : 'Module',
      recordId: isAr ? 'معرف السجل' : isTr ? 'Kayıt Kimliği' : 'Record ID',
      system: isAr ? 'النظام الآلي' : isTr ? 'Sistem' : 'System',
    },
  }

  const formatAction = (action: string) => {
    const act = action.toLowerCase()
    if (isAr) {
      if (act === 'create') return 'إنشاء'
      if (act === 'update') return 'تعديل'
      if (act === 'delete') return 'حذف'
      if (act === 'void') return 'إبطال'
      if (act === 'post') return 'ترحيل'
      if (act === 'export') return 'تصدير'
      if (act === 'import') return 'استيراد'
      return action
    }
    if (isTr) {
      if (act === 'create') return 'OLUŞTUR'
      if (act === 'update') return 'GÜNCELLE'
      if (act === 'delete') return 'SİL'
      if (act === 'void') return 'İPTAL ET'
      if (act === 'post') return 'KAYDET'
      return action
    }
    return action.toUpperCase()
  }

  const formatModule = (mod: string) => {
    const m = mod.toLowerCase()
    if (isAr) {
      if (m.includes('data_management') || m.includes('data')) return 'إدارة البيانات'
      if (m.includes('business')) return 'إعدادات المنشأة'
      if (m.includes('user') || m.includes('member')) return 'المستخدمين'
      if (m.includes('account') || m.includes('journal')) return 'المحاسبة العامة'
      if (m.includes('sale') || m.includes('invoice')) return 'المبيعات'
      if (m.includes('purchase')) return 'المشتريات'
      if (m.includes('inventory') || m.includes('stock')) return 'المخزون'
      if (m.includes('treasury') || m.includes('cash') || m.includes('bank')) return 'الخزينة'
      if (m.includes('tax')) return 'الضرائب'
      return mod
    }
    if (isTr) {
      if (m.includes('data_management') || m.includes('data')) return 'Veri Yönetimi'
      if (m.includes('business')) return 'İşletmeler'
      if (m.includes('user') || m.includes('member')) return 'Kullanıcılar'
      if (m.includes('account')) return 'Muhasebe'
      if (m.includes('sale')) return 'Satış'
      if (m.includes('purchase')) return 'Satın Alma'
      if (m.includes('inventory')) return 'Stok'
      return mod
    }
    return mod
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="page-subtitle">{t.subtitle}</p>
        </div>
      </div>

      <SettingsNav businessId={businessId} />

      {/* Security Posture Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        <div
          style={{
            background: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <Shield size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{t.isolation.title}</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {t.isolation.status}
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t.isolation.desc}
          </p>
        </div>

        <div
          style={{
            background: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{t.members.title}</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {t.members.count(members.length)}
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t.members.desc}
          </p>
        </div>

        <div
          style={{
            background: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '12px',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8b5cf6',
              }}
            >
              <Lock size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{t.auth.title}</div>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {t.auth.status}
              </div>
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {t.auth.desc}
          </p>
        </div>
      </div>

      {/* Security Audit Activity */}
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
        {t.audit.title}
      </h3>

      <div
        style={{
          background: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          overflow: 'hidden',
          marginBottom: '2.5rem',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: isAr ? 'right' : 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted, #f8fafc)', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.audit.time}</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.audit.actor}</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.audit.action}</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.audit.module}</th>
                <th style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{t.audit.recordId}</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {t.audit.empty}
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString(isAr ? 'ar-SA' : isTr ? 'tr-TR' : 'en-US')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {log.userId ? log.userId.substring(0, 8) + '...' : t.audit.system}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background:
                            log.action === 'delete' || log.action === 'void'
                              ? 'rgba(239, 68, 68, 0.1)'
                              : log.action === 'update'
                              ? 'rgba(245, 158, 11, 0.1)'
                              : 'rgba(59, 130, 246, 0.1)',
                          color:
                            log.action === 'delete' || log.action === 'void'
                              ? '#ef4444'
                              : log.action === 'update'
                              ? '#f59e0b'
                              : '#3b82f6',
                        }}
                      >
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                      {formatModule(log.module)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontFamily: 'monospace', direction: 'ltr', textAlign: isAr ? 'right' : 'left' }}>
                      {log.recordId ? log.recordId.substring(0, 12) + '...' : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
