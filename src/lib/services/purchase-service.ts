// =============================================================
// Purchase Invoice Posting Engine & Inventory Procurement Workflow
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { postPurchaseInvoiceSchema, PostPurchaseInvoiceInput } from '@/lib/validations/accounting-schemas'
import { TenantAccessDeniedError, AccountingError } from '@/lib/errors/accounting-error'
import { InventoryService } from './inventory-service'
import { AccountingService } from './accounting-service'
import { DocumentNumberingService } from './document-numbering-service'

export class PurchaseService {
  /**
   * Post a Purchase Invoice atomically:
   * 1. Validate supplier & products
   * 2. Recalculate Weighted Average Costing (WAC) & update inventory stock
   * 3. Record Inventory Movements ('purchase')
   * 4. Generate & Post Accounting Journal Entry (Inventory, Input VAT, AP)
   */
  static async postPurchaseInvoice(input: PostPurchaseInvoiceInput) {
    const validated = postPurchaseInvoiceSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const {
        businessId,
        supplierId,
        purchaseOrderId,
        purchaseNumber,
        referenceNumber,
        purchaseDate,
        dueDate,
        currencyCode,
        exchangeRate,
        warehouseId,
        notes,
        lines,
        userId,
      } = validated

      const rate = new Decimal(exchangeRate)

      // 1. Verify Supplier & Tenant
      const supplier = await tx.supplier.findFirst({
        where: { id: supplierId, businessId },
      })
      if (!supplier) throw new TenantAccessDeniedError('Supplier')

      // 2. Process Line Items
      let subtotal = new Decimal(0)
      let taxAmountTotal = new Decimal(0)

      const processedItems = []
      const stockMovementItems = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const qty = new Decimal(line.quantity)
        const unitPrice = new Decimal(line.unitPrice)
        const taxPct = new Decimal(line.taxRatePercent || 0)

        const netLineSubtotal = qty.mul(unitPrice)
        const lineTax = netLineSubtotal.mul(taxPct).div(100)
        const lineTotal = netLineSubtotal.plus(lineTax)

        subtotal = subtotal.plus(netLineSubtotal)
        taxAmountTotal = taxAmountTotal.plus(lineTax)

        if (line.productId) {
          const productObj = await tx.product.findFirst({
            where: { id: line.productId, businessId },
          })
          if (!productObj) throw new TenantAccessDeniedError(`Product ID ${line.productId}`)

          if (productObj.trackInventory && productObj.productType === 'physical') {
            const targetWarehouseId = line.warehouseId || warehouseId
            if (!targetWarehouseId) {
              throw new AccountingError(`Warehouse is required for physical product ${productObj.name}`)
            }

            // Recalculate WAC and update inventory balance
            await InventoryService.recalculateWAC(
              businessId,
              productObj.id,
              targetWarehouseId,
              qty,
              unitPrice,
              tx
            )

            stockMovementItems.push({
              productId: productObj.id,
              warehouseId: targetWarehouseId,
              quantity: qty,
              unitCost: unitPrice,
              totalCost: netLineSubtotal,
            })
          }
        }

        processedItems.push({
          productId: line.productId,
          warehouseId: line.warehouseId || warehouseId,
          description: line.description,
          quantity: qty,
          unitPrice,
          taxRate: taxPct,
          taxAmount: lineTax,
          lineTotal,
          lineOrder: i + 1,
        })
      }

      const totalAmount = subtotal.plus(taxAmountTotal)
      const baseSubtotal = subtotal.mul(rate)
      const baseTaxAmount = taxAmountTotal.mul(rate)
      const baseTotalAmount = totalAmount.mul(rate)

      // 3. Create Purchase (Invoice)
      const purchase = await tx.purchase.create({
        data: {
          businessId,
          supplierId,
          purchaseOrderId,
          purchaseNumber,
          referenceNumber,
          purchaseDate,
          dueDate,
          status: 'received',
          currencyCode,
          exchangeRate: rate,
          subtotal,
          discountAmount: new Decimal(0),
          taxAmount: taxAmountTotal,
          totalAmount,
          paidAmount: new Decimal(0),
          balanceDue: totalAmount,
          baseSubtotal,
          baseTaxAmount,
          baseTotalAmount,
          notes,
          postedAt: new Date(),
          postedBy: userId,
          createdBy: userId,
          items: {
            create: processedItems,
          },
        },
        include: { items: true },
      })

      // Update Supplier cached balance
      if (supplierId) {
        const supplier = await tx.supplier.findFirst({ where: { id: supplierId, businessId } })
        if (supplier) {
          await tx.supplier.update({
            where: { id: supplierId },
            data: { balance: new Decimal(supplier.balance).plus(totalAmount) },
          })
        }
      }

      // 4. Record Inventory Movements
      for (const item of stockMovementItems) {
        await tx.inventoryMovement.create({
          data: {
            businessId,
            productId: item.productId,
            warehouseId: item.warehouseId,
            movementType: 'purchase',
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.totalCost,
            referenceType: 'purchase',
            referenceId: purchase.id,
            createdBy: userId,
          },
        })
      }

      // 5. Generate & Post Accounting Journal Entry
      const apAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '2100' } }) // Accounts Payable
      const invAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '1400' } }) // Merchandise Inventory
      const vatAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '2210' } }) ||
                        await tx.chartOfAccount.findFirst({ where: { businessId, code: '2200' } }) // Input VAT

      if (!apAccount || !invAccount) {
        throw new AccountingError('System Chart of Accounts (2100 AP, 1400 Inventory) must exist.')
      }

      const journalLines: any[] = [
        {
          accountId: invAccount.id,
          description: `Inventory Receipt for Purchase ${purchase.purchaseNumber}`,
          debitAmount: subtotal.toNumber(),
          creditAmount: 0,
        },
      ]

      if (taxAmountTotal.gt(0) && vatAccount) {
        journalLines.push({
          accountId: vatAccount.id,
          description: `Input VAT on Purchase ${purchase.purchaseNumber}`,
          debitAmount: taxAmountTotal.toNumber(),
          creditAmount: 0,
        })
      }

      journalLines.push({
        accountId: apAccount.id,
        description: `Accounts Payable to ${supplier.name} for Purchase ${purchase.purchaseNumber}`,
        debitAmount: 0,
        creditAmount: totalAmount.toNumber(),
        supplierId,
      })

      // Use DocumentNumberingService for atomic, sequential, unique journal entry numbers.
      const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry', tx)

      const journalEntry = await AccountingService.postJournalEntry({
        businessId,
        entryNumber: jeNumber,
        entryDate: purchaseDate,
        description: `Automated Journal Entry for Purchase Invoice ${purchase.purchaseNumber}`,
        currencyCode,
        exchangeRate: rate.toNumber(),
        reference: purchase.purchaseNumber,
        sourceType: 'purchase',
        sourceId: purchase.id,
        lines: journalLines,
        userId,
      }, tx)

      return { purchase, journalEntry }
    })
  }
}
