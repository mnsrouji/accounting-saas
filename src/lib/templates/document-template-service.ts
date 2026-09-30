// =============================================================
// Document Template Service — Template Rendering Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { StatementService } from '@/lib/services/statement-service'
import { SettingsService } from '@/lib/services/settings-service'

export interface DocumentCompanyInfo {
  name: string
  legalName?: string | null
  taxNumber?: string | null
  registrationNumber?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  logoUrl?: string | null
  currency: string
}

export interface DocumentPartyInfo {
  id: string
  name: string
  companyName?: string | null
  taxNumber?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
}

export interface DocumentLineItem {
  id: string
  name: string
  sku?: string | null
  description?: string | null
  quantity: number
  unitPrice: number
  discountRate?: number
  discountAmount?: number
  taxRate?: number
  taxAmount?: number
  total: number
}

export interface DocumentTemplateData {
  type: 'sales_invoice' | 'purchase_invoice' | 'payment_receipt' | 'expense_voucher' | 'customer_statement' | 'supplier_statement'
  documentNumber: string
  reference?: string | null
  date: string
  dueDate?: string | null
  company: DocumentCompanyInfo
  party?: DocumentPartyInfo | null
  currency: string
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  amountPaid: number
  balanceDue: number
  status: string
  notes?: string | null
  terms?: string | null
  items: DocumentLineItem[]
  statementData?: any
  bankDetails?: string | null
  accentColor?: string
}

export class DocumentTemplateService {
  /**
   * Render Sales Invoice document data.
   */
  static async getSalesInvoiceData(businessId: string, saleId: string): Promise<DocumentTemplateData> {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, businessId },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!sale) throw new Error(`Sale ${saleId} not found in business ${businessId}`)

    const settings = await SettingsService.getBusinessSettings(businessId)

    const items: DocumentLineItem[] = sale.items.map((item) => ({
      id: item.id,
      name: item.product?.name || item.description || 'Custom Item',
      sku: item.product?.code || null,
      description: item.description || null,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discountRate: Number(item.discount || 0),
      discountAmount: 0,
      taxRate: Number(item.taxRate || 0),
      taxAmount: Number(item.taxAmount || 0),
      total: Number(item.lineTotal),
    }))

    return {
      type: 'sales_invoice',
      documentNumber: sale.invoiceNumber,
      reference: null,
      date: sale.invoiceDate.toISOString().split('T')[0],
      dueDate: sale.dueDate ? sale.dueDate.toISOString().split('T')[0] : null,
      company: {
        name: settings.company.name,
        legalName: settings.company.legalName,
        taxNumber: settings.company.taxNumber,
        registrationNumber: settings.company.registrationNumber,
        address: settings.company.address,
        phone: settings.company.phone,
        email: settings.company.email,
        website: settings.company.website,
        logoUrl: settings.company.logoUrl,
        currency: sale.currencyCode,
      },
      party: sale.customer
        ? {
            id: sale.customer.id,
            name: sale.customer.name,
            companyName: sale.customer.companyName,
            taxNumber: sale.customer.taxNumber,
            address: sale.customer.address,
            phone: sale.customer.phone,
            email: sale.customer.email,
          }
        : null,
      currency: sale.currencyCode,
      subtotal: Number(sale.subtotal),
      discountTotal: Number(sale.discountAmount || 0),
      taxTotal: Number(sale.taxAmount || 0),
      total: Number(sale.totalAmount),
      amountPaid: Number(sale.paidAmount || 0),
      balanceDue: Number(sale.balanceDue || 0),
      status: sale.status,
      notes: sale.notes,
      terms: sale.terms || settings.templates.termsAndConditions,
      items,
      bankDetails: settings.templates.bankDetailsText,
      accentColor: settings.templates.accentColor,
    }
  }

  /**
   * Render Purchase Invoice / Bill document data.
   */
  static async getPurchaseInvoiceData(businessId: string, purchaseId: string): Promise<DocumentTemplateData> {
    const purchase = await prisma.purchase.findFirst({
      where: { id: purchaseId, businessId },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (!purchase) throw new Error(`Purchase ${purchaseId} not found in business ${businessId}`)

    const settings = await SettingsService.getBusinessSettings(businessId)

    const items: DocumentLineItem[] = purchase.items.map((item) => ({
      id: item.id,
      name: item.product?.name || item.description || 'Item',
      sku: item.product?.code || null,
      description: item.description || null,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate || 0),
      taxAmount: Number(item.taxAmount || 0),
      total: Number(item.lineTotal),
    }))

    return {
      type: 'purchase_invoice',
      documentNumber: purchase.purchaseNumber,
      reference: purchase.referenceNumber,
      date: purchase.purchaseDate.toISOString().split('T')[0],
      dueDate: purchase.dueDate ? purchase.dueDate.toISOString().split('T')[0] : null,
      company: {
        name: settings.company.name,
        legalName: settings.company.legalName,
        taxNumber: settings.company.taxNumber,
        registrationNumber: settings.company.registrationNumber,
        address: settings.company.address,
        phone: settings.company.phone,
        email: settings.company.email,
        website: settings.company.website,
        logoUrl: settings.company.logoUrl,
        currency: purchase.currencyCode,
      },
      party: purchase.supplier
        ? {
            id: purchase.supplier.id,
            name: purchase.supplier.name,
            companyName: purchase.supplier.companyName,
            taxNumber: purchase.supplier.taxNumber,
            address: purchase.supplier.address,
            phone: purchase.supplier.phone,
            email: purchase.supplier.email,
          }
        : null,
      currency: purchase.currencyCode,
      subtotal: Number(purchase.subtotal),
      discountTotal: Number(purchase.discountAmount || 0),
      taxTotal: Number(purchase.taxAmount || 0),
      total: Number(purchase.totalAmount),
      amountPaid: Number(purchase.paidAmount || 0),
      balanceDue: Number(purchase.balanceDue || 0),
      status: purchase.status,
      notes: purchase.notes,
      terms: settings.templates.termsAndConditions,
      items,
      accentColor: settings.templates.accentColor,
    }
  }

  /**
   * Render Payment Receipt document data.
   */
  static async getPaymentReceiptData(businessId: string, paymentId: string): Promise<DocumentTemplateData> {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, businessId },
      include: {
        customer: true,
        supplier: true,
        bankAccount: true,
        cashAccount: true,
        allocations: {
          include: {
            sale: true,
            purchase: true,
          },
        },
      },
    })

    if (!payment) throw new Error(`Payment ${paymentId} not found in business ${businessId}`)

    const settings = await SettingsService.getBusinessSettings(businessId)
    const party = payment.customer || payment.supplier

    const items: DocumentLineItem[] = payment.allocations.map((alloc) => {
      const docRef = alloc.sale?.invoiceNumber || alloc.purchase?.purchaseNumber || 'General Allocation'
      return {
        id: alloc.id,
        name: `Allocation to ${docRef}`,
        description: `Applied against invoice ${docRef}`,
        quantity: 1,
        unitPrice: Number(alloc.allocatedAmount),
        total: Number(alloc.allocatedAmount),
      }
    })

    return {
      type: 'payment_receipt',
      documentNumber: payment.paymentNumber,
      reference: payment.reference,
      date: payment.paymentDate.toISOString().split('T')[0],
      company: {
        name: settings.company.name,
        legalName: settings.company.legalName,
        taxNumber: settings.company.taxNumber,
        registrationNumber: settings.company.registrationNumber,
        address: settings.company.address,
        phone: settings.company.phone,
        email: settings.company.email,
        website: settings.company.website,
        logoUrl: settings.company.logoUrl,
        currency: payment.currencyCode,
      },
      party: party
        ? {
            id: party.id,
            name: party.name,
            companyName: (party as any).companyName,
            taxNumber: party.taxNumber,
            address: party.address,
            phone: party.phone,
            email: party.email,
          }
        : null,
      currency: payment.currencyCode,
      subtotal: Number(payment.amount),
      discountTotal: 0,
      taxTotal: 0,
      total: Number(payment.amount),
      amountPaid: Number(payment.amount),
      balanceDue: Number(payment.unallocatedAmount || 0),
      status: payment.status,
      notes: payment.notes,
      items,
      accentColor: settings.templates.accentColor,
    }
  }

  /**
   * Render Expense Voucher document data.
   */
  static async getExpenseVoucherData(businessId: string, expenseId: string): Promise<DocumentTemplateData> {
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, businessId },
      include: {
        supplier: true,
        category: true,
        account: true,
      },
    })

    if (!expense) throw new Error(`Expense ${expenseId} not found in business ${businessId}`)

    const settings = await SettingsService.getBusinessSettings(businessId)

    const items: DocumentLineItem[] = [
      {
        id: expense.id,
        name: expense.category?.name || expense.account?.name || 'Expense Item',
        description: expense.description || null,
        quantity: 1,
        unitPrice: Number(expense.amount || expense.totalAmount),
        taxAmount: Number(expense.taxAmount || 0),
        total: Number(expense.totalAmount),
      },
    ]

    return {
      type: 'expense_voucher',
      documentNumber: expense.expenseNumber,
      reference: expense.vendor || null,
      date: expense.expenseDate.toISOString().split('T')[0],
      company: {
        name: settings.company.name,
        legalName: settings.company.legalName,
        taxNumber: settings.company.taxNumber,
        registrationNumber: settings.company.registrationNumber,
        address: settings.company.address,
        phone: settings.company.phone,
        email: settings.company.email,
        website: settings.company.website,
        logoUrl: settings.company.logoUrl,
        currency: expense.currencyCode,
      },
      party: expense.supplier
        ? {
            id: expense.supplier.id,
            name: expense.supplier.name,
            companyName: expense.supplier.companyName,
            taxNumber: expense.supplier.taxNumber,
            address: expense.supplier.address,
            phone: expense.supplier.phone,
            email: expense.supplier.email,
          }
        : null,
      currency: expense.currencyCode,
      subtotal: Number(expense.amount || expense.totalAmount),
      discountTotal: 0,
      taxTotal: Number(expense.taxAmount || 0),
      total: Number(expense.totalAmount),
      amountPaid: Number(expense.totalAmount),
      balanceDue: 0,
      status: expense.status,
      notes: expense.notes,
      items,
      accentColor: settings.templates.accentColor,
    }
  }

  /**
   * Render Customer Statement document data.
   */
  static async getCustomerStatementData(businessId: string, customerId: string, fromDate?: Date, toDate?: Date): Promise<DocumentTemplateData> {
    const fromStr = (fromDate || new Date(new Date().getFullYear(), 0, 1)).toISOString().split('T')[0]
    const toStr = (toDate || new Date()).toISOString().split('T')[0]

    const statement = await StatementService.getCustomerStatement(businessId, customerId, fromStr, toStr)
    const settings = await SettingsService.getBusinessSettings(businessId)

    const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId } })

    const items: DocumentLineItem[] = statement.lines.map((tx: any, idx: number) => ({
      id: `${tx.type}-${idx}`,
      name: tx.reference || tx.type,
      description: tx.description || `${tx.type.toUpperCase()} on ${tx.date}`,
      quantity: 1,
      unitPrice: tx.debit > 0 ? tx.debit : tx.credit,
      total: tx.balance,
    }))

    return {
      type: 'customer_statement',
      documentNumber: `STMT-${customerId.slice(0, 8).toUpperCase()}`,
      reference: `Period: ${statement.startDate} to ${statement.endDate}`,
      date: new Date().toISOString().split('T')[0],
      company: {
        name: settings.company.name,
        legalName: settings.company.legalName,
        taxNumber: settings.company.taxNumber,
        registrationNumber: settings.company.registrationNumber,
        address: settings.company.address,
        phone: settings.company.phone,
        email: settings.company.email,
        website: settings.company.website,
        logoUrl: settings.company.logoUrl,
        currency: statement.currency,
      },
      party: customer
        ? {
            id: customer.id,
            name: customer.name,
            companyName: customer.companyName,
            taxNumber: customer.taxNumber,
            address: customer.address,
            phone: customer.phone,
            email: customer.email,
          }
        : null,
      currency: statement.currency,
      subtotal: statement.totalDebits,
      discountTotal: 0,
      taxTotal: 0,
      total: statement.closingBalance,
      amountPaid: statement.totalCredits,
      balanceDue: statement.closingBalance,
      status: 'active',
      items,
      statementData: statement,
      accentColor: settings.templates.accentColor,
    }
  }

  /**
   * Render Supplier Statement document data.
   */
  static async getSupplierStatementData(businessId: string, supplierId: string, fromDate?: Date, toDate?: Date): Promise<DocumentTemplateData> {
    const fromStr = (fromDate || new Date(new Date().getFullYear(), 0, 1)).toISOString().split('T')[0]
    const toStr = (toDate || new Date()).toISOString().split('T')[0]

    const statement = await StatementService.getSupplierStatement(businessId, supplierId, fromStr, toStr)
    const settings = await SettingsService.getBusinessSettings(businessId)

    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, businessId } })

    const items: DocumentLineItem[] = statement.lines.map((tx: any, idx: number) => ({
      id: `${tx.type}-${idx}`,
      name: tx.reference || tx.type,
      description: tx.description || `${tx.type.toUpperCase()} on ${tx.date}`,
      quantity: 1,
      unitPrice: tx.debit > 0 ? tx.debit : tx.credit,
      total: tx.balance,
    }))

    return {
      type: 'supplier_statement',
      documentNumber: `STMT-SUP-${supplierId.slice(0, 8).toUpperCase()}`,
      reference: `Period: ${statement.startDate} to ${statement.endDate}`,
      date: new Date().toISOString().split('T')[0],
      status: 'active',
      items,
      company: {
        name: settings.company.name,
        legalName: settings.company.legalName,
        taxNumber: settings.company.taxNumber,
        registrationNumber: settings.company.registrationNumber,
        address: settings.company.address,
        phone: settings.company.phone,
        email: settings.company.email,
        website: settings.company.website,
        logoUrl: settings.company.logoUrl,
        currency: statement.currency,
      },
      party: supplier
        ? {
            id: supplier.id,
            name: supplier.name,
            companyName: supplier.companyName,
            taxNumber: supplier.taxNumber,
            address: supplier.address,
            phone: supplier.phone,
            email: supplier.email,
          }
        : null,
      currency: statement.currency,
      subtotal: statement.totalCredits,
      discountTotal: 0,
      taxTotal: 0,
      total: statement.closingBalance,
      amountPaid: statement.totalDebits,
      balanceDue: statement.closingBalance,
      statementData: statement,
      accentColor: settings.templates.accentColor,
    }
  }

  /**
   * Render Quotation document data.
   */
  static async getQuotationData(businessId: string, quotationId: string): Promise<DocumentTemplateData> {
    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, businessId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    })
    if (!quotation) throw new Error(`Quotation ${quotationId} not found in business ${businessId}`)

    const settings = await SettingsService.getBusinessSettings(businessId)

    const items: DocumentLineItem[] = (quotation.items as any[]).map((item: any) => ({
      id: item.id,
      name: item.product?.name || item.description || 'Custom Item',
      sku: item.product?.code || null,
      description: item.description || null,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discountRate: Number(item.discount || 0),
      discountAmount: 0,
      taxRate: Number(item.taxRate || 0),
      taxAmount: Number(item.taxAmount || 0),
      total: Number(item.lineTotal),
    }))

    return {
      type: 'sales_invoice' as any,
      documentNumber: quotation.quotationNumber,
      reference: null,
      date: quotation.quotationDate.toISOString().split('T')[0],
      dueDate: quotation.validUntil ? quotation.validUntil.toISOString().split('T')[0] : null,
      company: {
        name: settings.company.name,
        legalName: settings.company.legalName,
        taxNumber: settings.company.taxNumber,
        registrationNumber: settings.company.registrationNumber,
        address: settings.company.address,
        phone: settings.company.phone,
        email: settings.company.email,
        website: settings.company.website,
        logoUrl: settings.company.logoUrl,
        currency: quotation.currency,
      },
      party: quotation.customer
        ? {
            id: quotation.customer.id,
            name: quotation.customer.name,
            companyName: quotation.customer.companyName,
            taxNumber: quotation.customer.taxNumber,
            address: quotation.customer.address,
            phone: quotation.customer.phone,
            email: quotation.customer.email,
          }
        : null,
      currency: quotation.currency,
      subtotal: Number(quotation.subtotal),
      discountTotal: Number(quotation.discountTotal || 0),
      taxTotal: Number(quotation.taxTotal || 0),
      total: Number(quotation.grandTotal),
      amountPaid: 0,
      balanceDue: Number(quotation.grandTotal),
      status: quotation.status,
      notes: quotation.notes,
      terms: quotation.terms || settings.templates.termsAndConditions,
      items,
      bankDetails: settings.templates.bankDetailsText,
      accentColor: settings.templates.accentColor,
    }
  }

  /**
   * Render Delivery Note document data.
   */
  static async getDeliveryNoteData(businessId: string, deliveryNoteId: string): Promise<DocumentTemplateData> {
    const delivery = await prisma.deliveryNote.findFirst({
      where: { id: deliveryNoteId, businessId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    })
    if (!delivery) throw new Error(`Delivery Note ${deliveryNoteId} not found in business ${businessId}`)

    const settings = await SettingsService.getBusinessSettings(businessId)

    const items: DocumentLineItem[] = (delivery.items as any[]).map((item: any) => ({
      id: item.id,
      name: item.product?.name || 'Item',
      sku: item.product?.code || null,
      description: item.notes || null,
      quantity: Number(item.deliveredQuantity),
      unitPrice: 0,
      total: 0,
    }))

    return {
      type: 'sales_invoice' as any,
      documentNumber: delivery.deliveryNumber,
      reference: delivery.trackingNumber,
      date: delivery.deliveryDate.toISOString().split('T')[0],
      company: {
        name: settings.company.name,
        legalName: settings.company.legalName,
        taxNumber: settings.company.taxNumber,
        registrationNumber: settings.company.registrationNumber,
        address: settings.company.address,
        phone: settings.company.phone,
        email: settings.company.email,
        website: settings.company.website,
        logoUrl: settings.company.logoUrl,
        currency: 'USD',
      },
      party: delivery.customer
        ? {
            id: delivery.customer.id,
            name: delivery.customer.name,
            companyName: delivery.customer.companyName,
            taxNumber: delivery.customer.taxNumber,
            address: delivery.customer.address,
            phone: delivery.customer.phone,
            email: delivery.customer.email,
          }
        : null,
      currency: 'USD',
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
      amountPaid: 0,
      balanceDue: 0,
      status: delivery.status,
      notes: delivery.notes,
      items,
      accentColor: settings.templates.accentColor,
    }
  }
}
