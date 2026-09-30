import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, DollarSign, CheckCircle } from 'lucide-react'
import { PrintButton } from '@/components/ui/PrintButton'

export default async function ExpenseVoucherPage({
  params,
}: {
  params: Promise<{ businessId: string; expenseId: string }>
}) {
  const { businessId, expenseId } = await params
  await requireBusinessAccess(businessId)

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_REGEX.test(expenseId)) {
    notFound()
  }

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, businessId },
    include: {
      account: true,
      bankAccount: true,
      cashAccount: true,
      supplier: true,
    },
  })

  if (!expense) notFound()

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/b/${businessId}/expenses`}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} /> Back to Expenses
        </Link>
        <PrintButton
          label="Print Expense Voucher"
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          iconSize={15}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-sm space-y-8 print:shadow-none print:border-none print:p-0">
        <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                <DollarSign size={20} />
              </span>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                EXPENSE DISBURSEMENT VOUCHER
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-2">Voucher Number: <span className="font-semibold text-slate-700 dark:text-slate-300">{expense.expenseNumber}</span></p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              <CheckCircle size={14} /> {expense.status.toUpperCase()}
            </span>
            <p className="text-xs text-slate-500 mt-2">Date: {expense.expenseDate.toISOString().split('T')[0]}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-6 border border-slate-200/60 dark:border-slate-800">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Expense Account Category</div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{expense.account?.name || 'Operating Expense'}</div>
            <div className="text-xs text-slate-500 mt-1">Code: {expense.account?.code || 'N/A'}</div>
            {expense.description && (
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-2 italic">&quot;{expense.description}&quot;</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Expense Amount</div>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              ${Number(expense.amount).toFixed(2)} <span className="text-sm font-normal text-slate-500">{expense.currencyCode}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Paid From: <span className="font-medium text-slate-700 dark:text-slate-300">{expense.bankAccount?.accountName || expense.cashAccount?.name || 'Cash Account'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
