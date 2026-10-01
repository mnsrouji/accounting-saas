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
        isCash = false,
        cashAccountId,
        bankAccountId,
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

      // 1. Verify Customer & Tenant if provided
      let customer = null
      if (customerId) {
        customer = await tx.customer.findFirst({
          where: { id: customerId, businessId },
        })
        if (!customer) throw new TenantAccessDeniedError('Customer')
      } else if (!isCash) {
        throw new AccountingError('Customer is required for credit sales invoices.')
      }

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
      const isPaidCash = Boolean(isCash)
      const sale = await tx.sale.create({
        data: {
          businessId,
          customerId: customerId || null,
          salesOrderId,
          invoiceNumber,
          invoiceDate,
          dueDate: isPaidCash ? invoiceDate : dueDate,
          status: isPaidCash ? 'paid' : 'sent',
          currencyCode,
          exchangeRate: rate,
          subtotal,
          discountAmount: new Decimal(0),
          taxAmount: taxAmountTotal,
          totalAmount,
          paidAmount: isPaidCash ? totalAmount : new Decimal(0),
          balanceDue: isPaidCash ? new Decimal(0) : totalAmount,
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

      // Update Customer cached balance only if not cash invoice
      if (customerId && !isPaidCash) {
        const cust = await tx.customer.findFirst({ where: { id: customerId, businessId } })
        if (cust) {
          await tx.customer.update({
            where: { id: customerId },
            data: { balance: new Decimal(cust.balance).plus(totalAmount) },
          })
        }
      }

      // If Cash sale: update treasury balance & create payment receipt record
      if (isPaidCash) {
        if (cashAccountId) {
          const cashAcc = await tx.cashAccount.findFirst({ where: { id: cashAccountId, businessId } })
          if (cashAcc) {
            const nextBal = new Decimal(cashAcc.balance).plus(totalAmount)
            await tx.cashAccount.update({
              where: { id: cashAccountId },
              data: { balance: nextBal },
            })
            await tx.cashTransaction.create({
              data: {
                cashAccountId,
                businessId,
                type: 'deposit',
                amount: totalAmount,
                balanceAfter: nextBal,
                description: `Cash Sale Invoice ${sale.invoiceNumber}${customer ? ` - ${customer.name}` : ''}`,
                reference: sale.invoiceNumber,
                sourceType: 'sale',
                sourceId: sale.id,
                transactionDate: invoiceDate,
              },
            })
          }
        } else if (bankAccountId) {
          const bankAcc = await tx.bankAccount.findFirst({ where: { id: bankAccountId, businessId } })
          if (bankAcc) {
            const nextBal = new Decimal(bankAcc.balance).plus(totalAmount)
            await tx.bankAccount.update({
              where: { id: bankAccountId },
              data: { balance: nextBal },
            })
            await tx.bankTransaction.create({
              data: {
                bankAccountId,
                type: 'deposit',
                amount: totalAmount,
                balanceAfter: nextBal,
                description: `Bank Sale Invoice ${sale.invoiceNumber}${customer ? ` - ${customer.name}` : ''}`,
                reference: sale.invoiceNumber,
                transactionDate: invoiceDate,
              },
            })
          }
        }

        // Create Payment record for immediate settlement
        let paymentNumber = `PAY-${Date.now().toString().slice(-6)}`
        try {
          paymentNumber = await DocumentNumberingService.generateNumber(businessId, 'payment', tx)
        } catch {}

        await tx.payment.create({
          data: {
            businessId,
            paymentNumber,
            paymentDate: invoiceDate,
            type: 'incoming',
            direction: 'inbound',
            status: 'posted',
            method: bankAccountId ? 'bank_transfer' : 'cash',
            saleId: sale.id,
            customerId: customerId || null,
            cashAccountId: cashAccountId || null,
            bankAccountId: bankAccountId || null,
            currencyCode,
            exchangeRate: rate,
            amount: totalAmount,
            baseAmount: baseTotalAmount,
            allocatedAmount: totalAmount,
            unallocatedAmount: new Decimal(0),
            reference: sale.invoiceNumber,
            notes: `Auto settlement for Cash Invoice ${sale.invoiceNumber}`,
            createdBy: userId,
          },
        })
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
      // Ensure the business has standard Chart of Accounts seeded
      await AccountingService.ensureStandardChartOfAccounts(businessId, tx)

      // Resolve Revenue Account (4100 or any active revenue account)
      let revAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '4100' } })
      if (!revAccount) {
        revAccount = await tx.chartOfAccount.findFirst({
          where: { businessId, type: 'revenue', isHeader: false },
          orderBy: { code: 'asc' },
        })
      }
      if (!revAccount) {
        revAccount = await tx.chartOfAccount.create({
          data: {
            businessId,
            code: '4100',
            name: 'Sales Revenue',
            type: 'revenue',
            normalBalance: 'credit',
            isSystem: true,
            sortOrder: 410,
          },
        })
      }

      // Resolve Accounts Receivable (1300 or any AR asset account)
      let arAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '1300' } })
      if (!arAccount) {
        arAccount = await tx.chartOfAccount.findFirst({
          where: { businessId, type: 'asset', isHeader: false, code: { startsWith: '13' } },
          orderBy: { code: 'asc' },
        })
      }
      if (!arAccount) {
        arAccount = await tx.chartOfAccount.create({
          data: {
            businessId,
            code: '1300',
            name: 'Accounts Receivable',
            type: 'asset',
            normalBalance: 'debit',
            isSystem: true,
            sortOrder: 130,
          },
        })
      }

      // Determine Debit GL Account: Cash or AR
      let debitGlAccount = null
      if (isPaidCash) {
        if (cashAccountId) {
          const cashAcc = await tx.cashAccount.findFirst({ where: { id: cashAccountId, businessId } })
          if (cashAcc?.accountId) {
            debitGlAccount = await tx.chartOfAccount.findFirst({ where: { id: cashAcc.accountId, businessId } })
          }
        } else if (bankAccountId) {
          const bankAcc = await tx.bankAccount.findFirst({ where: { id: bankAccountId, businessId } })
          if (bankAcc?.accountId) {
            debitGlAccount = await tx.chartOfAccount.findFirst({ where: { id: bankAcc.accountId, businessId } })
          }
        }
        if (!debitGlAccount) {
          debitGlAccount = await tx.chartOfAccount.findFirst({
            where: {
              businessId,
              code: { in: ['1110', '1100', '1210', '1200'] },
            },
            orderBy: { code: 'asc' },
          })
        }
        if (!debitGlAccount) {
          debitGlAccount = await tx.chartOfAccount.findFirst({
            where: { businessId, type: 'asset', isHeader: false, code: { startsWith: '11' } },
            orderBy: { code: 'asc' },
          })
        }
        if (!debitGlAccount) {
          debitGlAccount = await tx.chartOfAccount.create({
            data: {
              businessId,
              code: '1110',
              name: 'Main Operating Cash',
              type: 'asset',
              normalBalance: 'debit',
              isSystem: true,
              sortOrder: 111,
            },
          })
        }
      }

      if (!debitGlAccount) {
        debitGlAccount = arAccount
      }

      // Resolve Tax Account (2200 or any tax liability)
      let taxAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '2200' } })
      if (!taxAccount && taxAmountTotal.gt(0)) {
        taxAccount = await tx.chartOfAccount.findFirst({
          where: { businessId, type: 'liability', isHeader: false, code: { startsWith: '22' } },
          orderBy: { code: 'asc' },
        })
        if (!taxAccount) {
          taxAccount = await tx.chartOfAccount.create({
            data: {
              businessId,
              code: '2200',
              name: 'Tax Payable',
              type: 'liability',
              normalBalance: 'credit',
              isSystem: true,
              sortOrder: 220,
            },
          })
        }
      }

      // Resolve COGS & Inventory accounts if physical items moved
      let cogsAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '5100' } })
      if (!cogsAccount && totalCogs.gt(0)) {
        cogsAccount = await tx.chartOfAccount.findFirst({
          where: { businessId, type: 'expense', isHeader: false, code: { startsWith: '51' } },
          orderBy: { code: 'asc' },
        })
        if (!cogsAccount) {
          cogsAccount = await tx.chartOfAccount.create({
            data: {
              businessId,
              code: '5100',
              name: 'Cost of Goods Sold',
              type: 'expense',
              normalBalance: 'debit',
              isSystem: true,
              sortOrder: 510,
            },
          })
        }
      }

      let invAccount = await tx.chartOfAccount.findFirst({ where: { businessId, code: '1400' } })
      if (!invAccount && totalCogs.gt(0)) {
        invAccount = await tx.chartOfAccount.findFirst({
          where: { businessId, type: 'asset', isHeader: false, code: { startsWith: '14' } },
          orderBy: { code: 'asc' },
        })
        if (!invAccount) {
          invAccount = await tx.chartOfAccount.create({
            data: {
              businessId,
              code: '1400',
              name: 'Inventory',
              type: 'asset',
              normalBalance: 'debit',
              isSystem: true,
              sortOrder: 140,
            },
          })
        }
      }

      const journalLines: any[] = [
        {
          accountId: debitGlAccount.id,
          description: isPaidCash
            ? `Cash Sale ${sale.invoiceNumber}${customer ? ` - ${customer.name}` : ''}`
            : `Sales Invoice ${sale.invoiceNumber}${customer ? ` - ${customer.name}` : ''}`,
          debitAmount: totalAmount.toNumber(),
          creditAmount: 0,
          customerId: customerId || undefined,
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
      if (totalCogs.gt(0) && cogsAccount && invAccount) {
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
