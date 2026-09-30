// =============================================================
// Bank Reconciliation Service — Matching Engine, Adjustments & Period Closing
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  createBankReconciliationSchema,
  autoMatchCriteriaSchema,
  manualMatchSchema,
  unmatchSchema,
  reconciliationAdjustmentSchema,
  closeReconciliationSchema,
  reopenReconciliationSchema,
  CreateBankReconciliationInput,
  AutoMatchCriteriaInput,
  ManualMatchInput,
  UnmatchInput,
  ReconciliationAdjustmentInput,
  CloseReconciliationInput,
  ReopenReconciliationInput,
} from '@/lib/validations/treasury-schemas'
import {
  ReconciliationClosedError,
  PeriodReopenUnauthorizedError,
  TreasuryAccountNotFoundError,
  TreasuryError,
} from '@/lib/errors/treasury-error'
import { AuditService } from './audit-service'
import { AccountingService } from './accounting-service'
import { DocumentNumberingService } from './document-numbering-service'

export class BankReconciliationService {
  /**
   * Initialize a reconciliation workspace session.
   */
  static async createReconciliation(input: CreateBankReconciliationInput) {
    const validated = createBankReconciliationSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      // 1. Validate Bank Account
      const bankAccount = await tx.bankAccount.findFirst({
        where: { id: validated.bankAccountId, businessId: validated.businessId },
      })
      if (!bankAccount) {
        throw new TreasuryAccountNotFoundError(validated.bankAccountId, 'Bank Account')
      }

      // 2. Compute book balance from the General Ledger as of periodEnd.
      //    This is the authoritative source — the cached BankAccount.balance
      //    can drift if syncTreasuryBalances() hasn't been called recently.
      //    Book Balance = SUM(baseDebit) - SUM(baseCredit) for the bank's GL account
      //    up to and including periodEnd (posted entries only).
      let bookBalance: Decimal

      if (bankAccount.accountId) {
        const glAgg = await tx.journalEntryLine.aggregate({
          where: {
            businessId: validated.businessId,
            accountId: bankAccount.accountId,
            journalEntry: {
              status: 'posted',
              entryDate: { lte: validated.periodEnd },
            },
          },
          _sum: {
            baseDebit: true,
            baseCredit: true,
          },
        })
        const totalDebit = new Decimal(glAgg._sum.baseDebit?.toString() || 0)
        const totalCredit = new Decimal(glAgg._sum.baseCredit?.toString() || 0)
        // Bank accounts are debit-normal assets: balance = debits - credits
        bookBalance = totalDebit.minus(totalCredit)
      } else {
        // Fallback to cached balance if no GL account is linked (should not happen in a healthy setup)
        bookBalance = new Decimal(bankAccount.balance)
      }

      const statementBalance = new Decimal(validated.statementEndingBalance)
      const difference = statementBalance.minus(bookBalance)

      const reconciliationNumber = await DocumentNumberingService.generateNumber(
        validated.businessId,
        'bank_reconciliation',
        tx
      )

      const reconciliation = await tx.bankReconciliation.create({
        data: {
          businessId: validated.businessId,
          reconciliationNumber,
          bankAccountId: validated.bankAccountId,
          statementId: validated.statementId,
          periodStart: validated.periodStart,
          periodEnd: validated.periodEnd,
          statementEndingBalance: statementBalance,
          bookEndingBalance: bookBalance,
          clearedBalance: new Decimal(0),
          difference,
          status: 'draft',
          notes: validated.notes,
          createdBy: validated.userId,
        },
      })

      // Update statement status if linked
      if (validated.statementId) {
        await tx.bankStatement.update({
          where: { id: validated.statementId },
          data: { status: 'reconciling' },
        })
      }

      await AuditService.log(
        {
          businessId: validated.businessId,
          userId: validated.userId,
          entityType: 'bank_reconciliation',
          entityId: reconciliation.id,
          action: 'create',
          newData: {
            reconciliationNumber,
            bankAccount: bankAccount.bankName,
            bookEndingBalance: bookBalance.toNumber(),
            statementEndingBalance: validated.statementEndingBalance,
            difference: difference.toNumber(),
          },
        },
        tx
      )

      return reconciliation
    })
  }

  /**
   * Recalculate cleared balance and difference for a reconciliation session.
   */
  private static async recalculateSession(reconciliationId: string, tx: any) {
    const reconciliation = await tx.bankReconciliation.findUnique({
      where: { id: reconciliationId },
      include: {
        matches: true,
        adjustments: true,
      },
    })
    if (!reconciliation) return

    let totalMatched = new Decimal(0)
    for (const match of reconciliation.matches) {
      totalMatched = totalMatched.plus(new Decimal(match.matchedAmount))
    }

    let totalAdjustments = new Decimal(0)
    for (const adj of reconciliation.adjustments) {
      totalAdjustments = totalAdjustments.plus(new Decimal(adj.amount))
    }

    const clearedBalance = totalMatched.plus(totalAdjustments)
    const statementEnding = new Decimal(reconciliation.statementEndingBalance)
    const difference = statementEnding.minus(clearedBalance)

    await tx.bankReconciliation.update({
      where: { id: reconciliationId },
      data: {
        clearedBalance,
        difference,
        status: difference.isZero() ? 'reconciled' : 'in_progress',
      },
    })
  }

  /**
   * Automatic Matching Engine based on amount, date tolerance, and reference heuristics.
   */
  static async autoMatch(input: AutoMatchCriteriaInput) {
    const validated = autoMatchCriteriaSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const reconciliation = await tx.bankReconciliation.findFirst({
        where: { id: validated.reconciliationId, businessId: validated.businessId },
      })
      if (!reconciliation) {
        throw new TreasuryError(`Reconciliation session ${validated.reconciliationId} not found.`)
      }
      if (reconciliation.status === 'closed') {
        throw new ReconciliationClosedError(reconciliation.reconciliationNumber)
      }

      // Fetch unmatched statement lines
      const statementLineWhere: any = {
        businessId: validated.businessId,
        isMatched: false,
        transactionDate: {
          gte: reconciliation.periodStart,
          lte: reconciliation.periodEnd,
        },
      }
      if (reconciliation.statementId) {
        statementLineWhere.statementId = reconciliation.statementId
      }

      const unmatchedLines = await tx.bankStatementLine.findMany({
        where: statementLineWhere,
        orderBy: { transactionDate: 'asc' },
      })

      // Fetch unmatched bank transactions
      const unmatchedTxns = await tx.bankTransaction.findMany({
        where: {
          bankAccountId: reconciliation.bankAccountId,
          businessId: validated.businessId,
          isReconciled: false,
          transactionDate: {
            gte: reconciliation.periodStart,
            lte: reconciliation.periodEnd,
          },
        },
        orderBy: { transactionDate: 'asc' },
      })

      let matchCount = 0
      const matchedTxIds = new Set<string>()

      for (const line of unmatchedLines) {
        const lineAmount = new Decimal(line.amount).abs()
        const lineDate = new Date(line.transactionDate).getTime()
        const tolMs = validated.dateToleranceDays * 24 * 60 * 60 * 1000

        // Find candidate among unmatched transactions
        const candidate = unmatchedTxns.find((t: any) => {
          if (matchedTxIds.has(t.id)) return false
          const tAmount = new Decimal(t.amount).abs()
          if (!lineAmount.equals(tAmount)) return false

          const tDate = new Date(t.transactionDate).getTime()
          const diffDate = Math.abs(lineDate - tDate)
          if (diffDate > tolMs) return false

          // Match reference if required
          if (validated.matchReference && line.reference && t.reference) {
            const lRef = line.reference.toLowerCase().trim()
            const tRef = t.reference.toLowerCase().trim()
            if (lRef === tRef || lRef.includes(tRef) || tRef.includes(lRef)) {
              return true
            }
          }

          // Exact amount and date match is strong enough candidate
          return true
        })

        if (candidate) {
          matchedTxIds.add(candidate.id)
          matchCount++

          // Create match record
          await tx.reconciliationMatch.create({
            data: {
              businessId: validated.businessId,
              reconciliationId: reconciliation.id,
              statementLineId: line.id,
              bankTransactionId: candidate.id,
              matchedAmount: lineAmount,
              matchType: 'auto',
              matchRule: 'exact_amount_and_date_tolerance',
              confidence: 95.0,
              matchedBy: validated.userId,
            },
          })

          // Mark line and transaction as matched
          await tx.bankStatementLine.update({
            where: { id: line.id },
            data: {
              isMatched: true,
              matchedTransactionId: candidate.id,
              matchedAt: new Date(),
            },
          })

          await tx.bankTransaction.update({
            where: { id: candidate.id },
            data: {
              isReconciled: true,
              reconciledAt: new Date(),
            },
          })
        }
      }

      await this.recalculateSession(reconciliation.id, tx)

      await AuditService.log(
        {
          businessId: validated.businessId,
          userId: validated.userId,
          entityType: 'bank_reconciliation',
          entityId: reconciliation.id,
          action: 'update',
          newData: {
            action: 'auto_match',
            matchedCount: matchCount,
          },
        },
        tx
      )

      return { matchCount }
    })
  }

  /**
   * Manually match a bank statement line to a bank transaction.
   */
  static async manualMatch(input: ManualMatchInput) {
    const validated = manualMatchSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const reconciliation = await tx.bankReconciliation.findFirst({
        where: { id: validated.reconciliationId, businessId: validated.businessId },
      })
      if (!reconciliation) {
        throw new TreasuryError(`Reconciliation session ${validated.reconciliationId} not found.`)
      }
      if (reconciliation.status === 'closed') {
        throw new ReconciliationClosedError(reconciliation.reconciliationNumber)
      }

      const statementLine = await tx.bankStatementLine.findFirst({
        where: { id: validated.statementLineId, businessId: validated.businessId },
      })
      if (!statementLine) {
        throw new TreasuryError(`Statement line ${validated.statementLineId} not found.`)
      }
      if (statementLine.isMatched) {
        throw new TreasuryError(`Statement line is already matched.`)
      }

      let bankTx: any
      if (validated.bankTransactionId) {
        bankTx = await tx.bankTransaction.findFirst({
          where: { id: validated.bankTransactionId, businessId: validated.businessId },
        })
        if (!bankTx) {
          throw new TreasuryError(`Bank transaction ${validated.bankTransactionId} not found.`)
        }
        if (bankTx.isReconciled) {
          throw new TreasuryError(`Bank transaction is already reconciled.`)
        }
      }

      const match = await tx.reconciliationMatch.create({
        data: {
          businessId: validated.businessId,
          reconciliationId: reconciliation.id,
          statementLineId: statementLine.id,
          bankTransactionId: validated.bankTransactionId,
          journalEntryLineId: validated.journalEntryLineId,
          matchedAmount: new Decimal(validated.matchedAmount),
          matchType: 'manual',
          matchedBy: validated.userId,
        },
      })

      await tx.bankStatementLine.update({
        where: { id: statementLine.id },
        data: {
          isMatched: true,
          matchedTransactionId: validated.bankTransactionId,
          matchedAt: new Date(),
        },
      })

      if (validated.bankTransactionId) {
        await tx.bankTransaction.update({
          where: { id: validated.bankTransactionId },
          data: {
            isReconciled: true,
            reconciledAt: new Date(),
          },
        })
      }

      await this.recalculateSession(reconciliation.id, tx)

      await AuditService.log(
        {
          businessId: validated.businessId,
          userId: validated.userId,
          entityType: 'bank_reconciliation',
          entityId: reconciliation.id,
          action: 'update',
          newData: {
            action: 'manual_match',
            matchId: match.id,
            matchedAmount: validated.matchedAmount,
          },
        },
        tx
      )

      return match
    })
  }

  /**
   * Unmatch a matched pair.
   */
  static async unmatch(input: UnmatchInput) {
    const validated = unmatchSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const reconciliation = await tx.bankReconciliation.findFirst({
        where: { id: validated.reconciliationId, businessId: validated.businessId },
      })
      if (!reconciliation) {
        throw new TreasuryError(`Reconciliation session ${validated.reconciliationId} not found.`)
      }
      if (reconciliation.status === 'closed') {
        throw new ReconciliationClosedError(reconciliation.reconciliationNumber)
      }

      const match = await tx.reconciliationMatch.findFirst({
        where: { id: validated.matchId, reconciliationId: reconciliation.id },
      })
      if (!match) {
        throw new TreasuryError(`Match record ${validated.matchId} not found.`)
      }

      // Revert statement line
      await tx.bankStatementLine.update({
        where: { id: match.statementLineId },
        data: {
          isMatched: false,
          matchedTransactionId: null,
          matchedAt: null,
        },
      })

      // Revert bank transaction
      if (match.bankTransactionId) {
        await tx.bankTransaction.update({
          where: { id: match.bankTransactionId },
          data: {
            isReconciled: false,
            reconciledAt: null,
          },
        })
      }

      await tx.reconciliationMatch.delete({ where: { id: match.id } })

      await this.recalculateSession(reconciliation.id, tx)

      await AuditService.log(
        {
          businessId: validated.businessId,
          userId: validated.userId,
          entityType: 'bank_reconciliation',
          entityId: reconciliation.id,
          action: 'delete',
          oldData: { matchId: match.id, matchedAmount: match.matchedAmount.toNumber() },
        },
        tx
      )

      return { success: true }
    })
  }

  /**
   * Post a reconciliation adjustment (e.g. bank fee, interest) with double-entry accounting.
   */
  static async createAdjustment(input: ReconciliationAdjustmentInput) {
    const validated = reconciliationAdjustmentSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const reconciliation = await tx.bankReconciliation.findFirst({
        where: { id: validated.reconciliationId, businessId: validated.businessId },
        include: { bankAccount: true },
      })
      if (!reconciliation) {
        throw new TreasuryError(`Reconciliation session ${validated.reconciliationId} not found.`)
      }
      if (reconciliation.status === 'closed') {
        throw new ReconciliationClosedError(reconciliation.reconciliationNumber)
      }

      const bankAccount = reconciliation.bankAccount
      if (!bankAccount.accountId) {
        throw new TreasuryError('Bank account does not have a mapped GL account.')
      }

      const offsetGl = await tx.chartOfAccount.findFirst({
        where: { id: validated.accountId, businessId: validated.businessId },
      })
      if (!offsetGl) {
        throw new TreasuryError(`Offset GL account ${validated.accountId} not found in this business.`)
      }

      const amount = new Decimal(validated.amount)
      const isFeeOrCharge = ['bank_fee', 'interest_expense', 'bank_charge'].includes(validated.adjustmentType)

      let debitAccountId: string
      let creditAccountId: string

      if (isFeeOrCharge) {
        // Expense: Debit Expense GL, Credit Bank GL
        debitAccountId = validated.accountId
        creditAccountId = bankAccount.accountId
      } else {
        // Income / Inflow: Debit Bank GL, Credit Income GL
        debitAccountId = bankAccount.accountId
        creditAccountId = validated.accountId
      }

      // 1. Post GL Journal Entry via AccountingService
      const entryNumber = await DocumentNumberingService.generateNumber(validated.businessId, 'journal_entry', tx)
      const journalEntry = await AccountingService.postJournalEntry(
        {
          businessId: validated.businessId,
          entryNumber,
          entryDate: validated.adjustmentDate,
          description: `Bank Reconciliation Adjustment: ${validated.adjustmentType.replace('_', ' ').toUpperCase()} - ${validated.reason}`,
          currencyCode: validated.currencyCode,
          exchangeRate: 1,
          sourceType: 'bank_reconciliation',
          sourceId: reconciliation.id,
          lines: [
            {
              accountId: debitAccountId,
              debitAmount: validated.amount,
              creditAmount: 0,
              description: `Reconciliation Adjustment (${validated.reason})`,
            },
            {
              accountId: creditAccountId,
              debitAmount: 0,
              creditAmount: validated.amount,
              description: `Reconciliation Offset (${validated.reason})`,
            },
          ],
          userId: validated.userId,
        },
        tx
      )

      // 2. Update Bank Account balance
      const newBankBalance = isFeeOrCharge
        ? new Decimal(bankAccount.balance).minus(amount)
        : new Decimal(bankAccount.balance).plus(amount)

      await tx.bankAccount.update({
        where: { id: bankAccount.id },
        data: { balance: newBankBalance },
      })

      // 3. Create Bank Transaction record marked as reconciled
      await tx.bankTransaction.create({
        data: {
          bankAccountId: bankAccount.id,
          businessId: validated.businessId,
          type: isFeeOrCharge ? 'withdrawal' : 'deposit',
          amount,
          balanceAfter: newBankBalance,
          description: `Reconciliation Adjustment: ${validated.reason}`,
          isReconciled: true,
          reconciledAt: new Date(),
          sourceType: validated.adjustmentType,
          sourceId: reconciliation.id,
          journalEntryId: journalEntry.id,
          transactionDate: validated.adjustmentDate,
        },
      })

      // 4. Create ReconciliationAdjustment record
      const adjustment = await tx.reconciliationAdjustment.create({
        data: {
          businessId: validated.businessId,
          reconciliationId: reconciliation.id,
          bankAccountId: bankAccount.id,
          statementLineId: validated.statementLineId,
          adjustmentType: validated.adjustmentType,
          amount,
          currencyCode: validated.currencyCode,
          reason: validated.reason,
          accountId: validated.accountId,
          adjustmentDate: validated.adjustmentDate,
          journalEntryId: journalEntry.id,
          createdBy: validated.userId,
        },
      })

      await this.recalculateSession(reconciliation.id, tx)

      await AuditService.log(
        {
          businessId: validated.businessId,
          userId: validated.userId,
          entityType: 'reconciliation_adjustment',
          entityId: adjustment.id,
          action: 'create',
          newData: {
            adjustmentType: validated.adjustmentType,
            amount: validated.amount,
            reason: validated.reason,
            journalEntryId: journalEntry.id,
          },
        },
        tx
      )

      return adjustment
    })
  }

  /**
   * Close a reconciled statement period, strictly locking matched lines & records.
   */
  static async closePeriod(input: CloseReconciliationInput) {
    const validated = closeReconciliationSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const reconciliation = await tx.bankReconciliation.findFirst({
        where: { id: validated.reconciliationId, businessId: validated.businessId },
      })
      if (!reconciliation) {
        throw new TreasuryError(`Reconciliation session ${validated.reconciliationId} not found.`)
      }
      if (reconciliation.status === 'closed') {
        throw new ReconciliationClosedError(reconciliation.reconciliationNumber)
      }

      // Check difference
      const difference = new Decimal(reconciliation.difference)
      if (!difference.isZero() && !validated.forceClose) {
        throw new TreasuryError(
          `Cannot close reconciliation with unresolved difference ($${difference.toNumber().toFixed(2)}). Resolve difference or specify forceClose.`
        )
      }

      const closed = await tx.bankReconciliation.update({
        where: { id: reconciliation.id },
        data: {
          status: 'closed',
          closedBy: validated.userId,
          closedAt: new Date(),
        },
      })

      if (reconciliation.statementId) {
        await tx.bankStatement.update({
          where: { id: reconciliation.statementId },
          data: { status: 'closed' },
        })
      }

      await AuditService.log(
        {
          businessId: validated.businessId,
          userId: validated.userId,
          entityType: 'bank_reconciliation',
          entityId: reconciliation.id,
          action: 'close',
          newData: {
            status: 'closed',
            reconciliationNumber: reconciliation.reconciliationNumber,
            difference: difference.toNumber(),
          },
        },
        tx
      )

      return closed
    })
  }

  /**
   * Reopen a closed reconciliation period with mandatory audit logging and reason.
   */
  static async reopenPeriod(input: ReopenReconciliationInput) {
    const validated = reopenReconciliationSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const reconciliation = await tx.bankReconciliation.findFirst({
        where: { id: validated.reconciliationId, businessId: validated.businessId },
      })
      if (!reconciliation) {
        throw new TreasuryError(`Reconciliation session ${validated.reconciliationId} not found.`)
      }

      if (!validated.reopenReason || validated.reopenReason.trim().length < 5) {
        throw new PeriodReopenUnauthorizedError()
      }

      const reopened = await tx.bankReconciliation.update({
        where: { id: reconciliation.id },
        data: {
          status: 'in_progress',
          reopenedBy: validated.userId,
          reopenedAt: new Date(),
          reopenReason: validated.reopenReason,
        },
      })

      if (reconciliation.statementId) {
        await tx.bankStatement.update({
          where: { id: reconciliation.statementId },
          data: { status: 'reconciling' },
        })
      }

      await AuditService.log(
        {
          businessId: validated.businessId,
          userId: validated.userId,
          entityType: 'bank_reconciliation',
          entityId: reconciliation.id,
          action: 'reopen',
          newData: {
            status: 'in_progress',
            reopenReason: validated.reopenReason,
            reconciliationNumber: reconciliation.reconciliationNumber,
          },
        },
        tx
      )

      return reopened
    })
  }

  /**
   * Workspace summary for the reconciliation UI.
   */
  static async getReconciliationWorkspace(businessId: string, reconciliationId: string) {
    const reconciliation = await prisma.bankReconciliation.findFirst({
      where: { id: reconciliationId, businessId },
      include: {
        bankAccount: true,
        statement: { include: { lines: true } },
        matches: {
          include: {
            statementLine: true,
            bankTransaction: true,
          },
        },
        adjustments: { include: { account: true } },
      },
    })
    if (!reconciliation) {
      throw new TreasuryError(`Reconciliation session ${reconciliationId} not found.`)
    }

    // Fetch unmatched statement lines
    const unmatchedStatementLines = await prisma.bankStatementLine.findMany({
      where: {
        businessId,
        isMatched: false,
        statementId: reconciliation.statementId || undefined,
        transactionDate: {
          gte: reconciliation.periodStart,
          lte: reconciliation.periodEnd,
        },
      },
    })

    // Fetch unmatched bank transactions
    const unmatchedBankTransactions = await prisma.bankTransaction.findMany({
      where: {
        businessId,
        bankAccountId: reconciliation.bankAccountId,
        isReconciled: false,
        transactionDate: {
          gte: reconciliation.periodStart,
          lte: reconciliation.periodEnd,
        },
      },
    })

    return {
      reconciliation,
      statementEndingBalance: reconciliation.statementEndingBalance.toNumber(),
      bookEndingBalance: reconciliation.bookEndingBalance.toNumber(),
      clearedBalance: reconciliation.clearedBalance.toNumber(),
      difference: reconciliation.difference.toNumber(),
      status: reconciliation.status,
      matchedCount: reconciliation.matches.length,
      unmatchedStatementLines,
      unmatchedBankTransactions,
      adjustments: reconciliation.adjustments,
    }
  }
}
