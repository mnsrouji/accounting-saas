// =============================================================
// Document Numbering Service — Business-Scoped Sequential References
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'

export type DocumentType =
  | 'sales_invoice'
  | 'purchase_invoice'
  | 'payment'
  | 'expense'
  | 'journal_entry'
  | 'inventory_transfer'
  | 'inventory_adjustment'
  | 'stock_transfer'
  | 'stock_adjustment'
  | 'stock_count'
  | 'stock_reservation'
  | 'batch'
  | 'serial'
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
  | 'opportunity'
  | 'crm_task'
  | 'crm_activity'
  | 'payment_promise'
  | 'treasury_transfer'
  | 'bank_statement'
  | 'bank_reconciliation'
  | 'petty_cash_count'

const DEFAULT_PREFIX_MAP: Record<DocumentType, string> = {
  sales_invoice: 'INV',
  purchase_invoice: 'PURCH',
  payment: 'PAY',
  expense: 'EXP',
  journal_entry: 'JE',
  inventory_transfer: 'TRF',
  inventory_adjustment: 'ADJ',
  stock_transfer: 'TRF',
  stock_adjustment: 'ADJ',
  stock_count: 'STC',
  stock_reservation: 'RES',
  batch: 'LOT',
  serial: 'SN',
  quotation: 'QUO',
  sales_order: 'SO',
  delivery_note: 'DN',
  purchase_request: 'PR',
  purchase_order: 'PO',
  goods_receipt: 'GR',
  sales_return: 'SR',
  purchase_return: 'PRET',
  credit_note: 'CN',
  debit_note: 'DBN',
  opportunity: 'OPP',
  crm_task: 'TSK',
  crm_activity: 'ACT',
  payment_promise: 'PRM',
  treasury_transfer: 'TTR',
  bank_statement: 'STM',
  bank_reconciliation: 'REC',
  petty_cash_count: 'PCC',
}

export interface NumberingConfig {
  prefix: string
  format: string // e.g. "{PREFIX}-{YYYY}-{SEQ}" or "{PREFIX}/{YYYY}/{SEQ}" or "{PREFIX}-{SEQ}"
  startingNumber: number
  paddingLength: number
  includeYear: boolean
}

export class DocumentNumberingService {
  /**
   * Generate a unique sequential document number for a business based on its configuration.
   * Format: Customizable (default: PREFIX-YYYY-XXXX)
   */
  static async generateNumber(businessId: string, type: DocumentType, tx?: any): Promise<string> {
    const client = tx ?? prisma
    const config = await this.getConfig(businessId, type, client)
    const year = new Date().getFullYear().toString()
    const prefix = config.prefix || DEFAULT_PREFIX_MAP[type] || 'DOC'
    const padding = config.paddingLength || 4

    let count = 0

    switch (type) {
      case 'sales_invoice':
        count = await client.sale.count({ where: { businessId } })
        break
      case 'purchase_invoice':
        count = await client.purchase.count({ where: { businessId } })
        break
      case 'payment':
        count = await client.payment.count({ where: { businessId } })
        break
      case 'expense':
        count = await client.expense.count({ where: { businessId } })
        break
      case 'journal_entry':
        count = await client.journalEntry.count({ where: { businessId } })
        break
      case 'inventory_transfer':
      case 'inventory_adjustment':
        count = await client.inventoryMovement.count({ where: { businessId } })
        break
      case 'stock_transfer':
        count = await client.stockTransfer.count({ where: { businessId } })
        break
      case 'stock_adjustment':
        count = await client.stockAdjustment.count({ where: { businessId } })
        break
      case 'stock_count':
        count = await client.stockCount.count({ where: { businessId } })
        break
      case 'stock_reservation':
        count = await client.stockReservation.count({ where: { businessId } })
        break
      case 'batch':
        count = await client.productBatch.count({ where: { businessId } })
        break
      case 'serial':
        count = await client.productSerialNumber.count({ where: { businessId } })
        break
      case 'quotation':
        count = await client.quotation.count({ where: { businessId } })
        break
      case 'sales_order':
        count = await client.salesOrder.count({ where: { businessId } })
        break
      case 'delivery_note':
        count = await client.deliveryNote.count({ where: { businessId } })
        break
      case 'purchase_request':
        count = await client.purchaseRequest.count({ where: { businessId } })
        break
      case 'purchase_order':
        count = await client.purchaseOrder.count({ where: { businessId } })
        break
      case 'goods_receipt':
        count = await client.goodsReceipt.count({ where: { businessId } })
        break
      case 'sales_return':
        count = await client.salesReturn.count({ where: { businessId } })
        break
      case 'purchase_return':
        count = await client.purchaseReturn.count({ where: { businessId } })
        break
      case 'credit_note':
        count = await client.creditDebitNote.count({ where: { businessId, type: 'credit_note' } })
        break
      case 'debit_note':
        count = await client.creditDebitNote.count({ where: { businessId, type: 'debit_note' } })
        break
      default:
        count = Math.floor(Math.random() * 9000) + 1000
    }

    const startNum = config.startingNumber || 1
    let seq = Math.max(count + 1, startNum)
    let num = this.formatNumber(config.format, prefix, year, seq, padding, config.includeYear)

    // Ensure uniqueness within business
    let exists = await this.checkExists(businessId, type, num, client)
    while (exists) {
      seq += 1
      num = this.formatNumber(config.format, prefix, year, seq, padding, config.includeYear)
      exists = await this.checkExists(businessId, type, num, client)
    }

    return num
  }

  /**
   * Format document number from pattern.
   */
  static formatNumber(
    pattern: string,
    prefix: string,
    year: string,
    seq: number,
    padding: number,
    includeYear = true
  ): string {
    const paddedSeq = seq.toString().padStart(padding, '0')
    let formatted = pattern || '{PREFIX}-{YYYY}-{SEQ}'

    formatted = formatted.replace('{PREFIX}', prefix)
    formatted = formatted.replace('{SEQ}', paddedSeq)

    if (includeYear) {
      formatted = formatted.replace('{YYYY}', year)
      formatted = formatted.replace('{YY}', year.slice(-2))
    } else {
      // Remove year token and double dashes/slashes if any
      formatted = formatted.replace(/-?\{YYYY\}-?/g, '-').replace(/\/?\{YYYY\}\/?/g, '/')
      formatted = formatted.replace(/--+/g, '-').replace(/\/\/+/g, '/')
      formatted = formatted.replace(/^-|-$/g, '').replace(/^\/|\/$/g, '')
    }

    return formatted
  }

  /**
   * Retrieve numbering configuration for a business & document type.
   */
  static async getConfig(businessId: string, type: DocumentType, tx?: any): Promise<NumberingConfig> {
    const client = tx ?? prisma
    const defaultConf: NumberingConfig = {
      prefix: DEFAULT_PREFIX_MAP[type] || 'DOC',
      format: '{PREFIX}-{YYYY}-{SEQ}',
      startingNumber: 1,
      paddingLength: 4,
      includeYear: true,
    }

    try {
      const business = await client.business.findUnique({
        where: { id: businessId },
        select: { taxConfig: true },
      })

      const conf = (business?.taxConfig as Record<string, any>)?.numbering?.[type]
      if (conf) {
        return {
          prefix: conf.prefix ?? defaultConf.prefix,
          format: conf.format ?? defaultConf.format,
          startingNumber: Number(conf.startingNumber) || defaultConf.startingNumber,
          paddingLength: Number(conf.paddingLength) || defaultConf.paddingLength,
          includeYear: conf.includeYear ?? defaultConf.includeYear,
        }
      }
    } catch {
      // Return default
    }

    return defaultConf
  }

  private static async checkExists(businessId: string, type: DocumentType, num: string, tx?: any): Promise<boolean> {
    const client = tx ?? prisma
    switch (type) {
      case 'sales_invoice':
        return !!(await client.sale.findFirst({ where: { businessId, invoiceNumber: num } }))
      case 'purchase_invoice':
        return !!(await client.purchase.findFirst({ where: { businessId, purchaseNumber: num } }))
      case 'payment':
        return !!(await client.payment.findFirst({ where: { businessId, paymentNumber: num } }))
      case 'expense':
        return !!(await client.expense.findFirst({ where: { businessId, expenseNumber: num } }))
      case 'journal_entry':
        return !!(await client.journalEntry.findFirst({ where: { businessId, entryNumber: num } }))
      case 'quotation':
        return !!(await client.quotation.findFirst({ where: { businessId, quotationNumber: num } }))
      case 'sales_order':
        return !!(await client.salesOrder.findFirst({ where: { businessId, orderNumber: num } }))
      case 'delivery_note':
        return !!(await client.deliveryNote.findFirst({ where: { businessId, deliveryNumber: num } }))
      case 'purchase_request':
        return !!(await client.purchaseRequest.findFirst({ where: { businessId, requestNumber: num } }))
      case 'purchase_order':
        return !!(await client.purchaseOrder.findFirst({ where: { businessId, orderNumber: num } }))
      case 'goods_receipt':
        return !!(await client.goodsReceipt.findFirst({ where: { businessId, receiptNumber: num } }))
      case 'sales_return':
        return !!(await client.salesReturn.findFirst({ where: { businessId, returnNumber: num } }))
      case 'purchase_return':
        return !!(await client.purchaseReturn.findFirst({ where: { businessId, returnNumber: num } }))
      case 'credit_note':
      case 'debit_note':
        return !!(await client.creditDebitNote.findFirst({ where: { businessId, noteNumber: num } }))
      case 'stock_transfer':
        return !!(await client.stockTransfer.findFirst({ where: { businessId, transferNumber: num } }))
      case 'stock_adjustment':
        return !!(await client.stockAdjustment.findFirst({ where: { businessId, adjustmentNumber: num } }))
      case 'stock_count':
        return !!(await client.stockCount.findFirst({ where: { businessId, countNumber: num } }))
      case 'batch':
        return !!(await client.productBatch.findFirst({ where: { businessId, lotNumber: num } }))
      case 'serial':
        return !!(await client.productSerialNumber.findFirst({ where: { businessId, serialNumber: num } }))
      default:
        return false
    }
  }
}
