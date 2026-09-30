// =============================================================
// Sales Invoice Posting Engine & Revenue Workflow
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { postSalesInvoiceSchema, PostSalesInvoiceInput } from '@/lib/validations/accounting-schemas'
import { TenantAccessDeniedError, AccountingError } from '@/lib/errors/accounting-error'
import { InventoryService } from './inventory-service'
import { AccountingService } from './accounting-service'
import { DocumentNumberingService } from './document-numbering-service'
import { UsageService } from './usage-service'

export class SalesService {
  /**
   * Post a Sales Invoice atomically:
   * 1. Validate customer & products
   * 2. Calculate totals, tax, discounts, and base amounts (freeze exchange rate)
   * 3. Issue stock & generate Inventory Movements (for physical goods)
   * 4. Auto-generate & post balanced Accounting Journal Entry (AR, Revenue, Tax, COGS, Inventory)
   */
  static async postSalesInvoice(input: PostSalesInvoiceInput) {
    const validated = postSalesInvoiceSchema.parse(input)

    // Check SaaS plan quota limit for monthly invoices
    await UsageService.assertQuota(validated.businessId, 'monthlyInvoices')

    return prisma.$transaction(async (tx) => {
      const {
        businessId,
        customerId,
        salesOrderId,
        invoiceNumber,
        invoiceDate,
        dueDate,
        currencyCode,
        exchangeRate,
        warehouseId,
        notes,
        terms,
        lines,
        userId,
      } = validated

      const rate = new Decimal(exchangeRate)

      // 1. Verify Customer & Tenant
      const customer = await tx.customer.findFirst({
        where: { id: customerId, businessId },
      })
      if (!customer) throw new TenantAccessDeniedError('Customer')

      // 2. Process Line Items & Costs
      let subtotal = new Decimal(0)
      let taxAmountTotal = new Decimal(0)
      let totalCogs = new Decimal(0)

      const processedItems = []
      const stockMovementItems = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const qty = new Decimal(line.quantity)
        const unitPrice = new Decimal(line.unitPrice)
        const discPct = new Decimal(line.discountPercent || 0)
        const taxPct = new Decimal(line.taxRatePercent || 0)

        const gross = qty.mul(unitPrice)
        const lineDiscount = gross.mul(discPct).div(100)
        const netLineSubtotal = gross.minus(lineDiscount)
        const lineTax = netLineSubtotal.mul(taxPct).div(100)
        const lineTotal = netLineSubtotal.plus(lineTax)

        subtotal = subtotal.plus(netLineSubtotal)
        taxAmountTotal = taxAmountTotal.plus(lineTax)

        let costBasis = new Decimal(0)
        let productObj = null

        if (line.productId) {
          productObj = await tx.product.findFirst({
            where: { id: line.productId, businessId },
          })
          if (!productObj) throw new TenantAccessDeniedError(`Product ID ${line.productId}`)

          if (productObj.trackInventory && productObj.productType === 'physical') {
            const targetWarehouseId = line.warehouseId || warehouseId
            if (!targetWarehouseId) {
              throw new AccountingError(`Warehouse is required for physical product ${productObj.name}`)
            }

            // Issue stock from warehouse
            const { currentAvgCost } = await InventoryService.issueStock(
              businessId,
              productObj.id,
              targetWarehouseId,
              qty,
              tx
            )

            costBasis = currentAvgCost
            const lineCogs = qty.mul(costBasis)
            totalCogs = totalCogs.plus(lineCogs)

            stockMovementItems.push({
              productId: productObj.id,
              warehouseId: targetWarehouseId,
              quantity: qty.negated(),
              unitCost: costBasis,
              totalCost: lineCogs,
            })
          }
        }

        processedItems.push({
          productId: line.productId,
          warehouseId: line.warehouseId || warehouseId,
          description: line.description,
          quantity: qty,
          unitPrice,
          costBasis,
          discount: discPct,
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

      // 3. Create Sale (Invoice)
      const sale = await tx.sale.create({
        data: {
          businessId,
          customerId,
          salesOrderId,
          invoiceNumber,
          invoiceDate,
          dueDate,
          status: 'sent', // Posted/Sent
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
          terms,
          postedAt: new Date(),
          postedBy: userId,
          createdBy: userId,
          items: {
            create: processedItems,
          },
        },
        include: { items: true },
      })

      // Update Customer cached balance
      if (customerId) {
        const customer = await tx.customer.findFirst({ where: { id: customerId, businessId } })
        if (customer) {
          await tx.customer.update({
            where: { id: customerId },
            data: { balance: new Decimal(customer.balance).plus(totalAmount) },
          })
        }
      }

      // 4. Create Inventory Movements
      for (const item of stockMovementItems) {
        await tx.inventoryMovement.create({
          data: {
            businessId,
            productId: item.productId,
            warehouseId: item.warehouseId,
            movementType: 'sale',
            quantity: item.quantity,
            unitCost: item.unitCost,
            totalCost: item.totalCost,
            referenceType: 'sale',
            referenceId: sale.id,
            createdBy: userId,
          },
        })
      }

      // 5. Generate & Post Accounting Journal Entry
      const arAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '1300' } }) // Accounts Receivable
      const revAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '4100' } }) // Sales Revenue
      const taxAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '2200' } }) // Sales Tax Payable
      const cogsAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '5100' } }) // COGS
      const invAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '1400' } }) // Inventory

      if (!arAccount || !revAccount) {
        throw new AccountingError('System Chart of Accounts (1300 AR, 4100 Revenue) must exist.')
      }

      const journalLines: any[] = [
        {
          accountId: arAccount.id,
          description: `Sales Invoice ${sale.invoiceNumber} - ${customer.name}`,
          debitAmount: totalAmount.toNumber(),
          creditAmount: 0,
          customerId,
        },
        {
          accountId: revAccount.id,
          description: `Revenue for Invoice ${sale.invoiceNumber}`,
          debitAmount: 0,
          creditAmount: subtotal.toNumber(),
        },
      ]

      if (taxAmountTotal.gt(0) && taxAccount) {
        journalLines.push({
          accountId: taxAccount.id,
          description: `VAT 15% on Invoice ${sale.invoiceNumber}`,
          debitAmount: 0,
          creditAmount: taxAmountTotal.toNumber(),
        })
      }

      // COGS & Inventory entry for physical items
      // If inventory stock was moved (totalCogs > 0) but the GL accounts are missing,
      // we MUST throw an error — silent skipping causes the ledger to diverge from stock movements.
      if (totalCogs.gt(0)) {
        if (!cogsAccount || !invAccount) {
          throw new AccountingError(
            `Cannot post Sales Invoice ${sale.invoiceNumber}: ` +
            `Chart of Accounts must include COGS (code 5100) and Inventory (code 1400) ` +
            `to record the cost of goods sold for physical products. ` +
            `Please create these accounts in your Chart of Accounts before posting invoices with physical products.`
          )
        }
        journalLines.push({
          accountId: cogsAccount.id,
          description: `COGS for Invoice ${sale.invoiceNumber}`,
          debitAmount: totalCogs.toNumber(),
          creditAmount: 0,
        })
        journalLines.push({
          accountId: invAccount.id,
          description: `Inventory reduction for Invoice ${sale.invoiceNumber}`,
          debitAmount: 0,
          creditAmount: totalCogs.toNumber(),
        })
      }

      // Use DocumentNumberingService for atomic, sequential, unique journal entry numbers.
      const jeNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry', tx)

      const journalEntry = await AccountingService.postJournalEntry({
        businessId,
        entryNumber: jeNumber,
        entryDate: invoiceDate,
        description: `Automated Journal Entry for Sales Invoice ${sale.invoiceNumber}`,
        currencyCode,
        exchangeRate: rate.toNumber(),
        reference: sale.invoiceNumber,
        sourceType: 'sale',
        sourceId: sale.id,
        lines: journalLines,
        userId,
      }, tx)

      return { sale, journalEntry }
    })
  }
}
