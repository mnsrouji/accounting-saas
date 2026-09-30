import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { getLocale } from 'next-intl/server'
import { ScrollText, ShieldAlert } from 'lucide-react'

export default async function AuditLogsPage({
  params,
}: {
  params: Promise<{ businessId: string }>
}) {
  const { businessId } = await params
  const { role } = await requireBusinessAccess(businessId)
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  // Only owners, admins, and accountants can view audit logs
  if (!['owner', 'administrator', 'accountant'].includes(role)) {
    return (
      <div className="p-8 text-center space-y-3" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {isAr ? 'تم رفض الوصول' : isTr ? 'Erişim Reddedildi' : 'Access Denied'}
        </h2>
        <p className="text-sm text-slate-500">
          {isAr
            ? 'فقط مالك المنشأة والمسؤولون والمحاسبون مخولون بالاطلاع على سجلات التدقيق الرقابي.'
            : isTr
            ? 'Yalnızca İşletme Sahipleri, Yöneticiler ve Muhasebeciler Denetim Günlüklerini görüntüleyebilir.'
            : 'Only Business Owners, Administrators, and Accountants can view Audit Logs.'}
        </p>
      </div>
    )
  }

  const logs = await prisma.auditLog.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {isAr ? 'سجل التدقيق والرقابة المالية' : isTr ? 'Denetim İzi Günlükleri' : 'Audit Trail Logs'}
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isAr
              ? 'سجل تدقيق غير قابل للتعديل لتتبع العمليات المالية والترحيلات وعمليات الإلغاء والأحداث الأمنية'
              : isTr
              ? 'Mali kayıtlar, ters kayıtlar ve güvenlik olayları için değiştirilemez uygulama düzeyinde denetim izi.'
              : 'Immutable application-level audit trail for financial postings, reversals, and security events.'}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs" style={{ textAlign: isAr ? 'right' : 'left' }}>
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="p-3">{isAr ? 'الوقت والتاريخ' : isTr ? 'Zaman Damgası' : 'Timestamp'}</th>
              <th className="p-3">{isAr ? 'العملية' : isTr ? 'İşlem' : 'Action'}</th>
              <th className="p-3">{isAr ? 'الوحدة / القسم' : isTr ? 'Modül' : 'Module'}</th>
              <th className="p-3">{isAr ? 'نوع السجل' : isTr ? 'Kayıt Türü' : 'Record Type'}</th>
              <th className="p-3">{isAr ? 'معرف السجل' : isTr ? 'Kayıt No' : 'Record ID'}</th>
              <th className="p-3">{isAr ? 'المستخدم' : isTr ? 'Kullanıcı' : 'User ID'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                  {isAr ? 'لم يتم تسجيل أي أحداث في سجل التدقيق حتى الآن.' : isTr ? 'Henüz denetim kaydı bulunmuyor.' : 'No audit log records recorded yet.'}
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-3 text-slate-500">{log.createdAt.toISOString().replace('T', ' ').substring(0, 19)}</td>
                  <td className="p-3 font-semibold text-indigo-600 dark:text-indigo-400 uppercase">{log.action}</td>
                  <td className="p-3 uppercase text-slate-700 dark:text-slate-300">{log.module}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">{log.recordType || '—'}</td>
                  <td className="p-3 font-mono text-slate-500 max-w-[150px] truncate">{log.recordId || '—'}</td>
                  <td className="p-3 font-mono text-slate-500 max-w-[150px] truncate">{log.userId || (isAr ? 'النظام' : isTr ? 'Sistem' : 'System')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
