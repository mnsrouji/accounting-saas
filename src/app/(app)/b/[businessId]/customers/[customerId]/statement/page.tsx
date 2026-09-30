import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { StatementService } from '@/lib/services/statement-service'
import Link from 'next/link'
import { getLocale } from 'next-intl/server'
import { PrintButton } from '@/components/ui/PrintButton'
import { ArrowLeft } from 'lucide-react'

export default async function CustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string; customerId: string }>
  searchParams: Promise<{ startDate?: string; endDate?: string }>
}) {
  const { businessId, customerId } = await params
  const { startDate, endDate } = await searchParams
  const locale = await getLocale()
  const isAr = locale === 'ar'
  const isTr = locale === 'tr'

  await requireBusinessAccess(businessId)

  const statement = await StatementService.getCustomerStatement(
    businessId,
    customerId,
    startDate,
    endDate
  )

  const t = {
    back: isAr ? 'الرجوع لملف العميل' : isTr ? 'Müşteri Profiline Dön' : 'Back to Customer Profile',
    printBtn: isAr ? 'طباعة كشف الحساب' : isTr ? 'Ekstreyi Yazdır' : 'Print Statement',
    title: isAr ? 'كشف حساب عميل' : isTr ? 'MÜŞTERİ HESAP EKSTRESİ' : 'CUSTOMER STATEMENT',
    period: isAr ? 'الفترة:' : isTr ? 'Dönem:' : 'Period:',
    to: isAr ? 'إلى' : isTr ? '-' : 'to',
    ref: isAr ? 'رمز الحساب:' : isTr ? 'Hesap Ref:' : 'Account Ref:',
    currency: isAr ? 'العملة:' : isTr ? 'Para Birimi:' : 'Currency:',
    openingBalance: isAr ? 'الرصيد الافتتاحي' : isTr ? 'Açılış Bakiyesi' : 'Opening Balance',
    invoicedDebits: isAr ? 'المفوتر (مدين)' : isTr ? 'Faturalanan (Borç)' : 'Invoiced (Debits)',
    paidCredits: isAr ? 'المسدد (دائن)' : isTr ? 'Tahsil Edilen (Alacak)' : 'Paid (Credits)',
    closingBalance: isAr ? 'الرصيد الختامي' : isTr ? 'Kapanış Bakiyesi' : 'Closing Balance',
    ledgerDetail: isAr ? 'تفاصيل حركات دفتر الأستاذ' : isTr ? 'Ekstre Hareket Detayı' : 'Statement Ledger Detail',
    date: isAr ? 'التاريخ' : isTr ? 'Tarih' : 'Date',
    reference: isAr ? 'المرجع' : isTr ? 'Referans' : 'Reference',
    description: isAr ? 'البيان / الوصف' : isTr ? 'Açıklama' : 'Description',
    debit: (curr: string) => isAr ? `مدين (${curr})` : isTr ? `Borç (${curr})` : `Debit (${curr})`,
    credit: (curr: string) => isAr ? `دائن (${curr})` : isTr ? `Alacak (${curr})` : `Credit (${curr})`,
    balance: (curr: string) => isAr ? `الرصيد التراكمي (${curr})` : isTr ? `Bakiye (${curr})` : `Running Balance (${curr})`,
    openingBf: isAr ? 'رصيد افتتاحي مدور من الفترة السابقة' : isTr ? 'Devreden Açılış Bakiyesi' : 'Opening Balance Brought Forward',
    agingTitle: isAr ? 'تحليل أعمار الذمم المدينة' : isTr ? 'Alacak Yaşlandırma Analizi' : 'Aging Summary Analysis',
    currentDays: isAr ? 'الحالي (0-30 يوم)' : isTr ? 'Cari (0-30 gün)' : 'Current (0-30 days)',
    days31To60: isAr ? '31-60 يوم' : isTr ? '31-60 Gün' : '31-60 Days',
    days61To90: isAr ? '61-90 يوم' : isTr ? '61-90 Gün' : '61-90 Days',
    days90Plus: isAr ? 'أكثر من 90 يوم' : isTr ? '90+ Gün' : '90+ Days Overdue',
    totalOutstanding: isAr ? 'إجمالي المستحق' : isTr ? 'Toplam Alacak' : 'Total Outstanding',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" style={{ direction: isAr ? 'rtl' : 'ltr' }}>
      {/* Header Actions */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/b/${businessId}/customers/${customerId}`}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} style={{ transform: isAr ? 'rotate(180deg)' : 'none' }} /> {t.back}
        </Link>
        <div className="flex items-center gap-3">
          <PrintButton label={t.printBtn} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50" />
        </div>
      </div>

      {/* Printable Statement Document */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-sm space-y-8 print:shadow-none print:border-none print:p-0">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t.title}</h1>
            <p className="text-sm text-slate-500 mt-1">{t.period} {statement.startDate} {t.to} {statement.endDate}</p>
          </div>
          <div style={{ textAlign: isAr ? 'left' : 'right' }}>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{statement.contactName}</h2>
            <p className="text-xs text-slate-500">{t.ref} {statement.contactCode}</p>
            <p className="text-xs text-slate-500">{t.currency} {statement.currency}</p>
          </div>
        </div>

        {/* Financial Summary KPI Bar */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{t.openingBalance}</div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1" style={{ direction: 'ltr' }}>
              {statement.openingBalance.toFixed(2)} {statement.currency}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{t.invoicedDebits}</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1" style={{ direction: 'ltr' }}>
              {statement.totalDebits.toFixed(2)} {statement.currency}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{t.paidCredits}</div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1" style={{ direction: 'ltr' }}>
              {statement.totalCredits.toFixed(2)} {statement.currency}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider">{t.closingBalance}</div>
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1" style={{ direction: 'ltr' }}>
              {statement.closingBalance.toFixed(2)} {statement.currency}
            </div>
          </div>
        </div>

        {/* Ledger Transaction History Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            {t.ledgerDetail}
          </h3>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-xs" style={{ textAlign: isAr ? 'right' : 'left' }}>
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3">{t.date}</th>
                  <th className="p-3">{t.reference}</th>
                  <th className="p-3">{t.description}</th>
                  <th className="p-3" style={{ textAlign: isAr ? 'left' : 'right' }}>{t.debit(statement.currency)}</th>
                  <th className="p-3" style={{ textAlign: isAr ? 'left' : 'right' }}>{t.credit(statement.currency)}</th>
                  <th className="p-3" style={{ textAlign: isAr ? 'left' : 'right' }}>{t.balance(statement.currency)}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <tr className="bg-slate-50/50 dark:bg-slate-900/50 italic text-slate-500">
                  <td className="p-3">{statement.startDate}</td>
                  <td className="p-3">—</td>
                  <td className="p-3">{t.openingBf}</td>
                  <td className="p-3" style={{ textAlign: isAr ? 'left' : 'right' }}>—</td>
                  <td className="p-3" style={{ textAlign: isAr ? 'left' : 'right' }}>—</td>
                  <td className="p-3 font-medium" style={{ textAlign: isAr ? 'left' : 'right', direction: 'ltr' }}>{statement.openingBalance.toFixed(2)}</td>
                </tr>
                {statement.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3">{line.date}</td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">{line.reference}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{line.description}</td>
                    <td className="p-3" style={{ textAlign: isAr ? 'left' : 'right' }}>{line.debit > 0 ? line.debit.toFixed(2) : '—'}</td>
                    <td className="p-3" style={{ textAlign: isAr ? 'left' : 'right' }}>{line.credit > 0 ? line.credit.toFixed(2) : '—'}</td>
                    <td className="p-3 font-semibold text-slate-900 dark:text-slate-100" style={{ textAlign: isAr ? 'left' : 'right' }}>
                      {line.balance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Aging Summary Breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            {t.agingTitle}
          </h3>
          <div className="grid grid-cols-5 gap-3 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-center bg-slate-50 dark:bg-slate-800/30">
            <div>
              <div className="text-[11px] text-slate-500">{t.currentDays}</div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1" style={{ direction: 'ltr' }}>{statement.aging.days1To30.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">{t.days31To60}</div>
              <div className="text-sm font-bold text-amber-600 mt-1" style={{ direction: 'ltr' }}>{statement.aging.days31To60.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">{t.days61To90}</div>
              <div className="text-sm font-bold text-orange-600 mt-1" style={{ direction: 'ltr' }}>{statement.aging.days61To90.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">{t.days90Plus}</div>
              <div className="text-sm font-bold text-rose-600 mt-1" style={{ direction: 'ltr' }}>{statement.aging.days90Plus.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500 font-semibold">{t.totalOutstanding}</div>
              <div className="text-sm font-bold text-indigo-600 mt-1" style={{ direction: 'ltr' }}>{statement.aging.totalOutstanding.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
