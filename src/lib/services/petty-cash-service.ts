// =============================================================
// Petty Cash Service — Custodian Management, Float, Counts & Variance
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  createPettyCashCountSchema,
  reviewPettyCashCountSchema,
  postPettyCashCountSchema,
  CreatePettyCashCountInput,
  ReviewPettyCashCountInput,
  PostPettyCashCountInput,
} from '@/lib/validations/treasury-schemas'
import {
  PettyCashCountAlreadyPostedError,
  PettyCashVarianceMissingAccountError,
  TreasuryAccountNotFoundError,
  TreasuryError,
} from '@/lib/errors/treasury-error'
import { AuditService } from './audit-service'
import { AccountingService } from './accounting-service'
import { DocumentNumberingService } from './document-numbering-service'
import { TreasuryTransferService } from './treasury-transfer-service'

export class PettyCashService {
  /**
   * Perform a physical cash count with denomination breakdown.
   * Workflow: Open -> Counted -> Reviewed -> Posted
   */
  static async createCashCount(input: CreatePettyCashCountInput) {
    const validated = createPettyCashCountSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      // 1. Verify Cash Account
      const cashAccount = await tx.cashAccount.findFirst({
        where: { id: validated.cashAccountId, businessId: validated.businessId },
      })
      if (!cashAccount) {
        throw new TreasuryAccountNotFoundError(validated.cashAccountId, 'Cash Account')
      }

      // 2. Compute Counted Amount from Denominations
      let countedTotal = new Decimal(0)
      const denominationRows = validated.denominations.map((d) => {
        const denom = new Decimal(d.denomination)
        const total = denom.mul(d.quantity)
        countedTotal = countedTotal.plus(total)
        return {
          denomination: denom,
          quantity: d.quantity,
          totalAmount: total,
        }
      })

      const systemAmount = new Decimal(cashAccount.balance)
      const varianceAmount = countedTotal.minus(systemAmount)
      const openingFloat = new Decimal(cashAccount.targetFloat || cashAccount.openingBalance)

      const countNumber = await DocumentNumberingService.generateNumber(
        validated.businessId,
        'petty_cash_count',
        tx
      )

      const pettyCashCount = await tx.pettyCashCount.create({
        data: {
          businessId: validated.businessId,
          cashAccountId: validated.cashAccountId,
          countNumber,
          countDate: validated.countDate,
          custodianId: validated.custodianId || cashAccount.custodianId,
          openingFloat,
          systemAmount,
          countedAmount: countedTotal,
          varianceAmount,
          status: 'counted',
          notes: validated.notes,
          createdBy: validated.userId,
          denominations: {
            create: denominationRows,
          },
        },
        include: { denominations: true, cashAccount: true },
      })

      await AuditService.log(
        {
          businessId: validated.businessId,
          userId: validated.userId,
          entityType: 'petty_cash_count',
          entityId: pettyCashCount.id,
          action: 'create',
          newData: {
            countNumber,
            countedAmount: countedTotal.toNumber(),
            systemAmount: systemAmount.toNumber(),
            varianceAmount: varianceAmount.toNumber(),
          },
        },
        tx
      )

      return pettyCashCount
    })
  }

  /**
   * Review a cash count before posting.
   */
  static async reviewCashCount(input: ReviewPettyCashCountInput) {
    const validated = reviewPettyCashCountSchema.parse(input)

    const count = await prisma.pettyCashCount.findFirst({
      where: { id: validated.countId, businessId: validated.businessId },
    })
    if (!count) {
      throw new TreasuryError(`Petty cash count ${validated.countId} not found.`)
    }
    if (count.status === 'posted') {
      throw new PettyCashCountAlreadyPostedError(count.countNumber)
    }

    const updated = await prisma.pettyCashCount.update({
      where: { id: count.id },
      data: {
        status: 'reviewed',
        reviewedBy: validated.userId,
        reviewedAt: new Date(),
        notes: validated.notes ? `${count.notes || ''}\n${validated.notes}`.trim() : count.notes,
      },
      include: { denominations: true, cashAccount: true },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId: validated.userId,
      entityType: 'petty_cash_count',
      entityId: count.id,
      action: 'review',
      newData: { status: 'reviewed', countNumber: count.countNumber },
    })

    return updated
  }

  /**
   * Post cash count: If variance != 0, posts GL journal entry to adjust ledger to physical count.
   */
  static async postCashCount(input: PostPettyCashCountInput) {
    const validated = postPettyCashCountSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const count = await tx.pettyCashCount.findFirst({
        where: { id: validated.countId, businessId: validated.businessId },
        include: { cashAccount: true },
      })
      if (!count) {
        throw new TreasuryError(`Petty cash count ${validated.countId} not found.`)
      }
      if (count.status === 'posted') {
        throw new PettyCashCountAlreadyPostedError(count.countNumber)
      }

      const variance = new Decimal(count.varianceAmount)
      let journalEntry: any = null

      if (!variance.isZero()) {
        if (!validated.varianceAccountId) {
          throw new PettyCashVarianceMissingAccountError(variance.toNumber())
        }

        const varianceGl = await tx.chartOfAccount.findFirst({
          where: { id: validated.varianceAccountId, businessId: validated.businessId },
        })
        if (!varianceGl) {
          throw new TreasuryError(`Variance GL account ${validated.varianceAccountId} not found.`)
        }

        const cashGlId = count.cashAccount.accountId
        if (!cashGlId) {
          throw new TreasuryError('Petty cash account does not have a mapped GL account.')
        }

        const isSurplus = variance.gt(0)
        const absVariance = variance.abs()

        // If Surplus (+): Debit Cash GL, Credit Variance Income GL
        // If Shortage (-): Debit Variance Expense GL, Credit Cash GL
        let debitAccountId = isSurplus ? cashGlId : validated.varianceAccountId
        let creditAccountId = isSurplus ? validated.varianceAccountId : cashGlId

        const entryNumber = await DocumentNumberingService.generateNumber(validated.businessId, 'journal_entry', tx)
        journalEntry = await AccountingService.postJournalEntry(
          {
            businessId: validated.businessId,
            entryNumber,
            entryDate: count.countDate,
            description: `Petty Cash Count Variance (${count.countNumber}): ${isSurplus ? 'Surplus' : 'Shortage'} of $${absVariance.toFixed(2)}`,
            currencyCode: count.cashAccount.currencyCode,
            exchangeRate: 1,
            sourceType: 'petty_cash',
            sourceId: count.id,
            lines: [
              {
                accountId: debitAccountId,
                debitAmount: absVariance.toNumber(),
                creditAmount: 0,
                description: `Petty Cash Variance ${isSurplus ? 'Surplus' : 'Shortage'}`,
              },
              {
                accountId: creditAccountId,
                debitAmount: 0,
                creditAmount: absVariance.toNumber(),
                description: `Petty Cash Variance Offset`,
              },
            ],
            userId: validated.userId,
          },
          tx
        )

        // Update Cash Account balance to match physical count
        await tx.cashAccount.update({
          where: { id: count.cashAccountId },
          data: { balance: count.countedAmount },
        })

        // Create cash transaction record for variance adjustment
        await tx.cashTransaction.create({
          data: {
            cashAccountId: count.cashAccountId,
            businessId: validated.businessId,
            type: isSurplus ? 'deposit' : 'withdrawal',
            amount: absVariance,
            balanceAfter: count.countedAmount,
            description: `Petty Cash Count Variance (${count.countNumber})`,
            reference: count.countNumber,
            sourceType: 'petty_cash_variance',
            sourceId: count.id,
            journalEntryId: journalEntry.id,
            transactionDate: count.countDate,
          },
        })
      }

      const posted = await tx.pettyCashCount.update({
        where: { id: count.id },
        data: {
          status: 'posted',
          varianceAccountId: validated.varianceAccountId ?? null,
          journalEntryId: journalEntry?.id ?? null,
          postedBy: validated.userId,
          postedAt: new Date(),
        },
        include: { denominations: true, cashAccount: true },
      })

      await AuditService.log(
        {
          businessId: validated.businessId,
          userId: validated.userId,
          entityType: 'petty_cash_count',
          entityId: count.id,
          action: 'post',
          newData: {
            status: 'posted',
            countNumber: count.countNumber,
            varianceAmount: variance.toNumber(),
            journalEntryId: journalEntry?.id ?? null,
          },
        },
        tx
      )

      return { count: posted, journalEntry }
    })
  }

  /**
   * Replenish a petty cash float from a main bank or cash account.
   */
  static async replenishFloat(params: {
    businessId: string
    pettyCashAccountId: string
    sourceAccountId: string
    sourceAccountType: 'cash' | 'bank'
    amount: number
    reference?: string
    notes?: string
    userId: string
  }) {
    // Create draft transfer
    const transfer = await TreasuryTransferService.createTransfer({
      businessId: params.businessId,
      sourceAccountId: params.sourceAccountId,
      sourceAccountType: params.sourceAccountType,
      destinationAccountId: params.pettyCashAccountId,
      destinationAccountType: 'cash',
      amount: params.amount,
      transferDate: new Date(),
      reference: params.reference || 'Petty Cash Replenishment',
      notes: params.notes || 'Replenishment of petty cash float',
      userId: params.userId,
    })

    // Approve transfer
    await TreasuryTransferService.approveTransfer({
      businessId: params.businessId,
      transferId: transfer.id,
      userId: params.userId,
    })

    // Post transfer
    return TreasuryTransferService.postTransfer({
      businessId: params.businessId,
      transferId: transfer.id,
      userId: params.userId,
    })
  }

  static async getCashCounts(businessId: string, filter?: { cashAccountId?: string; status?: string }) {
    const where: any = { businessId }
    if (filter?.cashAccountId) where.cashAccountId = filter.cashAccountId
    if (filter?.status) where.status = filter.status

    return prisma.pettyCashCount.findMany({
      where,
      include: { denominations: true, cashAccount: true, custodian: true },
      orderBy: { countDate: 'desc' },
    })
  }

  static async getCashCountById(businessId: string, id: string) {
    const count = await prisma.pettyCashCount.findFirst({
      where: { id, businessId },
      include: { denominations: true, cashAccount: true, custodian: true, reviewer: true, poster: true },
    })
    if (!count) {
      throw new TreasuryError(`Petty cash count ${id} not found.`)
    }
    return count
  }
}
