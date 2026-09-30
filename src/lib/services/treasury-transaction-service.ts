// =============================================================
// Treasury Transaction Service — Controlled Cash & Bank Operations
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  createTreasuryTransactionSchema,
  CreateTreasuryTransactionInput,
} from '@/lib/validations/treasury-schemas'
import { TreasuryAccountNotFoundError, TreasuryError } from '@/lib/errors/treasury-error'
import { AuditService } from './audit-service'
import { AccountingService } from './accounting-service'
import { DocumentNumberingService } from './document-numbering-service'

export class TreasuryTransactionService {
  /**
   * Post a controlled treasury transaction with double-entry GL synchronization.
   */
  static async createTransaction(input: CreateTreasuryTransactionInput) {
    const validated = createTreasuryTransactionSchema.parse(input)
    const amount = new Decimal(validated.amount)
    const rate = new Decimal(validated.exchangeRate)

    return prisma.$transaction(async (tx) => {
      // 1. Fetch treasury account & linked GL account
      let treasuryAccountId: string
      let treasuryGlAccountId: string
      let currentBalance: Decimal
      let accountName: string

      if (validated.accountType === 'cash') {
        const cashAcc = await tx.cashAccount.findFirst({
          where: { id: validated.accountId, businessId: validated.businessId },
          include: { account: true },
        })
        if (!cashAcc) throw new TreasuryAccountNotFoundError(validated.accountId, 'Cash Account')
        if (!cashAcc.accountId) throw new TreasuryError(`Cash account ${cashAcc.name} does not have a mapped GL account.`)
        treasuryAccountId = cashAcc.id
        treasuryGlAccountId = cashAcc.accountId
        currentBalance = new Decimal(cashAcc.balance)
        accountName = cashAcc.name
      } else {
        const bankAcc = await tx.bankAccount.findFirst({
          where: { id: validated.accountId, businessId: validated.businessId },
          include: { account: true },
        })
        if (!bankAcc) throw new TreasuryAccountNotFoundError(validated.accountId, 'Bank Account')
        if (!bankAcc.accountId) throw new TreasuryError(`Bank account ${bankAcc.accountName} does not have a mapped GL account.`)
        treasuryAccountId = bankAcc.id
        treasuryGlAccountId = bankAcc.accountId
        currentBalance = new Decimal(bankAcc.balance)
        accountName = `${bankAcc.bankName} - ${bankAcc.accountName}`
      }

      // 2. Fetch offset GL account
      const offsetGl = await tx.chartOfAccount.findFirst({
        where: { id: validated.offsetAccountId, businessId: validated.businessId },
      })
      if (!offsetGl) {
        throw new TreasuryError(`Offset GL account ${validated.offsetAccountId} not found in this business.`)
      }

      // 3. Determine debit/credit orientation and new balance
      // Inflow types: cash_deposit, bank_deposit, interest_income -> Debit Treasury GL, Credit Offset GL
      // Outflow types: cash_withdrawal, bank_withdrawal, bank_fee, interest_expense -> Debit Offset GL, Credit Treasury GL
      const isInflow = ['cash_deposit', 'bank_deposit', 'interest_income'].includes(validated.type)
      const newBalance = isInflow ? currentBalance.plus(amount) : currentBalance.minus(amount)

      let debitAccountId: string
      let creditAccountId: string
      let debitDescription: string
      let creditDescription: string

      if (isInflow) {
        debitAccountId = treasuryGlAccountId
        creditAccountId = validated.offsetAccountId
        debitDescription = `${validated.type.replace('_', ' ').toUpperCase()} into ${accountName}: ${validated.description}`
        creditDescription = `Offset for ${validated.type.replace('_', ' ')}: ${validated.description}`
      } else {
        debitAccountId = validated.offsetAccountId
        creditAccountId = treasuryGlAccountId
        debitDescription = `Expense/charge for ${validated.type.replace('_', ' ')}: ${validated.description}`
        creditDescription = `${validated.type.replace('_', ' ').toUpperCase()} from ${accountName}: ${validated.description}`
      }

      // 4. Post balanced journal entry via AccountingService
      const entryNumber = await DocumentNumberingService.generateNumber(validated.businessId, 'journal_entry', tx)
      const journalEntry = await AccountingService.postJournalEntry(
        {
          businessId: validated.businessId,
          entryNumber,
          entryDate: validated.transactionDate,
          description: `Treasury: ${validated.type.replace('_', ' ').toUpperCase()} - ${validated.description}`,
          currencyCode: validated.currencyCode,
          exchangeRate: validated.exchangeRate,
          reference: validated.reference,
          sourceType: 'treasury_transaction',
          sourceId: treasuryAccountId,
          lines: [
            {
              accountId: debitAccountId,
              debitAmount: validated.amount,
              creditAmount: 0,
              description: debitDescription,
            },
            {
              accountId: creditAccountId,
              debitAmount: 0,
              creditAmount: validated.amount,
              description: creditDescription,
            },
          ],
          userId: validated.userId,
        },
        tx
      )

      // 5. Update treasury account balance and record transaction
      let transactionRecord: any
      const txTypeEnum = isInflow ? 'deposit' : 'withdrawal'

      if (validated.accountType === 'cash') {
        await tx.cashAccount.update({
          where: { id: treasuryAccountId },
          data: { balance: newBalance },
        })

        transactionRecord = await tx.cashTransaction.create({
          data: {
            cashAccountId: treasuryAccountId,
            businessId: validated.businessId,
            type: txTypeEnum,
            amount,
            balanceAfter: newBalance,
            description: validated.description,
            reference: validated.reference,
            sourceType: validated.type,
            journalEntryId: journalEntry.id,
            transactionDate: validated.transactionDate,
          },
        })
      } else {
        await tx.bankAccount.update({
          where: { id: treasuryAccountId },
          data: { balance: newBalance },
        })

        transactionRecord = await tx.bankTransaction.create({
          data: {
            bankAccountId: treasuryAccountId,
            businessId: validated.businessId,
            type: txTypeEnum,
            amount,
            balanceAfter: newBalance,
            description: validated.description,
            reference: validated.reference,
            sourceType: validated.type,
            journalEntryId: journalEntry.id,
            transactionDate: validated.transactionDate,
          },
        })
      }

      // 6. Audit logging
      await AuditService.log(
        {
          businessId: validated.businessId,
          userId: validated.userId,
          entityType: validated.accountType === 'cash' ? 'cash_transaction' : 'bank_transaction',
          entityId: transactionRecord.id,
          action: 'post',
          newData: {
            type: validated.type,
            amount: validated.amount,
            account: accountName,
            journalEntryId: journalEntry.id,
            balanceAfter: newBalance.toNumber(),
          },
        },
        tx
      )

      return {
        transaction: transactionRecord,
        journalEntry,
        newBalance: newBalance.toNumber(),
      }
    })
  }

  static async getTransactions(
    businessId: string,
    filter?: {
      accountType?: 'cash' | 'bank'
      accountId?: string
      startDate?: Date
      endDate?: Date
      limit?: number
    }
  ) {
    const limit = filter?.limit || 50

    if (filter?.accountType === 'cash') {
      const where: any = { businessId }
      if (filter?.accountId) where.cashAccountId = filter.accountId
      if (filter?.startDate || filter?.endDate) {
        where.transactionDate = {}
        if (filter.startDate) where.transactionDate.gte = filter.startDate
        if (filter.endDate) where.transactionDate.lte = filter.endDate
      }

      return prisma.cashTransaction.findMany({
        where,
        include: { cashAccount: true },
        orderBy: { transactionDate: 'desc' },
        take: limit,
      })
    }

    if (filter?.accountType === 'bank') {
      const where: any = { businessId }
      if (filter?.accountId) where.bankAccountId = filter.accountId
      if (filter?.startDate || filter?.endDate) {
        where.transactionDate = {}
        if (filter.startDate) where.transactionDate.gte = filter.startDate
        if (filter.endDate) where.transactionDate.lte = filter.endDate
      }

      return prisma.bankTransaction.findMany({
        where,
        include: { bankAccount: true },
        orderBy: { transactionDate: 'desc' },
        take: limit,
      })
    }

    // Both
    const [cashTx, bankTx] = await Promise.all([
      prisma.cashTransaction.findMany({
        where: { businessId },
        include: { cashAccount: true },
        orderBy: { transactionDate: 'desc' },
        take: limit,
      }),
      prisma.bankTransaction.findMany({
        where: { businessId },
        include: { bankAccount: true },
        orderBy: { transactionDate: 'desc' },
        take: limit,
      }),
    ])

    return { cashTransactions: cashTx, bankTransactions: bankTx }
  }
}
