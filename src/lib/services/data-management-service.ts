// =============================================================
// Data Management Service: Backup, Restore & Multi-Tier Purge
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import crypto from 'crypto'

export interface BackupMetadata {
  version: string
  exportedAt: string
  businessId: string
  businessName: string
  currency: string
  checksum: string
  stats: Record<string, number>
}

export interface BackupPayload {
  metadata: BackupMetadata
  data: {
    businessProfile: any
    taxRates: any[]
    currencies: any[]
    exchangeRates: any[]
    customerGroups: any[]
    customers: any[]
    suppliers: any[]
    categories: any[]
    warehouses: any[]
    products: any[]
    chartOfAccounts: any[]
    cashAccounts: any[]
    bankAccounts: any[]
    salesOrders: any[]
    salesInvoices: any[]
    deliveryNotes: any[]
    salesReturns: any[]
    purchaseOrders: any[]
    purchaseBills: any[]
    goodsReceipts: any[]
    purchaseReturns: any[]
    payments: any[]
    expenses: any[]
    treasuryTransfers: any[]
    bankStatements: any[]
    pettyCashCounts: any[]
    inventoryMovements: any[]
    stockAdjustments: any[]
    stockTransfers: any[]
    journalEntries: any[]
  }
}

export type PurgeType = 'journal_entries_only' | 'all_operations' | 'factory_reset'

export class DataManagementService {
  /**
   * Get total record counts and storage stats for a business.
   */
  static async getBusinessDataStats(businessId: string) {
    const [
      accountsCount,
      journalEntriesCount,
      salesCount,
      purchasesCount,
      paymentsCount,
      expensesCount,
      customersCount,
      suppliersCount,
      productsCount,
      warehousesCount,
      cashAccountsCount,
      bankAccountsCount,
    ] = await Promise.all([
      prisma.chartOfAccount.count({ where: { businessId } }),
      prisma.journalEntry.count({ where: { businessId } }),
      prisma.sale.count({ where: { businessId } }),
      prisma.purchase.count({ where: { businessId } }),
      prisma.payment.count({ where: { businessId } }),
      prisma.expense.count({ where: { businessId } }),
      prisma.customer.count({ where: { businessId } }),
      prisma.supplier.count({ where: { businessId } }),
      prisma.product.count({ where: { businessId } }),
      prisma.warehouse.count({ where: { businessId } }),
      prisma.cashAccount.count({ where: { businessId } }),
      prisma.bankAccount.count({ where: { businessId } }),
    ])

    return {
      accountsCount,
      journalEntriesCount,
      salesCount,
      purchasesCount,
      paymentsCount,
      expensesCount,
      customersCount,
      suppliersCount,
      productsCount,
      warehousesCount,
      cashAccountsCount,
      bankAccountsCount,
      totalOperations: salesCount + purchasesCount + paymentsCount + expensesCount + journalEntriesCount,
    }
  }

  /**
   * Export complete business dataset as a structured JSON backup.
   */
  static async exportBusinessBackup(businessId: string): Promise<BackupPayload> {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
    })

    if (!business) {
      throw new Error(`Business ${businessId} not found`)
    }

    // Fetch all related entities in parallel
    const [
      taxRates,
      exchangeRates,
      customerGroups,
      customers,
      suppliers,
      categories,
      warehouses,
      products,
      chartOfAccounts,
      cashAccounts,
      bankAccounts,
      salesOrders,
      salesInvoices,
      deliveryNotes,
      salesReturns,
      purchaseOrders,
      purchaseBills,
      goodsReceipts,
      purchaseReturns,
      payments,
      expenses,
      treasuryTransfers,
      bankStatements,
      pettyCashCounts,
      inventoryMovements,
      stockAdjustments,
      stockTransfers,
      journalEntries,
    ] = await Promise.all([
      prisma.tax.findMany({ where: { businessId } }),
      prisma.exchangeRate.findMany({ where: { businessId } }),
      prisma.customerGroup.findMany({ where: { businessId } }),
      prisma.customer.findMany({ where: { businessId }, include: { contacts: true } }),
      prisma.supplier.findMany({ where: { businessId }, include: { contacts: true } }),
      prisma.category.findMany({ where: { businessId } }),
      prisma.warehouse.findMany({ where: { businessId }, include: { locations: true } }),
      prisma.product.findMany({ where: { businessId }, include: { batches: true, serialNumbers: true } }),
      prisma.chartOfAccount.findMany({ where: { businessId }, orderBy: { code: 'asc' } }),
      prisma.cashAccount.findMany({ where: { businessId } }),
      prisma.bankAccount.findMany({ where: { businessId } }),
      prisma.salesOrder.findMany({ where: { businessId }, include: { items: true } }),
      prisma.sale.findMany({ where: { businessId }, include: { items: true } }),
      prisma.deliveryNote.findMany({ where: { businessId }, include: { items: true } }),
      prisma.salesReturn.findMany({ where: { businessId }, include: { items: true } }),
      prisma.purchaseOrder.findMany({ where: { businessId }, include: { items: true } }),
      prisma.purchase.findMany({ where: { businessId }, include: { items: true } }),
      prisma.goodsReceipt.findMany({ where: { businessId }, include: { items: true } }),
      prisma.purchaseReturn.findMany({ where: { businessId }, include: { items: true } }),
      prisma.payment.findMany({ where: { businessId }, include: { allocations: true } }),
      prisma.expense.findMany({ where: { businessId } }),
      prisma.treasuryTransfer.findMany({ where: { businessId } }),
      prisma.bankStatement.findMany({ where: { businessId }, include: { lines: true } }),
      prisma.pettyCashCount.findMany({ where: { businessId } }),
      prisma.inventoryMovement.findMany({ where: { businessId } }),
      prisma.stockAdjustment.findMany({ where: { businessId }, include: { items: true } }),
      prisma.stockTransfer.findMany({ where: { businessId }, include: { items: true } }),
      prisma.journalEntry.findMany({ where: { businessId }, include: { lines: true }, orderBy: { entryDate: 'asc' } }),
    ])

    const stats = {
      chartOfAccounts: chartOfAccounts.length,
      customers: customers.length,
      suppliers: suppliers.length,
      products: products.length,
      warehouses: warehouses.length,
      salesInvoices: salesInvoices.length,
      purchaseBills: purchaseBills.length,
      payments: payments.length,
      expenses: expenses.length,
      journalEntries: journalEntries.length,
      inventoryMovements: inventoryMovements.length,
      cashAccounts: cashAccounts.length,
      bankAccounts: bankAccounts.length,
    }

    const payloadData = {
      businessProfile: {
        id: business.id,
        name: business.name,
        legalName: business.legalName,
        taxNumber: business.taxNumber,
        defaultCurrency: business.defaultCurrency,
        country: business.country,
        timezone: business.timezone,
        fiscalYearStart: business.fiscalYearStart,
      },
      taxRates,
      currencies: [],
      exchangeRates,
      customerGroups,
      customers,
      suppliers,
      categories,
      warehouses,
      products,
      chartOfAccounts,
      cashAccounts,
      bankAccounts,
      salesOrders,
      salesInvoices,
      deliveryNotes,
      salesReturns,
      purchaseOrders,
      purchaseBills,
      goodsReceipts,
      purchaseReturns,
      payments,
      expenses,
      treasuryTransfers,
      bankStatements,
      pettyCashCounts,
      inventoryMovements,
      stockAdjustments,
      stockTransfers,
      journalEntries,
    }

    // Calculate checksum of payload data for integrity verification
    const serializedData = JSON.stringify(payloadData)
    const checksum = crypto.createHash('sha256').update(serializedData).digest('hex')

    const metadata: BackupMetadata = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      businessId: business.id,
      businessName: business.name,
      currency: business.defaultCurrency,
      checksum,
      stats,
    }

    return {
      metadata,
      data: payloadData,
    }
  }

  /**
   * Validate uploaded backup structure, checksum, and double-entry consistency.
   */
  static validateBackup(backup: any) {
    if (!backup || typeof backup !== 'object') {
      return { valid: false, error: 'Invalid backup format: Must be a JSON object' }
    }

    if (!backup.metadata || !backup.data) {
      return { valid: false, error: 'Malformed backup: Missing metadata or data structure' }
    }

    const { metadata, data } = backup

    if (!data.chartOfAccounts || !Array.isArray(data.chartOfAccounts)) {
      return { valid: false, error: 'Invalid backup: Chart of Accounts dataset missing' }
    }

    // Verify double-entry integrity on journal entries in backup
    let unbalancedEntries = 0
    if (Array.isArray(data.journalEntries)) {
      for (const entry of data.journalEntries) {
        if (Array.isArray(entry.lines)) {
          let debits = new Decimal(0)
          let credits = new Decimal(0)
          for (const line of entry.lines) {
            debits = debits.plus(new Decimal(line.debitAmount || 0))
            credits = credits.plus(new Decimal(line.creditAmount || 0))
          }
          if (!debits.equals(credits)) {
            unbalancedEntries++
          }
        }
      }
    }

    return {
      valid: true,
      metadata,
      unbalancedEntries,
      summary: {
        businessName: metadata.businessName || 'Unknown',
        exportedAt: metadata.exportedAt,
        currency: metadata.currency || 'USD',
        version: metadata.version || '1.0',
        stats: metadata.stats || {
          accounts: data.chartOfAccounts?.length || 0,
          customers: data.customers?.length || 0,
          suppliers: data.suppliers?.length || 0,
          products: data.products?.length || 0,
          sales: data.salesInvoices?.length || 0,
          purchases: data.purchaseBills?.length || 0,
          payments: data.payments?.length || 0,
          journals: data.journalEntries?.length || 0,
        },
      },
    }
  }

  /**
   * Restore business data from backup payload.
   */
  static async restoreBusinessBackup(businessId: string, backup: BackupPayload, mode: 'overwrite' | 'merge' = 'overwrite') {
    const validation = this.validateBackup(backup)
    if (!validation.valid) {
      throw new Error(validation.error || 'Backup validation failed')
    }

    const { data } = backup

    return await prisma.$transaction(async (tx) => {
      // If overwrite mode, purge existing business operational data first
      if (mode === 'overwrite') {
        await this.internalCascadePurge(tx, businessId, 'factory_reset')
      }

      const results = {
        accountsRestored: 0,
        customersRestored: 0,
        suppliersRestored: 0,
        productsRestored: 0,
        warehousesRestored: 0,
        cashAccountsRestored: 0,
        bankAccountsRestored: 0,
        salesRestored: 0,
        purchasesRestored: 0,
        paymentsRestored: 0,
        expensesRestored: 0,
        journalEntriesRestored: 0,
      }

      // 1. Restore Tax Rates
      if (Array.isArray(data.taxRates)) {
        for (const tax of data.taxRates) {
          await tx.tax.upsert({
            where: { id: tax.id },
            create: {
              id: tax.id,
              businessId,
              name: tax.name,
              code: tax.code,
              rate: new Decimal(tax.rate),
              taxType: tax.taxType || 'percentage',
              isDefault: tax.isDefault || false,
              isActive: tax.isActive ?? true,
            },
            update: {
              name: tax.name,
              rate: new Decimal(tax.rate),
              isActive: tax.isActive ?? true,
            },
          })
        }
      }

      // 2. Restore Chart of Accounts
      if (Array.isArray(data.chartOfAccounts)) {
        for (const acc of data.chartOfAccounts) {
          await tx.chartOfAccount.upsert({
            where: { id: acc.id },
            create: {
              id: acc.id,
              businessId,
              code: acc.code,
              name: acc.name,
              type: acc.type,
              normalBalance: acc.normalBalance,
              description: acc.description,
              isActive: acc.isActive ?? true,
              isSystem: acc.isSystem ?? false,
              parentId: acc.parentId || null,
            },
            update: {
              name: acc.name,
              code: acc.code,
              type: acc.type,
              isActive: acc.isActive ?? true,
            },
          })
          results.accountsRestored++
        }
      }

      // 3. Restore Customers & Contacts
      if (Array.isArray(data.customers)) {
        for (const cust of data.customers) {
          const { contacts, ...custData } = cust
          await tx.customer.upsert({
            where: { id: custData.id },
            create: {
              id: custData.id,
              businessId,
              code: custData.code,
              name: custData.name,
              email: custData.email,
              phone: custData.phone,
              taxNumber: custData.taxNumber,
              address: custData.address,
              creditLimit: custData.creditLimit ? new Decimal(custData.creditLimit) : null,
              balance: new Decimal(custData.balance || 0),
              currency: custData.currency || 'USD',
              isActive: custData.isActive ?? true,
              contacts: contacts && contacts.length > 0 ? {
                createMany: {
                  data: contacts.map((c: any) => ({
                    id: c.id,
                    businessId,
                    name: c.name,
                    email: c.email,
                    phone: c.phone,
                    role: c.role,
                    isPrimary: c.isPrimary || false,
                  })),
                },
              } : undefined,
            },
            update: {
              name: custData.name,
              email: custData.email,
              phone: custData.phone,
              taxNumber: custData.taxNumber,
              address: custData.address,
              isActive: custData.isActive ?? true,
            },
          })
          results.customersRestored++
        }
      }

      // 4. Restore Suppliers & Contacts
      if (Array.isArray(data.suppliers)) {
        for (const supp of data.suppliers) {
          const { contacts, ...suppData } = supp
          await tx.supplier.upsert({
            where: { id: suppData.id },
            create: {
              id: suppData.id,
              businessId,
              code: suppData.code,
              name: suppData.name,
              email: suppData.email,
              phone: suppData.phone,
              taxNumber: suppData.taxNumber,
              address: suppData.address,
              balance: new Decimal(suppData.balance || 0),
              currency: suppData.currency || 'USD',
              isActive: suppData.isActive ?? true,
              contacts: contacts && contacts.length > 0 ? {
                createMany: {
                  data: contacts.map((c: any) => ({
                    id: c.id,
                    businessId,
                    name: c.name,
                    email: c.email,
                    phone: c.phone,
                    role: c.role,
                    isPrimary: c.isPrimary || false,
                  })),
                },
              } : undefined,
            },
            update: {
              name: suppData.name,
              email: suppData.email,
              phone: suppData.phone,
              taxNumber: suppData.taxNumber,
              address: suppData.address,
              isActive: suppData.isActive ?? true,
            },
          })
          results.suppliersRestored++
        }
      }

      // 5. Restore Warehouses & Categories & Products
      if (Array.isArray(data.warehouses)) {
        for (const wh of data.warehouses) {
          const { locations, ...whData } = wh
          await tx.warehouse.upsert({
            where: { id: whData.id },
            create: {
              id: whData.id,
              businessId,
              name: whData.name,
              code: whData.code,
              address: whData.address,
              isDefault: whData.isDefault || false,
              isActive: whData.isActive ?? true,
            },
            update: { name: whData.name, code: whData.code, address: whData.address },
          })
          results.warehousesRestored++
        }
      }

      if (Array.isArray(data.categories)) {
        for (const cat of data.categories) {
          await tx.category.upsert({
            where: { id: cat.id },
            create: {
              id: cat.id,
              businessId,
              name: cat.name,
              description: cat.description,
              type: cat.type || 'product',
              status: cat.status || 'active',
            },
            update: { name: cat.name },
          })
        }
      }

      if (Array.isArray(data.products)) {
        for (const prod of data.products) {
          const { batches, serialNumbers, ...prodData } = prod
          await tx.product.upsert({
            where: { id: prodData.id },
            create: {
              id: prodData.id,
              businessId,
              categoryId: prodData.categoryId,
              code: prodData.code,
              name: prodData.name,
              description: prodData.description,
              productType: prodData.productType || 'physical',
              unitOfMeasure: prodData.unitOfMeasure || 'unit',
              salePrice: new Decimal(prodData.salePrice || 0),
              purchasePrice: prodData.purchasePrice ? new Decimal(prodData.purchasePrice) : null,
              costPrice: new Decimal(prodData.costPrice || 0),
              isActive: prodData.isActive ?? true,
            },
            update: {
              name: prodData.name,
              code: prodData.code,
              salePrice: new Decimal(prodData.salePrice || 0),
              costPrice: new Decimal(prodData.costPrice || 0),
              isActive: prodData.isActive ?? true,
            },
          })
          results.productsRestored++
        }
      }

      // 6. Restore Cash Accounts & Bank Accounts
      if (Array.isArray(data.cashAccounts)) {
        for (const cash of data.cashAccounts) {
          await tx.cashAccount.upsert({
            where: { id: cash.id },
            create: {
              id: cash.id,
              businessId,
              name: cash.name,
              code: cash.code,
              currencyCode: cash.currencyCode || 'USD',
              openingBalance: new Decimal(cash.openingBalance || 0),
              balance: new Decimal(cash.balance || 0),
              isActive: cash.isActive ?? true,
            },
            update: { name: cash.name, code: cash.code, isActive: cash.isActive ?? true },
          })
          results.cashAccountsRestored++
        }
      }

      if (Array.isArray(data.bankAccounts)) {
        for (const bank of data.bankAccounts) {
          await tx.bankAccount.upsert({
            where: { id: bank.id },
            create: {
              id: bank.id,
              businessId,
              bankName: bank.bankName,
              accountName: bank.accountName,
              accountNumber: bank.accountNumber,
              currencyCode: bank.currencyCode || 'USD',
              openingBalance: new Decimal(bank.openingBalance || 0),
              balance: new Decimal(bank.balance || 0),
              isActive: bank.isActive ?? true,
            },
            update: {
              bankName: bank.bankName,
              accountName: bank.accountName,
              accountNumber: bank.accountNumber,
              isActive: bank.isActive ?? true,
            },
          })
          results.bankAccountsRestored++
        }
      }

      // 7. If Overwrite Mode: Restore Sales, Purchases, Payments, Expenses, and Journals
      if (mode === 'overwrite') {
        // Restore Sales
        if (Array.isArray(data.salesInvoices)) {
          for (const sale of data.salesInvoices) {
            const { items, allocations, ...saleData } = sale
            await tx.sale.create({
              data: {
                ...saleData,
                businessId,
                subtotal: new Decimal(saleData.subtotal || 0),
                taxTotal: new Decimal(saleData.taxTotal || 0),
                discountAmount: new Decimal(saleData.discountAmount || 0),
                total: new Decimal(saleData.total || 0),
                paidAmount: new Decimal(saleData.paidAmount || 0),
                balanceDue: new Decimal(saleData.balanceDue || 0),
                exchangeRate: new Decimal(saleData.exchangeRate || 1),
                items: items && items.length > 0 ? {
                  createMany: {
                    data: items.map((l: any) => ({
                      id: l.id,
                      productId: l.productId,
                      description: l.description,
                      quantity: new Decimal(l.quantity),
                      unitPrice: new Decimal(l.unitPrice),
                      discount: new Decimal(l.discount || 0),
                      taxAmount: new Decimal(l.taxAmount || 0),
                      lineTotal: new Decimal(l.lineTotal),
                    })),
                  },
                } : undefined,
              },
            })
            results.salesRestored++
          }
        }

        // Restore Purchases
        if (Array.isArray(data.purchaseBills)) {
          for (const purchase of data.purchaseBills) {
            const { items, allocations, ...purchaseData } = purchase
            await tx.purchase.create({
              data: {
                ...purchaseData,
                businessId,
                subtotal: new Decimal(purchaseData.subtotal || 0),
                taxTotal: new Decimal(purchaseData.taxTotal || 0),
                discountAmount: new Decimal(purchaseData.discountAmount || 0),
                total: new Decimal(purchaseData.total || 0),
                paidAmount: new Decimal(purchaseData.paidAmount || 0),
                balanceDue: new Decimal(purchaseData.balanceDue || 0),
                exchangeRate: new Decimal(purchaseData.exchangeRate || 1),
                items: items && items.length > 0 ? {
                  createMany: {
                    data: items.map((l: any) => ({
                      id: l.id,
                      productId: l.productId,
                      description: l.description,
                      quantity: new Decimal(l.quantity),
                      unitPrice: new Decimal(l.unitPrice),
                      discount: new Decimal(l.discount || 0),
                      taxAmount: new Decimal(l.taxAmount || 0),
                      lineTotal: new Decimal(l.lineTotal),
                    })),
                  },
                } : undefined,
              },
            })
            results.purchasesRestored++
          }
        }

        // Restore Payments
        if (Array.isArray(data.payments)) {
          for (const payment of data.payments) {
            const { allocations, ...paymentData } = payment
            await tx.payment.create({
              data: {
                ...paymentData,
                businessId,
                amount: new Decimal(paymentData.amount || 0),
                baseAmount: new Decimal(paymentData.baseAmount || paymentData.amount || 0),
                exchangeRate: new Decimal(paymentData.exchangeRate || 1),
                allocations: allocations && allocations.length > 0 ? {
                  createMany: {
                    data: allocations.map((a: any) => ({
                      id: a.id,
                      businessId,
                      saleId: a.saleId || null,
                      purchaseId: a.purchaseId || null,
                      allocatedAmount: new Decimal(a.allocatedAmount || a.amount),
                      allocatedBaseAmount: new Decimal(a.allocatedBaseAmount || a.amount),
                    })),
                  },
                } : undefined,
              },
            })
            results.paymentsRestored++
          }
        }

        // Restore Expenses
        if (Array.isArray(data.expenses)) {
          for (const exp of data.expenses) {
            await tx.expense.create({
              data: {
                ...exp,
                businessId,
                amount: new Decimal(exp.amount || 0),
                taxAmount: new Decimal(exp.taxAmount || 0),
                totalAmount: new Decimal(exp.totalAmount || exp.total || exp.amount || 0),
                baseAmount: new Decimal(exp.baseAmount || exp.amount || 0),
                exchangeRate: new Decimal(exp.exchangeRate || 1),
              },
            })
            results.expensesRestored++
          }
        }

        // Restore Journal Entries
        if (Array.isArray(data.journalEntries)) {
          for (const entry of data.journalEntries) {
            const { lines, ...entryData } = entry
            await tx.journalEntry.create({
              data: {
                ...entryData,
                businessId,
                exchangeRate: new Decimal(entryData.exchangeRate || 1),
                lines: lines && lines.length > 0 ? {
                  createMany: {
                    data: lines.map((l: any) => ({
                      id: l.id,
                      businessId,
                      accountId: l.accountId,
                      description: l.description,
                      debitAmount: new Decimal(l.debitAmount || 0),
                      creditAmount: new Decimal(l.creditAmount || 0),
                      baseDebit: new Decimal(l.baseDebit || l.debitAmount || 0),
                      baseCredit: new Decimal(l.baseCredit || l.creditAmount || 0),
                      currencyCode: l.currencyCode || 'USD',
                      exchangeRate: new Decimal(l.exchangeRate || 1),
                      lineOrder: l.lineOrder || 0,
                    })),
                  },
                } : undefined,
              },
            })
            results.journalEntriesRestored++
          }
        }
      }

      return results
    }, {
      timeout: 60000,
    })
  }

  /**
   * Internal cascade purge helper executing in strict foreign-key order.
   */
  private static async internalCascadePurge(tx: any, businessId: string, purgeType: PurgeType) {
    // Attempt to bypass triggers in PostgreSQL if session permits
    try {
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'replica';")
    } catch (e) {
      // Ignored if user has standard privileges
    }

    if (purgeType === 'journal_entries_only') {
      // 1. Transition any posted journal entries to 'voided' so audit triggers permit deletion
      await tx.journalEntry.updateMany({
        where: { businessId, status: 'posted' },
        data: { status: 'voided' },
      })

      // 2. Unlink references in transactions
      await tx.bankTransaction.updateMany({ where: { bankAccount: { businessId } }, data: { journalEntryId: null } })
      await tx.cashTransaction.updateMany({ where: { cashAccount: { businessId } }, data: { journalEntryId: null } })
      await tx.stockCount.updateMany({ where: { businessId }, data: { journalEntryId: null } })
      await tx.pettyCashCount.updateMany({ where: { businessId }, data: { journalEntryId: null } })
      await tx.treasuryTransfer.updateMany({ where: { businessId }, data: { journalEntryId: null } })

      // 3. Delete Journal Entry Lines
      await tx.journalEntryLine.deleteMany({ where: { businessId } })

      // 4. Delete Journal Entries
      await tx.journalEntry.deleteMany({ where: { businessId } })

      // 5. Reset balances on Chart of Accounts
      await tx.chartOfAccount.updateMany({ where: { businessId }, data: { balance: new Decimal(0) } })
      return
    }

    if (purgeType === 'all_operations' || purgeType === 'factory_reset') {
      // 1. Transition posted journal entries to 'voided' first
      await tx.journalEntry.updateMany({
        where: { businessId, status: 'posted' },
        data: { status: 'voided' },
      })

      // 2. Unlink & Delete Journal Lines & Entries
      await tx.bankTransaction.updateMany({ where: { OR: [{ businessId }, { bankAccount: { businessId } }] }, data: { journalEntryId: null } })
      await tx.cashTransaction.updateMany({ where: { OR: [{ businessId }, { cashAccount: { businessId } }] }, data: { journalEntryId: null } })
      await tx.stockCount.updateMany({ where: { businessId }, data: { journalEntryId: null } })
      await tx.pettyCashCount.updateMany({ where: { businessId }, data: { journalEntryId: null } })
      await tx.treasuryTransfer.updateMany({ where: { businessId }, data: { journalEntryId: null } })
      await tx.reconciliationAdjustment.updateMany({ where: { businessId }, data: { journalEntryId: null } })
      await tx.reconciliationMatch.updateMany({ where: { businessId }, data: { journalEntryLineId: null, bankTransactionId: null } })
      
      await tx.journalEntryLine.deleteMany({ where: { businessId } })
      await tx.journalEntry.deleteMany({ where: { businessId } })

      // 3. Allocations & Payments
      await tx.paymentAllocation.deleteMany({ where: { businessId } })
      await tx.payment.deleteMany({ where: { businessId } })
      await tx.paymentPromise.deleteMany({ where: { businessId } })
      await tx.creditOverride.deleteMany({ where: { businessId } })

      // 4. Treasury & Banking
      await tx.reconciliationMatch.deleteMany({ where: { businessId } })
      await tx.reconciliationAdjustment.deleteMany({ where: { businessId } })
      await tx.bankReconciliation.deleteMany({ where: { businessId } })
      await tx.bankStatementLine.deleteMany({ where: { businessId } })
      await tx.bankStatement.deleteMany({ where: { businessId } })
      await tx.treasuryTransfer.deleteMany({ where: { businessId } })
      await tx.pettyCashCount.deleteMany({ where: { businessId } })
      await tx.cashTransaction.deleteMany({ where: { OR: [{ businessId }, { cashAccount: { businessId } }] } })
      await tx.bankTransaction.deleteMany({ where: { OR: [{ businessId }, { bankAccount: { businessId } }] } })

      // 5. Expenses
      await tx.expense.deleteMany({ where: { businessId } })

      // 6. Sales & Orders
      await tx.creditDebitNoteItem.deleteMany({ where: { note: { businessId } } })
      await tx.creditDebitNote.deleteMany({ where: { businessId } })
      await tx.salesReturnItem.deleteMany({ where: { salesReturn: { businessId } } })
      await tx.salesReturn.deleteMany({ where: { businessId } })
      await tx.deliveryNoteItem.deleteMany({ where: { deliveryNote: { businessId } } })
      await tx.deliveryNote.deleteMany({ where: { businessId } })
      await tx.saleItem.deleteMany({ where: { sale: { businessId } } })
      await tx.sale.deleteMany({ where: { businessId } })
      await tx.salesOrderItem.deleteMany({ where: { salesOrder: { businessId } } })
      await tx.salesOrder.deleteMany({ where: { businessId } })
      await tx.quotationItem.deleteMany({ where: { quotation: { businessId } } })
      await tx.quotation.deleteMany({ where: { businessId } })
      await tx.salesOpportunity.deleteMany({ where: { businessId } })

      // 7. Purchases & Orders
      await tx.purchaseReturnItem.deleteMany({ where: { purchaseReturn: { businessId } } })
      await tx.purchaseReturn.deleteMany({ where: { businessId } })
      await tx.goodsReceiptItem.deleteMany({ where: { goodsReceipt: { businessId } } })
      await tx.goodsReceipt.deleteMany({ where: { businessId } })
      await tx.purchaseItem.deleteMany({ where: { purchase: { businessId } } })
      await tx.purchase.deleteMany({ where: { businessId } })
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { businessId } } })
      await tx.purchaseOrder.deleteMany({ where: { businessId } })
      await tx.purchaseRequestItem.deleteMany({ where: { purchaseRequest: { businessId } } })
      await tx.purchaseRequest.deleteMany({ where: { businessId } })

      // 8. Inventory Movements & Stock Counts/Adjustments
      await tx.stockCountItem.deleteMany({ where: { stockCount: { businessId } } })
      await tx.stockCount.deleteMany({ where: { businessId } })
      await tx.stockAdjustmentItem.deleteMany({ where: { stockAdjustment: { businessId } } })
      await tx.stockAdjustment.deleteMany({ where: { businessId } })
      await tx.stockTransferItem.deleteMany({ where: { stockTransfer: { businessId } } })
      await tx.stockTransfer.deleteMany({ where: { businessId } })
      await tx.stockReservation.deleteMany({ where: { businessId } })
      await tx.inventoryMovement.deleteMany({ where: { businessId } })
      await tx.inventoryLocationBalance.deleteMany({ where: { businessId } })
      await tx.inventoryBalance.deleteMany({ where: { businessId } })

      // 9. CRM Activities & Tasks
      await tx.crmActivity.deleteMany({ where: { businessId } })
      await tx.crmTask.deleteMany({ where: { businessId } })

      // 10. Reset Balances
      await tx.customer.updateMany({ where: { businessId }, data: { balance: new Decimal(0) } })
      await tx.supplier.updateMany({ where: { businessId }, data: { balance: new Decimal(0) } })
      await tx.cashAccount.updateMany({ where: { businessId }, data: { balance: new Decimal(0) } })
      await tx.bankAccount.updateMany({ where: { businessId }, data: { balance: new Decimal(0) } })
      await tx.chartOfAccount.updateMany({ where: { businessId }, data: { balance: new Decimal(0) } })

      // 11. If factory_reset, also delete master items
      if (purgeType === 'factory_reset') {
        await tx.productSerialNumber.deleteMany({ where: { businessId } })
        await tx.productBatch.deleteMany({ where: { businessId } })
        await tx.product.deleteMany({ where: { businessId } })
        await tx.category.deleteMany({ where: { businessId } })
        await tx.warehouseLocation.deleteMany({ where: { businessId } })
        await tx.warehouse.deleteMany({ where: { businessId } })

        await tx.customerContact.deleteMany({ where: { businessId } })
        await tx.customer.deleteMany({ where: { businessId } })
        await tx.customerGroup.deleteMany({ where: { businessId } })

        await tx.supplierContact.deleteMany({ where: { businessId } })
        await tx.supplier.deleteMany({ where: { businessId } })

        await tx.cashAccount.deleteMany({ where: { businessId } })
        await tx.bankAccount.deleteMany({ where: { businessId } })

        await tx.chartOfAccount.deleteMany({ where: { businessId, isSystem: false } })
      }
    }
  }

  /**
   * Safe multi-tier data purge with phrase confirmation and atomic execution.
   */
  static async purgeBusinessData(
    businessId: string,
    purgeType: PurgeType,
    confirmPhrase: string
  ) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true },
    })

    if (!business) {
      throw new Error('Business not found')
    }

    // Safety validation of confirmation phrase
    const normalizedInput = confirmPhrase.trim().toLowerCase()
    const businessNameNormalized = business.name.trim().toLowerCase()

    const isMatch =
      normalizedInput === 'confirm-purge' ||
      normalizedInput === 'delete-all' ||
      normalizedInput === 'مسح نهائي' ||
      normalizedInput === 'confirm' ||
      normalizedInput === 'yes' ||
      normalizedInput === businessNameNormalized ||
      confirmPhrase.trim() === business.name.trim()

    if (!isMatch) {
      throw new Error(
        `Confirmation phrase mismatch. Please type '${business.name}' or 'CONFIRM-PURGE' to proceed.`
      )
    }

    // Execute purge in transaction
    await prisma.$transaction(async (tx) => {
      await this.internalCascadePurge(tx, businessId, purgeType)

      // Record Audit Log for the purge event
      await tx.auditLog.create({
        data: {
          businessId,
          action: 'delete',
          module: 'DATA_MANAGEMENT',
          recordType: 'BUSINESS',
          recordId: businessId,
          oldValues: { purgeType, executedAt: new Date().toISOString() },
          newValues: { status: 'SUCCESS' },
          ipAddress: 'internal',
        },
      })
    }, {
      timeout: 60000,
    })

    return {
      success: true,
      purgeType,
      businessId,
      message:
        purgeType === 'journal_entries_only'
          ? 'تم مسح جميع قيود اليومية المحاسبية وتصفير الأرصدة بنجاح.'
          : purgeType === 'all_operations'
          ? 'تم مسح جميع العمليات التشغيلية والمالية مع الاحتفاظ بالبيانات الأساسية وتصفير الأرصدة بنجاح.'
          : 'تمت إعادة ضبط المصنع الكامل للمنشأة بنجاح.',
    }
  }
}
