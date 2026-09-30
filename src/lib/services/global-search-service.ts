// =============================================================
// Global Search Service — Business-Scoped Cross-Entity Search
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'

export interface SearchResultItem {
  id: string
  type:
    | 'customer'
    | 'supplier'
    | 'sale'
    | 'purchase'
    | 'payment'
    | 'product'
    | 'expense'
    | 'journal_entry'
    | 'quotation'
    | 'sales_order'
    | 'delivery_note'
    | 'purchase_request'
    | 'purchase_order'
    | 'goods_receipt'
    | 'sales_return'
    | 'purchase_return'
    | 'credit_note'
    | 'debit_note'
    | 'contact'
    | 'crm_activity'
    | 'crm_task'
    | 'opportunity'
    | 'payment_promise'
    | 'cash_account'
    | 'bank_account'
    | 'treasury_transfer'
    | 'bank_statement'
    | 'bank_reconciliation'
    | 'petty_cash_count'
  title: string
  subtitle: string
  date?: string
  amount?: string
  status?: string
  url: string
}

export class GlobalSearchService {
  /**
   * Search across all operational entities for a specific business.
   * Enforces tenant isolation strictly via businessId where clause.
   */
  static async search(businessId: string, query: string): Promise<SearchResultItem[]> {
    if (!query || query.trim().length < 2) return []

    const q = query.trim()
    const results: SearchResultItem[] = []

    // 1. Customers
    const customers = await prisma.customer.findMany({
      where: {
        businessId,
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { companyName: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    })
    customers.forEach((c) => {
      results.push({
        id: c.id,
        type: 'customer',
        title: c.name,
        subtitle: c.companyName ? `${c.companyName} (${c.code || 'Cust'})` : c.code || 'Customer',
        amount: `$${Number(c.balance).toFixed(2)} bal`,
        url: `/b/${businessId}/customers/${c.id}`,
      })
    })

    // 2. Suppliers
    const suppliers = await prisma.supplier.findMany({
      where: {
        businessId,
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { companyName: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    })
    suppliers.forEach((s) => {
      results.push({
        id: s.id,
        type: 'supplier',
        title: s.name,
        subtitle: s.companyName ? `${s.companyName} (${s.code || 'Supp'})` : s.code || 'Supplier',
        amount: `$${Number(s.balance).toFixed(2)} payable`,
        url: `/b/${businessId}/suppliers/${s.id}`,
      })
    })

    // 3. Sales Invoices
    const sales = await prisma.sale.findMany({
      where: {
        businessId,
        OR: [
          { invoiceNumber: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { customer: true },
      take: 5,
    })
    sales.forEach((s) => {
      results.push({
        id: s.id,
        type: 'sale',
        title: s.invoiceNumber,
        subtitle: s.customer ? s.customer.name : 'Sales Invoice',
        date: s.invoiceDate.toISOString().split('T')[0],
        amount: `$${Number(s.totalAmount).toFixed(2)}`,
        status: s.status,
        url: `/b/${businessId}/sales/${s.id}`,
      })
    })

    // 4. Purchase Invoices
    const purchases = await prisma.purchase.findMany({
      where: {
        businessId,
        OR: [
          { purchaseNumber: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { supplier: true },
      take: 5,
    })
    purchases.forEach((p) => {
      results.push({
        id: p.id,
        type: 'purchase',
        title: p.purchaseNumber,
        subtitle: p.supplier ? p.supplier.name : 'Purchase Invoice',
        date: p.purchaseDate.toISOString().split('T')[0],
        amount: `$${Number(p.totalAmount).toFixed(2)}`,
        status: p.status,
        url: `/b/${businessId}/purchases/${p.id}`,
      })
    })

    // 5. Payments
    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        OR: [
          { paymentNumber: { contains: q, mode: 'insensitive' } },
          { reference: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    })
    payments.forEach((p) => {
      results.push({
        id: p.id,
        type: 'payment',
        title: p.paymentNumber,
        subtitle: `${p.type.toUpperCase()} payment via ${p.method}`,
        date: p.paymentDate.toISOString().split('T')[0],
        amount: `$${Number(p.amount).toFixed(2)}`,
        status: p.status,
        url: `/b/${businessId}/payments/${p.id}`,
      })
    })

    // 6. Products
    const products = await prisma.product.findMany({
      where: {
        businessId,
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    })
    products.forEach((prod) => {
      results.push({
        id: prod.id,
        type: 'product',
        title: prod.name,
        subtitle: `SKU: ${prod.code || 'N/A'} • ${prod.productType}`,
        amount: `$${Number(prod.salePrice).toFixed(2)}`,
        url: `/b/${businessId}/inventory/${prod.id}`,
      })
    })

    // 7. Expenses
    const expenses = await prisma.expense.findMany({
      where: {
        businessId,
        OR: [
          { expenseNumber: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { vendor: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    })
    expenses.forEach((e) => {
      results.push({
        id: e.id,
        type: 'expense',
        title: e.expenseNumber,
        subtitle: e.description || 'Operating Expense',
        date: e.expenseDate.toISOString().split('T')[0],
        amount: `$${Number(e.amount).toFixed(2)}`,
        status: e.status,
        url: `/b/${businessId}/expenses/${e.id}`,
      })
    })

    // 8. Journal Entries
    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        businessId,
        OR: [
          { entryNumber: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    })
    journalEntries.forEach((je) => {
      results.push({
        id: je.id,
        type: 'journal_entry',
        title: je.entryNumber,
        subtitle: je.description || 'Journal Entry',
        date: je.entryDate.toISOString().split('T')[0],
        status: je.status,
        url: `/b/${businessId}/accounting/journal-entries`,
      })
    })

    // 9. Quotations
    const quotations = await prisma.quotation.findMany({
      where: {
        businessId,
        OR: [
          { quotationNumber: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { customer: true },
      take: 5,
    })
    quotations.forEach((quo) => {
      results.push({
        id: quo.id,
        type: 'quotation',
        title: quo.quotationNumber,
        subtitle: quo.customer ? quo.customer.name : 'Sales Quotation',
        date: quo.quotationDate.toISOString().split('T')[0],
        amount: `$${Number(quo.grandTotal).toFixed(2)}`,
        status: quo.status,
        url: `/b/${businessId}/sales/quotations/${quo.id}`,
      })
    })

    // 10. Sales Orders
    const salesOrders = await prisma.salesOrder.findMany({
      where: {
        businessId,
        OR: [
          { orderNumber: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { customer: true },
      take: 5,
    })
    salesOrders.forEach((so) => {
      results.push({
        id: so.id,
        type: 'sales_order',
        title: so.orderNumber,
        subtitle: so.customer ? so.customer.name : 'Sales Order',
        date: so.orderDate.toISOString().split('T')[0],
        amount: `$${Number(so.grandTotal).toFixed(2)}`,
        status: so.status,
        url: `/b/${businessId}/sales/orders/${so.id}`,
      })
    })

    // 11. Delivery Notes
    const deliveryNotes = await prisma.deliveryNote.findMany({
      where: {
        businessId,
        OR: [
          { deliveryNumber: { contains: q, mode: 'insensitive' } },
          { trackingNumber: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { customer: true },
      take: 5,
    })
    deliveryNotes.forEach((dn) => {
      results.push({
        id: dn.id,
        type: 'delivery_note',
        title: dn.deliveryNumber,
        subtitle: dn.customer ? dn.customer.name : 'Delivery Note',
        date: dn.deliveryDate.toISOString().split('T')[0],
        status: dn.status,
        url: `/b/${businessId}/sales/deliveries/${dn.id}`,
      })
    })

    // 12. Purchase Requests
    const purchaseRequests = await prisma.purchaseRequest.findMany({
      where: {
        businessId,
        OR: [
          { requestNumber: { contains: q, mode: 'insensitive' } },
          { department: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    })
    purchaseRequests.forEach((pr) => {
      results.push({
        id: pr.id,
        type: 'purchase_request',
        title: pr.requestNumber,
        subtitle: pr.department ? `Dept: ${pr.department}` : 'Purchase Request',
        date: pr.requestDate.toISOString().split('T')[0],
        status: pr.status,
        url: `/b/${businessId}/procurement/requests/${pr.id}`,
      })
    })

    // 13. Purchase Orders
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        businessId,
        OR: [
          { orderNumber: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { supplier: true },
      take: 5,
    })
    purchaseOrders.forEach((po) => {
      results.push({
        id: po.id,
        type: 'purchase_order',
        title: po.orderNumber,
        subtitle: po.supplier ? po.supplier.name : 'Purchase Order',
        date: po.orderDate.toISOString().split('T')[0],
        amount: `$${Number(po.grandTotal).toFixed(2)}`,
        status: po.status,
        url: `/b/${businessId}/procurement/orders/${po.id}`,
      })
    })

    // 14. Goods Receipts
    const goodsReceipts = await prisma.goodsReceipt.findMany({
      where: {
        businessId,
        OR: [
          { receiptNumber: { contains: q, mode: 'insensitive' } },
          { supplierDeliveryNote: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { supplier: true },
      take: 5,
    })
    goodsReceipts.forEach((gr) => {
      results.push({
        id: gr.id,
        type: 'goods_receipt',
        title: gr.receiptNumber,
        subtitle: gr.supplier ? gr.supplier.name : 'Goods Receipt',
        date: gr.receiptDate.toISOString().split('T')[0],
        status: gr.status,
        url: `/b/${businessId}/procurement/receipts/${gr.id}`,
      })
    })

    // 15. Sales Returns
    const salesReturns = await prisma.salesReturn.findMany({
      where: {
        businessId,
        OR: [
          { returnNumber: { contains: q, mode: 'insensitive' } },
          { reason: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { customer: true },
      take: 5,
    })
    salesReturns.forEach((sr) => {
      results.push({
        id: sr.id,
        type: 'sales_return',
        title: sr.returnNumber,
        subtitle: sr.customer ? sr.customer.name : 'Sales Return',
        date: sr.returnDate.toISOString().split('T')[0],
        amount: `$${Number(sr.totalAmount).toFixed(2)}`,
        status: sr.status,
        url: `/b/${businessId}/sales/returns/${sr.id}`,
      })
    })

    // 16. Purchase Returns
    const purchaseReturns = await prisma.purchaseReturn.findMany({
      where: {
        businessId,
        OR: [
          { returnNumber: { contains: q, mode: 'insensitive' } },
          { reason: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { supplier: true },
      take: 5,
    })
    purchaseReturns.forEach((prn) => {
      results.push({
        id: prn.id,
        type: 'purchase_return',
        title: prn.returnNumber,
        subtitle: prn.supplier ? prn.supplier.name : 'Purchase Return',
        date: prn.returnDate.toISOString().split('T')[0],
        amount: `$${Number(prn.totalAmount).toFixed(2)}`,
        status: prn.status,
        url: `/b/${businessId}/procurement/returns/${prn.id}`,
      })
    })

    // 17. Credit & Debit Notes
    const creditDebitNotes = await prisma.creditDebitNote.findMany({
      where: {
        businessId,
        OR: [
          { noteNumber: { contains: q, mode: 'insensitive' } },
          { reason: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { customer: true, supplier: true },
      take: 5,
    })
    creditDebitNotes.forEach((cdn) => {
      const partyName = cdn.type === 'credit_note' ? (cdn.customer?.name || 'Customer') : (cdn.supplier?.name || 'Supplier')
      results.push({
        id: cdn.id,
        type: cdn.type as any,
        title: cdn.noteNumber,
        subtitle: `${cdn.type === 'credit_note' ? 'Credit Note' : 'Debit Note'} • ${partyName}`,
        date: cdn.noteDate.toISOString().split('T')[0],
        amount: `$${Number(cdn.totalAmount).toFixed(2)}`,
        status: cdn.status,
        url: `/b/${businessId}/accounting/notes/${cdn.id}`,
      })
    })

    // 18. Customer & Supplier Contacts
    const [customerContacts, supplierContacts] = await Promise.all([
      prisma.customerContact.findMany({
        where: {
          businessId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { mobile: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { customer: { select: { id: true, name: true } } },
        take: 5,
      }),
      prisma.supplierContact.findMany({
        where: {
          businessId,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { mobile: { contains: q, mode: 'insensitive' } },
          ],
        },
        include: { supplier: { select: { id: true, name: true } } },
        take: 5,
      }),
    ])

    customerContacts.forEach((cc) => {
      results.push({
        id: cc.id,
        type: 'contact',
        title: cc.name,
        subtitle: `Contact • ${cc.title || cc.email || 'Customer Contact'} (${cc.customer.name})`,
        url: `/b/${businessId}/customers/${cc.customerId}`,
      })
    })

    supplierContacts.forEach((sc) => {
      results.push({
        id: sc.id,
        type: 'contact',
        title: sc.name,
        subtitle: `Contact • ${sc.title || sc.email || 'Supplier Contact'} (${sc.supplier.name})`,
        url: `/b/${businessId}/suppliers/${sc.supplierId}`,
      })
    })

    // 19. CRM Activities
    const activities = await prisma.crmActivity.findMany({
      where: {
        businessId,
        OR: [
          { subject: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { customer: true, supplier: true },
      take: 5,
    })
    activities.forEach((act) => {
      const party = act.customer?.name || act.supplier?.name || 'CRM Activity'
      results.push({
        id: act.id,
        type: 'crm_activity',
        title: act.subject,
        subtitle: `${act.activityType.toUpperCase()} • ${party}`,
        date: act.activityDate.toISOString().split('T')[0],
        status: act.status,
        url: `/b/${businessId}/crm/activities`,
      })
    })

    // 20. CRM Tasks
    const tasks = await prisma.crmTask.findMany({
      where: {
        businessId,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { customer: true, supplier: true },
      take: 5,
    })
    tasks.forEach((tsk) => {
      const party = tsk.customer?.name || tsk.supplier?.name || 'Task'
      results.push({
        id: tsk.id,
        type: 'crm_task',
        title: tsk.title,
        subtitle: `Task (${tsk.priority}) • ${party}`,
        date: tsk.dueDate.toISOString().split('T')[0],
        status: tsk.status,
        url: `/b/${businessId}/crm/tasks`,
      })
    })

    // 21. Sales Opportunities
    const opportunities = await prisma.salesOpportunity.findMany({
      where: {
        businessId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { customer: true },
      take: 5,
    })
    opportunities.forEach((opp) => {
      results.push({
        id: opp.id,
        type: 'opportunity',
        title: opp.name,
        subtitle: `Opportunity • ${opp.customer ? opp.customer.name : 'Prospect'} (${opp.probability}%)`,
        amount: `$${Number(opp.expectedValue).toFixed(2)}`,
        status: opp.stage,
        url: `/b/${businessId}/crm/opportunities`,
      })
    })

    // 22. Payment Promises
    const promises = await prisma.paymentPromise.findMany({
      where: {
        businessId,
        OR: [
          { notes: { contains: q, mode: 'insensitive' } },
          { customer: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: { customer: true },
      take: 5,
    })
      promises.forEach((prm) => {
      results.push({
        id: prm.id,
        type: 'payment_promise',
        title: `Promise: $${Number(prm.promisedAmount).toFixed(2)}`,
        subtitle: `Payment Promise • ${prm.customer.name}`,
        date: prm.promiseDate.toISOString().split('T')[0],
        amount: `$${Number(prm.promisedAmount).toFixed(2)}`,
        status: prm.status,
        url: `/b/${businessId}/collections/promises`,
      })
    })

    // 23. Cash Accounts
    const cashAccounts = await prisma.cashAccount.findMany({
      where: {
        businessId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    })
    cashAccounts.forEach((c) => {
      results.push({
        id: c.id,
        type: 'cash_account',
        title: c.name,
        subtitle: `${c.isPettyCash ? 'Petty Cash' : 'Cash Account'} • ${c.code || ''}`,
        amount: `$${Number(c.balance).toFixed(2)}`,
        status: c.isActive ? 'active' : 'inactive',
        url: `/b/${businessId}/treasury/cash`,
      })
    })

    // 24. Bank Accounts
    const bankAccounts = await prisma.bankAccount.findMany({
      where: {
        businessId,
        OR: [
          { bankName: { contains: q, mode: 'insensitive' } },
          { accountName: { contains: q, mode: 'insensitive' } },
          { accountNumber: { contains: q, mode: 'insensitive' } },
          { iban: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    })
    bankAccounts.forEach((b) => {
      results.push({
        id: b.id,
        type: 'bank_account',
        title: `${b.bankName} - ${b.accountName}`,
        subtitle: `Bank Account • ${b.accountNumber || b.iban || ''}`,
        amount: `$${Number(b.balance).toFixed(2)}`,
        status: b.isActive ? 'active' : 'inactive',
        url: `/b/${businessId}/treasury/banks`,
      })
    })

    // 25. Treasury Transfers
    const transfers = await prisma.treasuryTransfer.findMany({
      where: {
        businessId,
        OR: [
          { transferNumber: { contains: q, mode: 'insensitive' } },
          { reference: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    })
    transfers.forEach((trf) => {
      results.push({
        id: trf.id,
        type: 'treasury_transfer',
        title: `Transfer: ${trf.transferNumber}`,
        subtitle: `Treasury Transfer • ${trf.reference || ''}`,
        date: trf.transferDate.toISOString().split('T')[0],
        amount: `$${Number(trf.amount).toFixed(2)}`,
        status: trf.status,
        url: `/b/${businessId}/treasury/transfers`,
      })
    })

    // 26. Bank Statements
    const statements = await prisma.bankStatement.findMany({
      where: {
        businessId,
        OR: [
          { statementNumber: { contains: q, mode: 'insensitive' } },
          { bankAccount: { bankName: { contains: q, mode: 'insensitive' } } },
        ],
      },
      include: { bankAccount: true },
      take: 5,
    })
    statements.forEach((stmt) => {
      results.push({
        id: stmt.id,
        type: 'bank_statement',
        title: `Statement: ${stmt.statementNumber}`,
        subtitle: `Bank Statement • ${stmt.bankAccount.bankName}`,
        date: stmt.startDate.toISOString().split('T')[0],
        amount: `$${Number(stmt.closingBalance).toFixed(2)} closing`,
        status: stmt.status,
        url: `/b/${businessId}/treasury/statements`,
      })
    })

    // 27. Bank Reconciliations
    const reconciliations = await prisma.bankReconciliation.findMany({
      where: {
        businessId,
        OR: [
          { reconciliationNumber: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { bankAccount: true },
      take: 5,
    })
    reconciliations.forEach((rec) => {
      results.push({
        id: rec.id,
        type: 'bank_reconciliation',
        title: `Reconciliation: ${rec.reconciliationNumber}`,
        subtitle: `Bank Reconciliation • ${rec.bankAccount.bankName}`,
        date: rec.periodEnd.toISOString().split('T')[0],
        amount: `Diff: $${Number(rec.difference).toFixed(2)}`,
        status: rec.status,
        url: `/b/${businessId}/treasury/reconciliation`,
      })
    })

    // 28. Petty Cash Counts
    const counts = await prisma.pettyCashCount.findMany({
      where: {
        businessId,
        OR: [
          { countNumber: { contains: q, mode: 'insensitive' } },
          { notes: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
    })
    counts.forEach((cnt) => {
      results.push({
        id: cnt.id,
        type: 'petty_cash_count',
        title: `Cash Count: ${cnt.countNumber}`,
        subtitle: `Petty Cash Count • Counted: $${Number(cnt.countedAmount).toFixed(2)}`,
        date: cnt.countDate.toISOString().split('T')[0],
        amount: `Variance: $${Number(cnt.varianceAmount).toFixed(2)}`,
        status: cnt.status,
        url: `/b/${businessId}/treasury/petty-cash`,
      })
    })

    return results
  }
}
