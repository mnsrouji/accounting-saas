// =============================================================
// Treasury Account Service — Cash, Bank & Petty Cash Management
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  createCashAccountSchema,
  updateCashAccountSchema,
  createBankAccountSchema,
  updateBankAccountSchema,
  CreateCashAccountInput,
  UpdateCashAccountInput,
  CreateBankAccountInput,
  UpdateBankAccountInput,
} from '@/lib/validations/treasury-schemas'
import { TreasuryAccountNotFoundError, TreasuryError } from '@/lib/errors/treasury-error'
import { AuditService } from './audit-service'
import { AccountingService } from './accounting-service'
import { DocumentNumberingService } from './document-numbering-service'

export class TreasuryAccountService {
  /**
   * Synchronize cash and bank account balances with posted General Ledger journal lines.
   */
  static async syncTreasuryBalances(businessId: string) {
    const [cashAccounts, bankAccounts] = await Promise.all([
      prisma.cashAccount.findMany({
        where: { businessId },
        include: {
          account: {
            include: {
              journalLines: {
                where: { businessId, journalEntry: { status: 'posted' } },
              },
            },
          },
        },
      }),
      prisma.bankAccount.findMany({
        where: { businessId },
        include: {
          account: {
            include: {
              journalLines: {
                where: { businessId, journalEntry: { status: 'posted' } },
              },
            },
          },
        },
      }),
    ])

    for (const ca of cashAccounts) {
      if (ca.account && ca.account.journalLines && ca.account.journalLines.length > 0) {
        const totalDebit = ca.account.journalLines.reduce((acc, l) => acc.plus(new Decimal(l.debitAmount)), new Decimal(0))
        const totalCredit = ca.account.journalLines.reduce((acc, l) => acc.plus(new Decimal(l.creditAmount)), new Decimal(0))
        const netGl = totalDebit.minus(totalCredit)
        if (!new Decimal(ca.balance).equals(netGl)) {
          await prisma.cashAccount.update({
            where: { id: ca.id },
            data: { balance: netGl },
          })
        }
      }
    }

    for (const ba of bankAccounts) {
      if (ba.account && ba.account.journalLines && ba.account.journalLines.length > 0) {
        const totalDebit = ba.account.journalLines.reduce((acc, l) => acc.plus(new Decimal(l.debitAmount)), new Decimal(0))
        const totalCredit = ba.account.journalLines.reduce((acc, l) => acc.plus(new Decimal(l.creditAmount)), new Decimal(0))
        const netGl = totalDebit.minus(totalCredit)
        if (!new Decimal(ba.balance).equals(netGl)) {
          await prisma.bankAccount.update({
            where: { id: ba.id },
            data: { balance: netGl },
          })
        }
      }
    }
  }

  /**
   * Helper to find or create an Opening Balance Equity account
   */
  private static async getOpeningBalanceEquityAccount(businessId: string, tx?: any): Promise<string> {
    const client = tx ?? prisma
    let account = await client.chartOfAccount.findFirst({
      where: {
        businessId,
        type: 'equity',
        code: { in: ['3900', '3000', '3999'] },
      },
    })

    if (!account) {
      account = await client.chartOfAccount.findFirst({
        where: { businessId, type: 'equity' },
      })
    }

    if (!account) {
      account = await client.chartOfAccount.create({
        data: {
          businessId,
          code: '3900',
          name: 'Opening Balance Equity',
          type: 'equity',
          normalBalance: 'credit',
          isSystem: true,
          isActive: true,
        },
      })
    }

    return account.id
  }

  // -----------------------------------------------------------
  // Cash Accounts
  // -----------------------------------------------------------

  static async createCashAccount(input: CreateCashAccountInput) {
    const validated = createCashAccountSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      // 1. Verify mapped GL account
      const glAccount = await tx.chartOfAccount.findFirst({
        where: { id: validated.accountId, businessId: validated.businessId },
      })

      if (!glAccount) {
        throw new TreasuryError(`GL Chart of Account ${validated.accountId} was not found or is outside business tenant.`)
      }

      // 2. Default code if absent
      const count = await tx.cashAccount.count({ where: { businessId: validated.businessId } })
      const prefix = validated.isPettyCash ? 'PETTY' : 'CSH'
      const code = validated.code || `${prefix}-${String(count + 1).padStart(3, '0')}`

      // 3. Create cash account record
      const cashAccount = await tx.cashAccount.create({
        data: {
          businessId: validated.businessId,
          name: validated.name,
          code,
          currencyCode: validated.currencyCode,
          openingBalance: new Decimal(validated.openingBalance),
          balance: new Decimal(validated.openingBalance),
          accountId: validated.accountId,
          isDefault: validated.isDefault,
          isActive: validated.isActive,
          isPettyCash: validated.isPettyCash,
          custodianId: validated.custodianId,
          targetFloat: validated.targetFloat ? new Decimal(validated.targetFloat) : null,
        },
        include: { account: true, custodian: true },
      })

      // 4. If opening balance > 0, post accounting journal entry through AccountingService
      if (new Decimal(validated.openingBalance).gt(0)) {
        const equityAccountId = await this.getOpeningBalanceEquityAccount(validated.businessId, tx)
        const entryNumber = await DocumentNumberingService.generateNumber(validated.businessId, 'journal_entry', tx)

        await AccountingService.postJournalEntry(
          {
            businessId: validated.businessId,
            entryNumber,
            entryDate: new Date(),
            description: `Opening Balance for Cash Account: ${validated.name}`,
            currencyCode: validated.currencyCode,
            exchangeRate: 1,
            sourceType: 'opening_balance',
            sourceId: cashAccount.id,
            lines: [
              {
                accountId: validated.accountId,
                debitAmount: validated.openingBalance,
                creditAmount: 0,
                description: `Opening cash balance: ${validated.name}`,
              },
              {
                accountId: equityAccountId,
                debitAmount: 0,
                creditAmount: validated.openingBalance,
                description: `Opening balance equity offset`,
              },
            ],
            userId: validated.userId,
          },
          tx
        )
      }

      // 5. Audit logging
      await AuditService.log(
        {
          businessId: validated.businessId,
          userId: validated.userId,
          entityType: 'cash_account',
          entityId: cashAccount.id,
          action: 'create',
          newData: { name: cashAccount.name, code: cashAccount.code, openingBalance: validated.openingBalance, isPettyCash: validated.isPettyCash },
        },
        tx
      )

      return cashAccount
    })
  }

  static async updateCashAccount(id: string, input: UpdateCashAccountInput) {
    const validated = updateCashAccountSchema.parse(input)

    const existing = await prisma.cashAccount.findFirst({
      where: { id, businessId: validated.businessId },
    })

    if (!existing) {
      throw new TreasuryAccountNotFoundError(id, 'Cash Account')
    }

    if (validated.accountId) {
      const glAccount = await prisma.chartOfAccount.findFirst({
        where: { id: validated.accountId, businessId: validated.businessId },
      })
      if (!glAccount) {
        throw new TreasuryError(`GL Chart of Account ${validated.accountId} not found in this business.`)
      }
    }

    const updated = await prisma.cashAccount.update({
      where: { id },
      data: {
        name: validated.name ?? undefined,
        code: validated.code ?? undefined,
        accountId: validated.accountId ?? undefined,
        isDefault: validated.isDefault ?? undefined,
        isActive: validated.isActive ?? undefined,
        custodianId: validated.custodianId !== undefined ? validated.custodianId : undefined,
        targetFloat: validated.targetFloat !== undefined ? (validated.targetFloat ? new Decimal(validated.targetFloat) : null) : undefined,
      },
      include: { account: true, custodian: true },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId: validated.userId,
      entityType: 'cash_account',
      entityId: id,
      action: 'update',
      oldData: { name: existing.name, isActive: existing.isActive },
      newData: { name: updated.name, isActive: updated.isActive },
    })

    return updated
  }

  static async getCashAccounts(businessId: string, filter?: { isActive?: boolean; isPettyCash?: boolean }) {
    const where: any = { businessId }
    if (filter?.isActive !== undefined) where.isActive = filter.isActive
    if (filter?.isPettyCash !== undefined) where.isPettyCash = filter.isPettyCash

    return prisma.cashAccount.findMany({
      where,
      include: { account: true, custodian: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  static async getCashAccountById(businessId: string, id: string) {
    const account = await prisma.cashAccount.findFirst({
      where: { id, businessId },
      include: {
        account: true,
        custodian: true,
        transactions: { orderBy: { transactionDate: 'desc' }, take: 50 },
      },
    })
    if (!account) {
      throw new TreasuryAccountNotFoundError(id, 'Cash Account')
    }
    return account
  }

  // -----------------------------------------------------------
  // Bank Accounts
  // -----------------------------------------------------------

  static async createBankAccount(input: CreateBankAccountInput) {
    const validated = createBankAccountSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      // 1. Verify mapped GL account
      const glAccount = await tx.chartOfAccount.findFirst({
        where: { id: validated.accountId, businessId: validated.businessId },
      })

      if (!glAccount) {
        throw new TreasuryError(`GL Chart of Account ${validated.accountId} was not found or is outside business tenant.`)
      }

      // 2. Default code if absent
      const count = await tx.bankAccount.count({ where: { businessId: validated.businessId } })
      const code = validated.code || `BNK-${String(count + 1).padStart(3, '0')}`

      // 3. Create bank account record
      const bankAccount = await tx.bankAccount.create({
        data: {
          businessId: validated.businessId,
          bankName: validated.bankName,
          accountName: validated.accountName,
          code,
          accountNumber: validated.accountNumber,
          iban: validated.iban,
          swift: validated.swift,
          branch: validated.branch,
          currencyCode: validated.currencyCode,
          openingBalance: new Decimal(validated.openingBalance),
          balance: new Decimal(validated.openingBalance),
          accountId: validated.accountId,
          isDefault: validated.isDefault,
          isActive: validated.isActive,
        },
        include: { account: true },
      })

      // 4. If opening balance > 0, post accounting journal entry through AccountingService
      if (new Decimal(validated.openingBalance).gt(0)) {
        const equityAccountId = await this.getOpeningBalanceEquityAccount(validated.businessId, tx)
        const entryNumber = await DocumentNumberingService.generateNumber(validated.businessId, 'journal_entry', tx)

        await AccountingService.postJournalEntry(
          {
            businessId: validated.businessId,
            entryNumber,
            entryDate: new Date(),
            description: `Opening Balance for Bank Account: ${validated.bankName} - ${validated.accountName}`,
            currencyCode: validated.currencyCode,
            exchangeRate: 1,
            sourceType: 'opening_balance',
            sourceId: bankAccount.id,
            lines: [
              {
                accountId: validated.accountId,
                debitAmount: validated.openingBalance,
                creditAmount: 0,
                description: `Opening bank balance: ${validated.accountName}`,
              },
              {
                accountId: equityAccountId,
                debitAmount: 0,
                creditAmount: validated.openingBalance,
                description: `Opening balance equity offset`,
              },
            ],
            userId: validated.userId,
          },
          tx
        )
      }

      // 5. Audit logging
      await AuditService.log(
        {
          businessId: validated.businessId,
          userId: validated.userId,
          entityType: 'bank_account',
          entityId: bankAccount.id,
          action: 'create',
          newData: { bankName: bankAccount.bankName, accountName: bankAccount.accountName, openingBalance: validated.openingBalance },
        },
        tx
      )

      return bankAccount
    })
  }

  static async updateBankAccount(id: string, input: UpdateBankAccountInput) {
    const validated = updateBankAccountSchema.parse(input)

    const existing = await prisma.bankAccount.findFirst({
      where: { id, businessId: validated.businessId },
    })

    if (!existing) {
      throw new TreasuryAccountNotFoundError(id, 'Bank Account')
    }

    if (validated.accountId) {
      const glAccount = await prisma.chartOfAccount.findFirst({
        where: { id: validated.accountId, businessId: validated.businessId },
      })
      if (!glAccount) {
        throw new TreasuryError(`GL Chart of Account ${validated.accountId} not found in this business.`)
      }
    }

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: {
        bankName: validated.bankName ?? undefined,
        accountName: validated.accountName ?? undefined,
        code: validated.code ?? undefined,
        accountNumber: validated.accountNumber ?? undefined,
        iban: validated.iban ?? undefined,
        swift: validated.swift ?? undefined,
        branch: validated.branch ?? undefined,
        accountId: validated.accountId ?? undefined,
        isDefault: validated.isDefault ?? undefined,
        isActive: validated.isActive ?? undefined,
      },
      include: { account: true },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId: validated.userId,
      entityType: 'bank_account',
      entityId: id,
      action: 'update',
      oldData: { bankName: existing.bankName, accountName: existing.accountName },
      newData: { bankName: updated.bankName, accountName: updated.accountName },
    })

    return updated
  }

  static async getBankAccounts(businessId: string, filter?: { isActive?: boolean }) {
    const where: any = { businessId }
    if (filter?.isActive !== undefined) where.isActive = filter.isActive

    return prisma.bankAccount.findMany({
      where,
      include: { account: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  static async getBankAccountById(businessId: string, id: string) {
    const account = await prisma.bankAccount.findFirst({
      where: { id, businessId },
      include: {
        account: true,
        transactions: { orderBy: { transactionDate: 'desc' }, take: 50 },
        statements: { orderBy: { startDate: 'desc' }, take: 10 },
      },
    })
    if (!account) {
      throw new TreasuryAccountNotFoundError(id, 'Bank Account')
    }
    return account
  }
}
