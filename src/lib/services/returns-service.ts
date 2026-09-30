// =============================================================
// Returns Service — Customer Sales & Supplier Purchase Returns
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  createSalesReturnSchema,
  CreateSalesReturnInput,
  createPurchaseReturnSchema,
  CreatePurchaseReturnInput,
} from '@/lib/validations/commercial-schemas'
import { DocumentNumberingService } from './document-numbering-service'
import { InventoryService } from './inventory-service'
import { AccountingService } from './accounting-service'
import { AuditService } from './audit-service'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'

export class ReturnsService {
  // =============================================================
  // 1. CUSTOMER SALES RETURNS
  // =============================================================

  /**
   * Create a Sales Return from a customer (draft status).
   */
  static async createSalesReturn(input: CreateSalesReturnInput) {
    const validated = createSalesReturnSchema.parse(input)
    const { businessId, saleId, customerId, warehouseId, returnDate, reason, lines, userId } = validated

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
    })
    if (!customer) throw new TenantAccessDeniedError('Customer')

    const returnNumber =
      validated.returnNumber ||
      (await DocumentNumberingService.generateNumber(businessId, 'sales_return'))

    let subtotal = new Decimal(0)
    let taxTotal = new Decimal(0)

    const returnItems = lines.map((line) => {
      const qty = new Decimal(line.quantity)
      const price = new Decimal(line.unitPrice)
      const taxRatePct = new Decimal(line.taxRate || 0)

      const lineBase = qty.mul(price)
      const lineTax = lineBase.mul(taxRatePct.div(100))
      const lineTotal = lineBase.plus(lineTax)

      subtotal = subtotal.plus(lineBase)
      taxTotal = taxTotal.plus(lineTax)

      return {
        saleItemId: line.saleItemId || null,
        productId: line.productId,
        warehouseId: line.warehouseId || warehouseId || null,
        quantity: qty,
        unitPrice: price,
        taxRate: taxRatePct,
        taxAmount: lineTax,
        totalAmount: lineTotal,
      }
    })

    const totalAmount = subtotal.plus(taxTotal)

    const salesReturn = await prisma.salesReturn.create({
      data: {
        businessId,
        saleId: saleId || null,
        customerId,
        warehouseId: warehouseId || null,
        returnNumber,
        returnDate,
        reason: reason || null,
        status: 'draft',
        subtotal,
        taxTotal,
        totalAmount,
        createdBy: userId,
        items: {
          create: returnItems,
        },
      },
      include: {
        items: { include: { product: true } },
        customer: true,
        warehouse: true,
      },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'sales_return',
      entityId: salesReturn.id,
      action: 'create',
      changes: { returnNumber, totalAmount: totalAmount.toNumber(), customerId },
    })

    return salesReturn
  }

  /**
   * Confirm/Complete Sales Return:
   * 1. Returns stock to warehouse via InventoryService.recalculateWAC.
   * 2. Automatically creates and posts a Customer Credit Note.
   * 3. Generates the appropriate GL adjustment entries.
   */
  static async confirmSalesReturn(businessId: string, returnId: string, userId: string) {
    const salesReturn = await prisma.salesReturn.findFirst({
      where: { id: returnId, businessId },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
    })
    if (!salesReturn) throw new TenantAccessDeniedError('Sales Return')

    if (salesReturn.status === 'completed' || salesReturn.status === 'approved') {
      return salesReturn
    }

    // Inherit currency/rate from the original sale if linked; fall back to USD
    let returnCurrency = 'USD'
    let returnRate = new Decimal(1)
    if (salesReturn.saleId) {
      const originalSale = await prisma.sale.findUnique({
        where: { id: salesReturn.saleId },
        select: { currencyCode: true, exchangeRate: true },
      })
      if (originalSale) {
        returnCurrency = originalSale.currencyCode
        returnRate = new Decimal(originalSale.exchangeRate)
      }
    }

    let defaultWarehouseId: string | null = salesReturn.warehouseId || null
    if (!defaultWarehouseId) {
      const defWh = await prisma.warehouse.findFirst({
        where: { businessId, isDefault: true, isActive: true },
      })
      defaultWarehouseId = defWh?.id || null
    }

    return prisma.$transaction(async (tx) => {
      // 1. Return stock to warehouse
      for (const item of salesReturn.items) {
        const whId = item.warehouseId || defaultWarehouseId
        if (!whId) {
          throw new ValidationError(`Warehouse required for returning item ${item.product.name}`)
        }

        const qty = new Decimal(item.quantity)
        const costPrice = new Decimal(item.product.costPrice || item.unitPrice)

        await InventoryService.recalculateWAC(
          businessId,
          item.productId,
          whId,
          qty,
          costPrice,
          tx
        )

        // Record Inventory Movement
        await tx.inventoryMovement.create({
          data: {
            businessId,
            productId: item.productId,
            warehouseId: whId,
            movementType: 'sales_return',
            quantity: qty,
            unitCost: costPrice,
            totalCost: qty.mul(costPrice),
            referenceType: 'sales_return',
            referenceId: salesReturn.id,
            createdBy: userId,
          },
        })
      }

      // 2. Create linked Credit Note for financial adjustment
      const creditNoteNumber = await DocumentNumberingService.generateNumber(businessId, 'credit_note', tx)

      const creditNote = await tx.creditDebitNote.create({
        data: {
          businessId,
          type: 'credit_note',
          noteNumber: creditNoteNumber,
          noteDate: salesReturn.returnDate,
          customerId: salesReturn.customerId,
          relatedSaleId: salesReturn.saleId,
          reason: salesReturn.reason || `Sales Return ${salesReturn.returnNumber}`,
          subtotal: salesReturn.subtotal,
          taxTotal: salesReturn.taxTotal,
          totalAmount: salesReturn.totalAmount,
          remainingAmount: salesReturn.totalAmount,
          status: 'posted',
          createdBy: userId,
          items: {
            create: salesReturn.items.map((i) => ({
              productId: i.productId,
              description: `Sales Return: ${i.product.name}`,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              taxRate: i.taxRate,
              taxAmount: i.taxAmount,
              totalAmount: i.totalAmount,
            })),
          },
        },
      })

      // 3. Post General Ledger adjustment entry (Debit Sales Returns / Revenue Reduction, Credit AR)
      // IMPORTANT: Use the same AR account code (1300) that sales invoices post to — NOT 1200.
      // Also look up the Sales Revenue account that matches the original posting (4100).
      const arAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '1300' } })
        ?? await tx.chartOfAccount.findFirst({
          where: { businessId, OR: [{ name: { contains: 'Receivable', mode: 'insensitive' } }, { type: 'asset' }] },
          orderBy: { code: 'asc' },
        })
      const salesAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '4100' } })
        ?? await tx.chartOfAccount.findFirst({
          where: { businessId, OR: [{ code: '4000' }, { name: { contains: 'Revenue', mode: 'insensitive' } }] },
          orderBy: { code: 'asc' },
        })
      const taxAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '2200' } }) // Tax Payable

      let journalEntryId: string | null = null

      if (arAccount && salesAccount) {
        const lines: any[] = [
          {
            accountId: salesAccount.id,
            description: `Sales Return Revenue Reversal - ${salesReturn.returnNumber}`,
            debitAmount: Number(salesReturn.subtotal),
            creditAmount: 0,
            customerId: salesReturn.customerId || undefined,
          },
        ]

        if (salesReturn.taxTotal.gt(0) && taxAccount) {
          lines.push({
            accountId: taxAccount.id,
            description: `Sales Return Tax Reversal - ${salesReturn.returnNumber}`,
            debitAmount: Number(salesReturn.taxTotal),
            creditAmount: 0,
            customerId: salesReturn.customerId || undefined,
          })
        }

        lines.push({
          accountId: arAccount.id,
          description: `Credit Note / AR Reduction - ${creditNoteNumber}`,
          debitAmount: 0,
          creditAmount: Number(salesReturn.totalAmount),
          customerId: salesReturn.customerId || undefined,
        })

        const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry', tx)
        const je = await AccountingService.postJournalEntry(
          {
            businessId,
            entryNumber: jeNumber,
            entryDate: salesReturn.returnDate,
            description: `Customer Sales Return Adjustment: ${salesReturn.returnNumber}`,
            currencyCode: returnCurrency,
            exchangeRate: returnRate.toNumber(),
            sourceType: 'sale',
            sourceId: creditNote.id,
            lines,
            userId,
          },
          tx
        )
        journalEntryId = je.id

        await tx.creditDebitNote.update({
          where: { id: creditNote.id },
          data: { journalEntryId },
        })
      }

      // 4. Update Sales Return with completed status and linked records
      const completedReturn = await tx.salesReturn.update({
        where: { id: returnId },
        data: {
          status: 'completed',
          creditNoteId: creditNote.id,
          journalEntryId,
          updatedBy: userId,
        },
        include: {
          items: { include: { product: true } },
          customer: true,
          warehouse: true,
        },
      })

      // Update customer balance
      if (salesReturn.customerId) {
        await tx.customer.update({
          where: { id: salesReturn.customerId },
          data: {
            balance: { decrement: salesReturn.totalAmount },
          },
        })
      }

      await AuditService.log(
        {
          businessId,
          userId,
          entityType: 'sales_return',
          entityId: returnId,
          action: 'complete',
          changes: { status: 'completed', creditNoteId: creditNote.id, journalEntryId },
        },
        tx
      )

      return completedReturn
    }, { maxWait: 15000, timeout: 30000 })
  }

  // =============================================================
  // 2. SUPPLIER PURCHASE RETURNS
  // =============================================================

  /**
   * Create a Purchase Return to a supplier (draft status).
   */
  static async createPurchaseReturn(input: CreatePurchaseReturnInput) {
    const validated = createPurchaseReturnSchema.parse(input)
    const { businessId, purchaseId, supplierId, warehouseId, returnDate, reason, lines, userId } = validated

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId, deletedAt: null },
    })
    if (!supplier) throw new TenantAccessDeniedError('Supplier')

    const returnNumber =
      validated.returnNumber ||
      (await DocumentNumberingService.generateNumber(businessId, 'purchase_return'))

    let subtotal = new Decimal(0)
    let taxTotal = new Decimal(0)

    const returnItems = lines.map((line) => {
      const qty = new Decimal(line.quantity)
      const cost = new Decimal(line.unitCost)
      const taxRatePct = new Decimal(line.taxRate || 0)

      const lineBase = qty.mul(cost)
      const lineTax = lineBase.mul(taxRatePct.div(100))
      const lineTotal = lineBase.plus(lineTax)

      subtotal = subtotal.plus(lineBase)
      taxTotal = taxTotal.plus(lineTax)

      return {
        purchaseItemId: line.purchaseItemId || null,
        productId: line.productId,
        warehouseId: line.warehouseId || warehouseId || null,
        quantity: qty,
        unitCost: cost,
        taxRate: taxRatePct,
        taxAmount: lineTax,
        totalAmount: lineTotal,
      }
    })

    const totalAmount = subtotal.plus(taxTotal)

    const purchaseReturn = await prisma.purchaseReturn.create({
      data: {
        businessId,
        purchaseId: purchaseId || null,
        supplierId,
        warehouseId: warehouseId || null,
        returnNumber,
        returnDate,
        reason: reason || null,
        status: 'draft',
        subtotal,
        taxTotal,
        totalAmount,
        createdBy: userId,
        items: {
          create: returnItems,
        },
      },
      include: {
        items: { include: { product: true } },
        supplier: true,
        warehouse: true,
      },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'purchase_return',
      entityId: purchaseReturn.id,
      action: 'create',
      changes: { returnNumber, totalAmount: totalAmount.toNumber(), supplierId },
    })

    return purchaseReturn
  }

  /**
   * Confirm/Complete Purchase Return:
   * 1. Issues stock out of warehouse using InventoryService.issueStock.
   * 2. Automatically creates and posts a Supplier Debit Note.
   * 3. Generates GL adjustment entries (Debit AP, Credit Inventory/Purchase).
   */
  static async confirmPurchaseReturn(businessId: string, returnId: string, userId: string) {
    const purchaseReturn = await prisma.purchaseReturn.findFirst({
      where: { id: returnId, businessId },
      include: {
        items: { include: { product: true } },
        supplier: true,
      },
    })
    if (!purchaseReturn) throw new TenantAccessDeniedError('Purchase Return')

    if (purchaseReturn.status === 'completed' || purchaseReturn.status === 'approved') {
      return purchaseReturn
    }

    // Inherit currency/rate from the original purchase if linked; fall back to USD
    let returnCurrency = 'USD'
    let returnRate = new Decimal(1)
    if ((purchaseReturn as any).purchaseId) {
      const originalPurchase = await prisma.purchase.findUnique({
        where: { id: (purchaseReturn as any).purchaseId },
        select: { currencyCode: true, exchangeRate: true },
      })
      if (originalPurchase) {
        returnCurrency = originalPurchase.currencyCode
        returnRate = new Decimal(originalPurchase.exchangeRate)
      }
    }

    let defaultWarehouseId: string | null = purchaseReturn.warehouseId || null
    if (!defaultWarehouseId) {
      const defWh = await prisma.warehouse.findFirst({
        where: { businessId, isDefault: true, isActive: true },
      })
      defaultWarehouseId = defWh?.id || null
    }

    return prisma.$transaction(async (tx) => {
      // 1. Issue stock from warehouse
      for (const item of purchaseReturn.items) {
        const whId = item.warehouseId || defaultWarehouseId
        if (!whId) {
          throw new ValidationError(`Warehouse required for returning item ${item.product.name}`)
        }

        const qty = new Decimal(item.quantity)
        const { currentAvgCost } = await InventoryService.issueStock(
          businessId,
          item.productId,
          whId,
          qty,
          tx
        )

        // Record Inventory Movement
        await tx.inventoryMovement.create({
          data: {
            businessId,
            productId: item.productId,
            warehouseId: whId,
            movementType: 'purchase_return',
            quantity: qty.negated(),
            unitCost: currentAvgCost,
            totalCost: qty.mul(currentAvgCost),
            referenceType: 'purchase_return',
            referenceId: purchaseReturn.id,
            createdBy: userId,
          },
        })
      }

      // 2. Create linked Debit Note for supplier financial adjustment
      const debitNoteNumber = await DocumentNumberingService.generateNumber(businessId, 'debit_note', tx)

      const debitNote = await tx.creditDebitNote.create({
        data: {
          businessId,
          type: 'debit_note',
          noteNumber: debitNoteNumber,
          noteDate: purchaseReturn.returnDate,
          supplierId: purchaseReturn.supplierId,
          relatedPurchaseId: purchaseReturn.purchaseId,
          reason: purchaseReturn.reason || `Purchase Return ${purchaseReturn.returnNumber}`,
          subtotal: purchaseReturn.subtotal,
          taxTotal: purchaseReturn.taxTotal,
          totalAmount: purchaseReturn.totalAmount,
          remainingAmount: purchaseReturn.totalAmount,
          status: 'posted',
          createdBy: userId,
          items: {
            create: purchaseReturn.items.map((i) => ({
              productId: i.productId,
              description: `Purchase Return: ${i.product.name}`,
              quantity: i.quantity,
              unitPrice: i.unitCost,
              taxRate: i.taxRate,
              taxAmount: i.taxAmount,
              totalAmount: i.totalAmount,
            })),
          },
        },
      })

      // 3. Post General Ledger adjustment entry (Debit AP, Credit Inventory Asset 1400)
      // IMPORTANT: Use code 2100 for AP — the same code used in postPurchaseInvoice()
      const apAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '2100' } })
        ?? await tx.chartOfAccount.findFirst({
          where: { businessId, OR: [{ code: '2000' }, { name: { contains: 'Payable', mode: 'insensitive' } }] },
          orderBy: { code: 'asc' },
        })
      const invAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '1400' } }) // Inventory Asset

      let journalEntryId: string | null = null

      if (apAccount && invAccount) {
        const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry', tx)
        const je = await AccountingService.postJournalEntry(
          {
            businessId,
            entryNumber: jeNumber,
            entryDate: purchaseReturn.returnDate,
            description: `Supplier Purchase Return Adjustment: ${purchaseReturn.returnNumber}`,
            currencyCode: returnCurrency,
            exchangeRate: returnRate.toNumber(),
            sourceType: 'purchase',
            sourceId: debitNote.id,
            lines: [
              {
                accountId: apAccount.id,
                description: `Debit Note / AP Reduction - ${debitNoteNumber}`,
                debitAmount: Number(purchaseReturn.totalAmount),
                creditAmount: 0,
                supplierId: purchaseReturn.supplierId || undefined,
              },
              {
                accountId: invAccount.id,
                description: `Inventory Return - ${purchaseReturn.returnNumber}`,
                debitAmount: 0,
                creditAmount: Number(purchaseReturn.totalAmount),
                supplierId: purchaseReturn.supplierId || undefined,
              },
            ],
            userId,
          },
          tx
        )
        journalEntryId = je.id

        await tx.creditDebitNote.update({
          where: { id: debitNote.id },
          data: { journalEntryId },
        })
      }

      // 4. Update Purchase Return
      const completedReturn = await tx.purchaseReturn.update({
        where: { id: returnId },
        data: {
          status: 'completed',
          debitNoteId: debitNote.id,
          journalEntryId,
          updatedBy: userId,
        },
        include: {
          items: { include: { product: true } },
          supplier: true,
          warehouse: true,
        },
      })

      // Update supplier balance
      if (purchaseReturn.supplierId) {
        await tx.supplier.update({
          where: { id: purchaseReturn.supplierId },
          data: {
            balance: { decrement: purchaseReturn.totalAmount },
          },
        })
      }

      await AuditService.log(
        {
          businessId,
          userId,
          entityType: 'purchase_return',
          entityId: returnId,
          action: 'complete',
          changes: { status: 'completed', debitNoteId: debitNote.id, journalEntryId },
        },
        tx
      )

      return completedReturn
    }, { maxWait: 15000, timeout: 30000 })
  }

  /**
   * List returns (sales or purchase).
   */
  static async listSalesReturns(businessId: string, filter?: { customerId?: string; status?: string }) {
    return prisma.salesReturn.findMany({
      where: {
        businessId,
        ...(filter?.customerId ? { customerId: filter.customerId } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
      include: { customer: true, warehouse: true, items: { include: { product: true } } },
      orderBy: { returnDate: 'desc' },
    })
  }

  static async listPurchaseReturns(businessId: string, filter?: { supplierId?: string; status?: string }) {
    return prisma.purchaseReturn.findMany({
      where: {
        businessId,
        ...(filter?.supplierId ? { supplierId: filter.supplierId } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
      include: { supplier: true, warehouse: true, items: { include: { product: true } } },
      orderBy: { returnDate: 'desc' },
    })
  }
}
