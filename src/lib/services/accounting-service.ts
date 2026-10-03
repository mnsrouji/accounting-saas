// =============================================================
// Accounting Service & General Ledger Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  postJournalEntrySchema,
  reverseJournalEntrySchema,
  updateJournalEntrySchema,
  PostJournalEntryInput,
  ReverseJournalEntryInput,
  UpdateJournalEntryInput,
} from '@/lib/validations/accounting-schemas'
import {
  UnbalancedJournalError,
  AlreadyPostedError,
  InvalidReversalError,
  TenantAccessDeniedError,
  AccountingError,
} from '@/lib/errors/accounting-error'
import { AccountingPeriodService } from './accounting-period-service'

export class AccountingService {
  /**
   * Post a balanced journal entry atomically.
   *
   * Built-in guards (in order):
   * 1. Fiscal period lock check — rejects entries in closed/locked periods
   * 2. Double-entry balance check — rejects unbalanced entries (tolerance 0.0001)
   * 3. DB write — creates entry + lines and sets status='posted'
   */
  static async postJournalEntry(input: PostJournalEntryInput, txPrisma?: any) {
    const validated = postJournalEntrySchema.parse(input)
    const client = txPrisma || prisma

    // GUARD 1: Fiscal Period Lock
    // Check before any balance calculations or DB writes.
    // This uses the same Prisma client context (tx or root) so the check is
    // consistent within the same transaction.
    await AccountingPeriodService.checkPeriodOpen(
      validated.businessId,
      new Date(validated.entryDate),
      client
    )

    const rate = new Decimal(validated.exchangeRate)

    // 1. Calculate Base Debits & Base Credits sum across all lines
    let totalBaseDebit = new Decimal(0)
    let totalBaseCredit = new Decimal(0)
    let isSingleCurrency = true
    const firstLineCurrency = validated.lines[0]?.currencyCode || validated.currencyCode

    const processedLines = validated.lines.map((line) => {
      const lineCurrency = (line.currencyCode || validated.currencyCode).toUpperCase()
      const lineRate = line.exchangeRate ? new Decimal(line.exchangeRate) : rate
      const d = new Decimal(line.debitAmount)
      const c = new Decimal(line.creditAmount)
      const baseD = d.mul(lineRate)
      const baseC = c.mul(lineRate)

      totalBaseDebit = totalBaseDebit.plus(baseD)
      totalBaseCredit = totalBaseCredit.plus(baseC)

      if (lineCurrency !== firstLineCurrency) {
        isSingleCurrency = false
      }

      return {
        ...line,
        currencyCode: lineCurrency,
        exchangeRate: lineRate,
        debitAmount: d,
        creditAmount: c,
        baseDebit: baseD,
        baseCredit: baseC,
      }
    })

    const baseVariance = totalBaseDebit.minus(totalBaseCredit).abs()
    if (baseVariance.gt(0.0001)) {
      throw new UnbalancedJournalError(
        validated.entryNumber,
        totalBaseDebit.toNumber(),
        totalBaseCredit.toNumber()
      )
    }

    // If single currency, also check transaction currency balance
    if (isSingleCurrency) {
      const totalDebit = processedLines.reduce((s, l) => s.plus(l.debitAmount), new Decimal(0))
      const totalCredit = processedLines.reduce((s, l) => s.plus(l.creditAmount), new Decimal(0))
      if (!totalDebit.minus(totalCredit).abs().lte(0.0001)) {
        throw new UnbalancedJournalError(
          validated.entryNumber,
          totalDebit.toNumber(),
          totalCredit.toNumber()
        )
      }
    }

    // Execute in transaction
    const execute = async (tx: any) => {
      // Create journal entry in draft first
      const entry = await tx.journalEntry.create({
        data: {
          businessId: validated.businessId,
          entryNumber: validated.entryNumber,
          entryDate: validated.entryDate,
          description: validated.description,
          currencyCode: validated.currencyCode,
          exchangeRate: rate,
          reference: validated.reference,
          sourceType: validated.sourceType,
          sourceId: validated.sourceId,
          reversedEntryId: validated.reversedEntryId,
          status: 'draft',
          createdBy: validated.userId,
        },
      })

      // Insert lines
      let order = 1
      for (const line of processedLines) {
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: entry.id,
            businessId: validated.businessId,
            accountId: line.accountId,
            description: line.description || validated.description,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            currencyCode: line.currencyCode,
            exchangeRate: line.exchangeRate,
            baseDebit: line.baseDebit,
            baseCredit: line.baseCredit,
            customerId: line.customerId,
            supplierId: line.supplierId,
            productId: line.productId,
            lineOrder: order++,
          },
        })
      }

      // Update status to 'posted' — invokes PostgreSQL trigger verify_journal_balance_before_post
      const postedEntry = await tx.journalEntry.update({
        where: { id: entry.id },
        data: {
          status: 'posted',
          postedAt: new Date(),
          postedBy: validated.userId,
        },
        include: { lines: { include: { account: true } } },
      })

      return postedEntry
    }

    return txPrisma ? execute(txPrisma) : prisma.$transaction(execute)
  }

  /**
   * Reverse a posted journal entry atomically.
   * Creates an exact inverse entry (swaps Debits & Credits) and updates status to 'reversed'.
   */
  static async reverseJournalEntry(input: ReverseJournalEntryInput) {
    const validated = reverseJournalEntrySchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const original = await tx.journalEntry.findFirst({
        where: { id: validated.journalEntryId, businessId: validated.businessId },
        include: { lines: true },
      })

      if (!original) {
        throw new TenantAccessDeniedError('Journal Entry')
      }

      if (original.status !== 'posted') {
        throw new InvalidReversalError(
          `Journal Entry ${original.entryNumber} cannot be reversed because its status is '${original.status}'. Only posted entries can be reversed.`
        )
      }

      // Prepare inverse lines
      const inverseLines = original.lines.map((l) => ({
        accountId: l.accountId,
        description: `Reversal of ${original.entryNumber}: ${validated.reason}`,
        debitAmount: new Decimal(l.creditAmount).toNumber(), // Swap!
        creditAmount: new Decimal(l.debitAmount).toNumber(), // Swap!
        customerId: l.customerId || undefined,
        supplierId: l.supplierId || undefined,
        productId: l.productId || undefined,
      }))

      // Create & post reversal entry
      const reversalInput: PostJournalEntryInput = {
        businessId: validated.businessId,
        entryNumber: validated.reversalEntryNumber,
        entryDate: validated.reversalDate,
        description: `Reversal Entry for ${original.entryNumber} - ${validated.reason}`,
        currencyCode: original.currencyCode,
        exchangeRate: new Decimal(original.exchangeRate).toNumber(),
        reference: original.reference || undefined,
        sourceType: original.sourceType || 'manual',
        sourceId: original.sourceId || undefined,
        reversedEntryId: original.id,
        lines: inverseLines,
        userId: validated.userId,
      }

      // Mark original entry status as 'reversed'
      await tx.journalEntry.update({
        where: { id: original.id },
        data: {
          status: 'reversed',
          voidedAt: new Date(),
          voidedBy: validated.userId,
          voidReason: validated.reason,
        },
      })

      const reversalEntry = await this.postJournalEntry(reversalInput, tx)

      return reversalEntry
    })
  }

  /**
   * Update an existing journal entry atomically.
   *
   * ACCOUNTING IMMUTABILITY RULE:
   * Only draft journal entries may be edited.
   * Posted entries are immutable — to correct a posted entry, use reverseJournalEntry()
   * to create an exact inverse, then post a new correcting entry.
   * This preserves the integrity of the audit trail and accounting history.
   */
  static async updateJournalEntry(input: UpdateJournalEntryInput) {
    const validated = updateJournalEntrySchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const existing = await tx.journalEntry.findFirst({
        where: { id: validated.journalEntryId, businessId: validated.businessId },
      })

      if (!existing) {
        throw new TenantAccessDeniedError('Journal Entry')
      }

      // CRITICAL: Prevent modification of posted or reversed entries.
      // Posted journal entries are part of the permanent accounting record and cannot be altered.
      // To fix a posted entry: reverse it first, then post a new correcting entry.
      if (existing.status === 'posted') {
        throw new AccountingError(
          `لا يمكن تعديل القيد "${existing.entryNumber}" مباشرةً لأنه مرحَّل (Posted). ` +
          `لتصحيح هذا القيد: استخدم "عكس القيد" لإنشاء قيد عكسي، ثم أنشئ قيداً تصحيحياً جديداً. ` +
          `(Cannot edit a posted entry. Use Reverse Entry then create a new correcting entry.)`
        )
      }

      if (existing.status === 'reversed') {
        throw new AccountingError('لا يمكن تعديل قيد تم عكسه (Reversed).')
      }

      const entryCurrency = (validated.currencyCode || existing.currencyCode || 'USD').toUpperCase()
      const rate = validated.exchangeRate ? new Decimal(validated.exchangeRate) : new Decimal(existing.exchangeRate || 1)

      // 1. Calculate Base Debits & Base Credits sum across all lines
      let totalBaseDebit = new Decimal(0)
      let totalBaseCredit = new Decimal(0)
      let isSingleCurrency = true
      const firstLineCurrency = validated.lines[0]?.currencyCode || entryCurrency

      const processedLines = validated.lines.map((line) => {
        const lineCurrency = (line.currencyCode || entryCurrency).toUpperCase()
        const lineRate = line.exchangeRate ? new Decimal(line.exchangeRate) : rate
        const d = new Decimal(line.debitAmount || 0)
        const c = new Decimal(line.creditAmount || 0)
        const baseD = d.mul(lineRate)
        const baseC = c.mul(lineRate)

        totalBaseDebit = totalBaseDebit.plus(baseD)
        totalBaseCredit = totalBaseCredit.plus(baseC)

        if (lineCurrency !== firstLineCurrency) {
          isSingleCurrency = false
        }

        return {
          ...line,
          currencyCode: lineCurrency,
          exchangeRate: lineRate,
          debitAmount: d,
          creditAmount: c,
          baseDebit: baseD,
          baseCredit: baseC,
        }
      })

      const baseVariance = totalBaseDebit.minus(totalBaseCredit).abs()
      if (baseVariance.gt(0.0001) || totalBaseDebit.isZero()) {
        throw new UnbalancedJournalError(
          existing.entryNumber,
          totalBaseDebit.toNumber(),
          totalBaseCredit.toNumber()
        )
      }

      if (isSingleCurrency) {
        const totalDebit = processedLines.reduce((s, l) => s.plus(l.debitAmount), new Decimal(0))
        const totalCredit = processedLines.reduce((s, l) => s.plus(l.creditAmount), new Decimal(0))
        if (!totalDebit.minus(totalCredit).abs().lte(0.0001)) {
          throw new UnbalancedJournalError(
            existing.entryNumber,
            totalDebit.toNumber(),
            totalCredit.toNumber()
          )
        }
      }

      // 1. Delete existing lines
      await tx.journalEntryLine.deleteMany({
        where: { journalEntryId: existing.id },
      })

      // 2. Insert new lines
      let order = 1
      for (const line of processedLines) {
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: existing.id,
            businessId: validated.businessId,
            accountId: line.accountId,
            description: line.description || validated.description || existing.description,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            currencyCode: line.currencyCode,
            exchangeRate: line.exchangeRate,
            baseDebit: line.baseDebit,
            baseCredit: line.baseCredit,
            customerId: line.customerId || null,
            supplierId: line.supplierId || null,
            productId: line.productId || null,
            lineOrder: order++,
          },
        })
      }

      // 3. Update entry header and ensure posted
      const updatedEntry = await tx.journalEntry.update({
        where: { id: existing.id },
        data: {
          entryDate: validated.entryDate,
          description: validated.description,
          currencyCode: entryCurrency,
          exchangeRate: rate,
          reference: validated.reference || null,
          status: 'posted',
          postedAt: new Date(),
          postedBy: validated.userId,
        },
        include: { lines: { include: { account: true } } },
      })

      return updatedEntry
    })
  }

  /**
   * Delete a journal entry atomically.
   */
  static async deleteJournalEntry(businessId: string, journalEntryId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      // Temporarily set session_replication_role to replica to allow audit deletes in this transaction
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'replica';")

      const existing = await tx.journalEntry.findFirst({
        where: { id: journalEntryId, businessId },
        include: {
          reversingEntries: true,
        },
      })

      if (!existing) {
        throw new TenantAccessDeniedError('Journal Entry')
      }

      if (existing.reversingEntries && existing.reversingEntries.length > 0) {
        throw new AccountingError(
          'لا يمكن حذف هذا القيد لأنه مرتبط بقيود عكسية مسجلة في النظام.'
        )
      }

      // 1. Delete lines
      await tx.journalEntryLine.deleteMany({
        where: { journalEntryId: existing.id },
      })

      // 2. Delete entry
      await tx.journalEntry.delete({
        where: { id: existing.id },
      })

      return { id: existing.id, entryNumber: existing.entryNumber }
    })
  }

  /**
   * General Ledger query with running balance for a specific account.
   */
  static async getGeneralLedger(
    businessId: string,
    accountId: string,
    fromDate?: Date,
    toDate?: Date
  ) {
    const account = await prisma.chartOfAccount.findFirst({
      where: { id: accountId, businessId },
    })

    if (!account) {
      throw new TenantAccessDeniedError('Chart of Account')
    }

    const where: any = {
      businessId,
      accountId,
      journalEntry: { status: 'posted' },
    }

    if (fromDate || toDate) {
      where.journalEntry.entryDate = {}
      if (fromDate) where.journalEntry.entryDate.gte = fromDate
      if (toDate) where.journalEntry.entryDate.lte = toDate
    }

    const lines = await prisma.journalEntryLine.findMany({
      where,
      include: {
        journalEntry: true,
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      orderBy: [
        { journalEntry: { entryDate: 'asc' } },
        { lineOrder: 'asc' },
      ],
    })

    let runningBalance = new Decimal(0)
    const isDebitNormal = account.normalBalance === 'debit'

    const ledgerEntries = lines.map((line) => {
      const d = new Decimal(line.debitAmount)
      const c = new Decimal(line.creditAmount)

      if (isDebitNormal) {
        runningBalance = runningBalance.plus(d).minus(c)
      } else {
        runningBalance = runningBalance.plus(c).minus(d)
      }

      return {
        id: line.id,
        entryNumber: line.journalEntry.entryNumber,
        entryDate: line.journalEntry.entryDate,
        description: line.description || line.journalEntry.description,
        debit: d.toNumber(),
        credit: c.toNumber(),
        runningBalance: runningBalance.toNumber(),
        partyName: line.customer?.name || line.supplier?.name || null,
      }
    })

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        normalBalance: account.normalBalance,
      },
      entries: ledgerEntries,
      endingBalance: runningBalance.toNumber(),
    }
  }

  /**
   * Trial Balance report summarizing debits, credits, and net balances for all accounts.
   * Optimized with single groupBy query (O(1) database roundtrips) instead of N+1 loop.
   */
  static async getTrialBalance(businessId: string, asOfDate?: Date) {
    const accounts = await prisma.chartOfAccount.findMany({
      where: { businessId, isActive: true },
      orderBy: { code: 'asc' },
    })

    const dateFilter = asOfDate ? { lte: asOfDate } : undefined

    // 1 single aggregate query for ALL accounts in the business
    const lineAggs = await prisma.journalEntryLine.groupBy({
      by: ['accountId'],
      where: {
        businessId,
        journalEntry: {
          status: 'posted',
          ...(dateFilter ? { entryDate: dateFilter } : {}),
        },
      },
      _sum: {
        baseDebit: true,
        baseCredit: true,
      },
    })

    const aggMap = new Map<string, { debit: Decimal; credit: Decimal }>()
    for (const agg of lineAggs) {
      aggMap.set(agg.accountId, {
        debit: new Decimal(agg._sum.baseDebit?.toString() || 0),
        credit: new Decimal(agg._sum.baseCredit?.toString() || 0),
      })
    }

    const result = []
    let totalDebitSum = new Decimal(0)
    let totalCreditSum = new Decimal(0)

    for (const acc of accounts) {
      const agg = aggMap.get(acc.id) || { debit: new Decimal(0), credit: new Decimal(0) }
      const debitSum = agg.debit
      const creditSum = agg.credit

      let netDebit = new Decimal(0)
      let netCredit = new Decimal(0)

      if (acc.normalBalance === 'debit') {
        const net = debitSum.minus(creditSum)
        if (net.gte(0)) {
          netDebit = net
        } else {
          netCredit = net.abs()
        }
      } else {
        const net = creditSum.minus(debitSum)
        if (net.gte(0)) {
          netCredit = net
        } else {
          netDebit = net.abs()
        }
      }

      totalDebitSum = totalDebitSum.plus(netDebit)
      totalCreditSum = totalCreditSum.plus(netCredit)

      result.push({
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        normalBalance: acc.normalBalance,
        totalDebit: debitSum.toNumber(),
        totalCredit: creditSum.toNumber(),
        netDebit: netDebit.toNumber(),
        netCredit: netCredit.toNumber(),
      })
    }

    return {
      asOfDate: asOfDate || new Date(),
      accounts: result,
      totalNetDebit: totalDebitSum.toNumber(),
      totalNetCredit: totalCreditSum.toNumber(),
      isBalanced: totalDebitSum.equals(totalCreditSum),
    }
  }

  /**
   * Idempotently ensure the business has the standard Chart of Accounts.
   * If any standard account is missing, it is created and properly linked to its parent.
   */
  static async ensureStandardChartOfAccounts(businessId: string, txPrisma?: any) {
    const client = txPrisma || prisma
    const existing = await client.chartOfAccount.findMany({
      where: { businessId },
      select: { id: true, code: true, parentId: true },
    })
    const existingCodeMap = new Map<string, { id: string; parentId: string | null }>(
      existing.map((a: { id: string; code: string; parentId: string | null }) => [a.code, a])
    )

    // 1. Create missing accounts
    const toCreate = DEFAULT_CHART_OF_ACCOUNTS.filter((acc) => !existingCodeMap.has(acc.code))
    if (toCreate.length > 0) {
      await client.chartOfAccount.createMany({
        data: toCreate.map((account) => ({
          businessId,
          code: account.code,
          name: account.name,
          type: account.type,
          normalBalance: account.normalBalance,
          isHeader: account.isHeader ?? false,
          isSystem: account.isSystem ?? false,
          sortOrder: account.sortOrder,
        })),
        skipDuplicates: true,
      })
    }

    // 2. Fetch all accounts again to establish parent-child relationships (parentId)
    const allAccounts = await client.chartOfAccount.findMany({
      where: { businessId },
      select: { id: true, code: true, parentId: true },
    })
    const codeToIdMap = new Map<string, string>(
      allAccounts.map((a: { id: string; code: string }) => [a.code, a.id])
    )

    // 3. Link parentId for any account defined in DEFAULT_CHART_OF_ACCOUNTS that lacks parentId
    for (const def of DEFAULT_CHART_OF_ACCOUNTS) {
      if (def.parentCode) {
        const currentId = codeToIdMap.get(def.code)
        const parentId = codeToIdMap.get(def.parentCode)
        const currentAcc = allAccounts.find((a: { id: string; code: string; parentId: string | null }) => a.code === def.code)

        if (currentId && parentId && (!currentAcc?.parentId || currentAcc.parentId !== parentId)) {
          await client.chartOfAccount.update({
            where: { id: currentId },
            data: { parentId },
          })
        }
      }
    }
  }
}

export interface DefaultAccountDefinition {
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  normalBalance: 'debit' | 'credit'
  isHeader?: boolean
  isSystem?: boolean
  parentCode?: string
  sortOrder: number
}

export const DEFAULT_CHART_OF_ACCOUNTS: DefaultAccountDefinition[] = [
  // ==========================================
  // 1. ASSETS (الأصول - 1000)
  // ==========================================
  { code: '1000', name: 'Assets (الأصول)', type: 'asset', normalBalance: 'debit', isHeader: true, sortOrder: 100 },

  // 1.1 Cash & Bank / النقدية وما في حكمها
  { code: '1100', name: 'Cash and Cash Equivalents (النقدية وما في حكمها)', type: 'asset', normalBalance: 'debit', isHeader: true, parentCode: '1000', sortOrder: 110 },
  { code: '1110', name: 'Main Operating Cash (الصندوق الرئيسي)', type: 'asset', normalBalance: 'debit', isSystem: true, parentCode: '1100', sortOrder: 111 },
  { code: '1120', name: 'Petty Cash Fund (صندوق المصروفات النثرية والعهدة)', type: 'asset', normalBalance: 'debit', isSystem: true, parentCode: '1100', sortOrder: 112 },
  { code: '1200', name: 'Bank Accounts (الحسابات البنكية)', type: 'asset', normalBalance: 'debit', isHeader: true, parentCode: '1000', sortOrder: 120 },
  { code: '1210', name: 'Main Bank Account (الحساب البنكي الرئيسي)', type: 'asset', normalBalance: 'debit', isSystem: true, parentCode: '1200', sortOrder: 121 },

  // 1.2 Receivables / العملاء والذمم المدينة
  { code: '1300', name: 'Accounts Receivable (العملاء والذمم المدينة)', type: 'asset', normalBalance: 'debit', isSystem: true, parentCode: '1000', sortOrder: 130 },

  // 1.3 Inventory / المخزون
  { code: '1400', name: 'Merchandise Inventory (مخزون البضائع)', type: 'asset', normalBalance: 'debit', isSystem: true, parentCode: '1000', sortOrder: 140 },

  // 1.4 Prepayments / المصروفات المدفوعة مقدماً
  { code: '1500', name: 'Prepaid Expenses (المصروفات المدفوعة مقدماً)', type: 'asset', normalBalance: 'debit', parentCode: '1000', sortOrder: 150 },

  // 1.5 Fixed Assets / الأصول الثابتة
  { code: '1600', name: 'Fixed Assets (الأصول الثابتة)', type: 'asset', normalBalance: 'debit', isHeader: true, parentCode: '1000', sortOrder: 160 },
  { code: '1610', name: 'Equipment & Office Furniture (المعدات والأثاث المكتبي)', type: 'asset', normalBalance: 'debit', parentCode: '1600', sortOrder: 161 },
  { code: '1690', name: 'Accumulated Depreciation (مجمع إهلاك الأصول الثابتة)', type: 'asset', normalBalance: 'credit', parentCode: '1600', sortOrder: 169 },

  // ==========================================
  // 2. LIABILITIES (الخصوم والالتزامات - 2000)
  // ==========================================
  { code: '2000', name: 'Liabilities (الخصوم والالتزامات)', type: 'liability', normalBalance: 'credit', isHeader: true, sortOrder: 200 },

  // 2.1 Payables / الموردين والذمم الدائنة
  { code: '2100', name: 'Accounts Payable (الموردون والذمم الدائنة)', type: 'liability', normalBalance: 'credit', isSystem: true, parentCode: '2000', sortOrder: 210 },

  // 2.2 Taxes / الضرائب
  { code: '2200', name: 'Sales Tax / Output VAT Payable (ضريبة المبيعات / القيمة المضافة المستحقة)', type: 'liability', normalBalance: 'credit', isSystem: true, parentCode: '2000', sortOrder: 220 },
  { code: '2210', name: 'Input VAT Recoverable (ضريبة المدخلات القابلة للاسترداد)', type: 'liability', normalBalance: 'debit', isSystem: true, parentCode: '2000', sortOrder: 221 },

  // 2.3 Accruals & Long-term / المصروفات المستحقة والالتزامات الأخرى
  { code: '2300', name: 'Accrued Operating Expenses (المصروفات والالتزامات المستحقة)', type: 'liability', normalBalance: 'credit', parentCode: '2000', sortOrder: 230 },
  { code: '2400', name: 'Long-term Liabilities & Loans (قروض والتزامات طويلة الأجل)', type: 'liability', normalBalance: 'credit', parentCode: '2000', sortOrder: 240 },

  // ==========================================
  // 3. EQUITY (حقوق الملكية - 3000)
  // ==========================================
  { code: '3000', name: 'Equity (حقوق الملكية)', type: 'equity', normalBalance: 'credit', isHeader: true, sortOrder: 300 },
  { code: '3100', name: "Owner's Contributed Capital (رأس المال المدفوع)", type: 'equity', normalBalance: 'credit', isSystem: true, parentCode: '3000', sortOrder: 310 },
  { code: '3200', name: 'Retained Earnings (الأرباح المبقاة / المحتجزة)', type: 'equity', normalBalance: 'credit', isSystem: true, parentCode: '3000', sortOrder: 320 },
  { code: '3300', name: "Owner's Drawings (جاري الشركاء / المسحوبات)", type: 'equity', normalBalance: 'debit', parentCode: '3000', sortOrder: 330 },

  // ==========================================
  // 4. REVENUE (الإيرادات - 4000)
  // ==========================================
  { code: '4000', name: 'Revenue (الإيرادات التشغيلية)', type: 'revenue', normalBalance: 'credit', isHeader: true, sortOrder: 400 },
  { code: '4100', name: 'Sales Revenue (إيرادات المبيعات)', type: 'revenue', normalBalance: 'credit', isSystem: true, parentCode: '4000', sortOrder: 410 },
  { code: '4200', name: 'Service Revenue (إيرادات الخدمات والاستشارات)', type: 'revenue', normalBalance: 'credit', parentCode: '4000', sortOrder: 420 },
  { code: '4300', name: 'Sales Discounts Allowed (خصم مسموح به)', type: 'revenue', normalBalance: 'debit', parentCode: '4000', sortOrder: 430 },
  { code: '4900', name: 'Other Income & Gains (إيرادات وأرباح أخرى)', type: 'revenue', normalBalance: 'credit', parentCode: '4000', sortOrder: 490 },

  // ==========================================
  // 5. EXPENSES (المصروفات - 5000)
  // ==========================================
  { code: '5000', name: 'Expenses (المصروفات وتكلفة النشاط)', type: 'expense', normalBalance: 'debit', isHeader: true, sortOrder: 500 },
  { code: '5100', name: 'Cost of Goods Sold (تكلفة البضاعة المباعة)', type: 'expense', normalBalance: 'debit', isSystem: true, parentCode: '5000', sortOrder: 510 },
  { code: '5200', name: 'Salaries & Staff Wages (الرواتب والأجور ومستحقات الموظفين)', type: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 520 },
  { code: '5300', name: 'Facility Rent Expense (مصروف الإيجار)', type: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 530 },
  { code: '5400', name: 'Utilities & Internet (المنافع والكهرباء والاتصالات)', type: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 540 },
  { code: '5500', name: 'Marketing & Advertising (التسويق والدعاية والإعلان)', type: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 550 },
  { code: '5600', name: 'Office Supplies & Admin (المستلزمات والمصاريف الإدارية)', type: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 560 },
  { code: '5700', name: 'Bank & Payment Fees (رسوم وعمولات بنكية)', type: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 570 },
  { code: '5800', name: 'Depreciation Expense (مصروف إهلاك الأصول)', type: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 580 },
  { code: '5900', name: 'Other Operating Expenses (مصروفات تشغيلية وتسويات أخرى)', type: 'expense', normalBalance: 'debit', parentCode: '5000', sortOrder: 590 },
]
