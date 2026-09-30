import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CreditCard, CheckCircle } from 'lucide-react'
import { PrintButton } from '@/components/ui/PrintButton'

export default async function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ businessId: string; paymentId: string }>
}) {
  const { businessId, paymentId } = await params
  await requireBusinessAccess(businessId)

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_REGEX.test(paymentId)) {
    notFound()
  }

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, businessId },
    include: {
      customer: true,
      supplier: true,
      bankAccount: true,
      allocations: {
        include: {
          sale: true,
          purchase: true,
        },
      },
    },
  })

  if (!payment) notFound()

  const contactName = payment.customer?.name || payment.supplier?.name || 'General Contact'
  const isIncoming = payment.type === 'incoming'

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/b/${businessId}/payments`}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} /> Back to Payments
        </Link>
        <PrintButton
          label="Print Receipt"
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          iconSize={15}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-sm space-y-8 print:shadow-none print:border-none print:p-0">
        <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                <CreditCard size={20} />
              </span>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                OFFICIAL PAYMENT RECEIPT
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-2">Receipt Number: <span className="font-semibold text-slate-700 dark:text-slate-300">{payment.paymentNumber}</span></p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400">
              <CheckCircle size={14} /> {payment.status.toUpperCase()}
            </span>
            <p className="text-xs text-slate-500 mt-2">Date: {payment.paymentDate.toISOString().split('T')[0]}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-6 border border-slate-200/60 dark:border-slate-800">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {isIncoming ? 'Received From Customer' : 'Paid To Supplier'}
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">{contactName}</div>
            <div className="text-xs text-slate-500 mt-1">
              Method: <span className="font-medium text-slate-700 dark:text-slate-300 uppercase">{payment.method}</span>
            </div>
            {payment.reference && (
              <div className="text-xs text-slate-500">Ref: {payment.reference}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Payment Amount</div>
            <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
              ${Number(payment.amount).toFixed(2)} <span className="text-sm font-normal text-slate-500">{payment.currencyCode}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Account: <span className="font-medium text-slate-700 dark:text-slate-300">{payment.bankAccount?.accountName || 'Cash Account'}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Allocated Invoices & Bills
          </h2>
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                <tr>
                  <th className="p-3">Document Ref</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Allocated Amount ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {payment.allocations.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-500 italic">
                      Unallocated advance payment
                    </td>
                  </tr>
                ) : (
                  payment.allocations.map((alloc) => (
                    <tr key={alloc.id}>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                        {alloc.sale?.invoiceNumber || alloc.purchase?.purchaseNumber || 'Direct Allocation'}
                      </td>
                      <td className="p-3 text-slate-500">
                        {alloc.sale ? 'Sales Invoice' : alloc.purchase ? 'Purchase Bill' : 'Credit'}
                      </td>
                      <td className="p-3 text-slate-500">{alloc.allocationDate.toISOString().split('T')[0]}</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">
                        ${Number(alloc.allocatedAmount).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
