// =============================================================
// Treasury Transfer Service — Multi-Account & Multi-Currency Transfers
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  createTreasuryTransferSchema,
  approveTreasuryTransferSchema,
  postTreasuryTransferSchema,
  CreateTreasuryTransferInput,
  ApproveTreasuryTransferInput,
  PostTreasuryTransferInput,
} from '@/lib/validations/treasury-schemas'
import {
  InvalidTransferError,
  TransferAlreadyPostedError,
  TreasuryAccountNotFoundError,
  TreasuryError,
} from '@/lib/errors/treasury-error'
import { AuditService } from './audit-service'
import { AccountingService } from './accounting-service'
import { DocumentNumberingService } from './document-numbering-service'

export class TreasuryTransferService {
  /**
   * Create a new transfer in 'draft' status.
   */
  static async createTransfer(input: CreateTreasuryTransferInput) {
    const validated = createTreasuryTransferSchema.parse(input)

    // 1. Validation: Same source and destination rejected
    if (validated.sourceAccountId === validated.destinationAccountId) {
      throw new InvalidTransferError('Source account and destination account cannot be the same.')
    }

    return prisma.$transaction(async (tx) => {
      // 2. Validate source account exists in business
      let sourceName = ''
      if (validated.sourceAccountType === 'cash') {
        const src = await tx.cashAccount.findFirst({
          where: { id: validated.sourceAccountId, businessId: validated.businessId },
        })
        if (!src) throw new TreasuryAccountNotFoundError(validated.sourceAccountId, 'Source Cash Account')
        sourceName = src.name
      } else {
        const src = await tx.bankAccount.findFirst({
          where: { id: validated.sourceAccountId, businessId: validated.businessId },
        })
        if (!src) throw new TreasuryAccountNotFoundError(validated.sourceAccountId, 'Source Bank Account')
        sourceName = `${src.bankName} - ${src.accountName}`
      }

      // 3. Validate destination account exists in business (no cross-business transfers)
      let destName = ''
      if (validated.destinationAccountType === 'cash') {
        const dst = await tx.cashAccount.findFirst({
          where: { id: validated.destinationAccountId, businessId: validated.businessId },
        })
        if (!dst) throw new TreasuryAccountNotFoundError(validated.destinationAccountId, 'Destination Cash Account')
        destName = dst.name
      } else {
        const dst = await tx.bankAccount.findFirst({
          where: { id: validated.destinationAccountId, businessId: validated.businessId },
        })
        if (!dst) throw new TreasuryAccountNotFoundError(validated.destinationAccountId, 'Destination Bank Account')
        destName = `${dst.bankName} - ${dst.accountName}`
      }

      // 4. Multi-currency calculation
      const amount = new Decimal(validated.amount)
      const rate = new Decimal(validated.exchangeRate)
      const destAmount = validated.destinationAmount
        ? new Decimal(validated.destinationAmount)
        : amount.mul(rate)
      const destCurrency = validated.destinationCurrencyCode || validated.currencyCode

      const transferNumber = await DocumentNumberingService.generateNumber(
        validated.businessId,
        'treasury_transfer',
        tx
      )

      const transfer = await tx.treasuryTransfer.create({
        data: {
          businessId: validated.businessId,
          transferNumber,
          sourceAccountId: validated.sourceAccountId,
          sourceAccountType: validated.sourceAccountType,
          destinationAccountId: validated.destinationAccountId,
          destinationAccountType: validated.destinationAccountType,
          amount,
          currencyCode: validated.currencyCode,
          destinationAmount: destAmount,
          destinationCurrencyCode: destCurrency,
          exchangeRate: rate,
          transferDate: validated.transferDate,
          reference: validated.reference,
          notes: validated.notes,
          status: 'draft',
          createdBy: validated.userId,
        },
      })

      await AuditService.log(
        {
          businessId: validated.businessId,
          userId: validated.userId,
          entityType: 'treasury_transfer',
          entityId: transfer.id,
          action: 'create',
          newData: { transferNumber, amount: validated.amount, from: sourceName, to: destName },
        },
        tx
      )

      return transfer
    })
  }

  /**
   * Approve a draft transfer (Workflow: Draft -> Approved -> Posted).
   */
  static async approveTransfer(input: ApproveTreasuryTransferInput) {
    const validated = approveTreasuryTransferSchema.parse(input)

    const transfer = await prisma.treasuryTransfer.findFirst({
      where: { id: validated.transferId, businessId: validated.businessId },
    })

    if (!transfer) {
      throw new TreasuryError(`Treasury transfer ${validated.transferId} was not found.`)
    }

    if (transfer.status === 'posted') {
      throw new TransferAlreadyPostedError(transfer.transferNumber)
    }

    if (transfer.status === 'cancelled') {
      throw new InvalidTransferError('Cannot approve a cancelled transfer.')
    }

    const updated = await prisma.treasuryTransfer.update({
      where: { id: transfer.id },
      data: {
        status: 'approved',
        approvedBy: validated.userId,
        approvedAt: new Date(),
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId: validated.userId,
      entityType: 'treasury_transfer',
      entityId: transfer.id,
      action: 'approve',
      newData: { status: 'approved', transferNumber: transfer.transferNumber },
    })

    return updated
  }

  /**
   * Post a transfer: Updates balances, creates Cash/Bank ledger movements, and posts GL Journal.
   */
  static async postTransfer(input: PostTreasuryTransferInput) {
    const validated = postTreasuryTransferSchema.parse(input)

    return prisma.$transaction(async (tx) => {
      const transfer = await tx.treasuryTransfer.findFirst({
        where: { id: validated.transferId, businessId: validated.businessId },
      })

      if (!transfer) {
        throw new TreasuryError(`Treasury transfer ${validated.transferId} was not found.`)
      }

      // Duplicate posting prevention
      if (transfer.status === 'posted') {
        throw new TransferAlreadyPostedError(transfer.transferNumber)
      }

      if (transfer.status === 'cancelled') {
        throw new InvalidTransferError('Cannot post a cancelled transfer.')
      }

      const amount = new Decimal(transfer.amount)
      const destAmount = new Decimal(transfer.destinationAmount)
      const rate = new Decimal(transfer.exchangeRate)

      // 1. Fetch source treasury account & GL mapping
      let sourceGlAccountId: string
      let sourceBalance: Decimal
      let sourceName: string

      if (transfer.sourceAccountType === 'cash') {
        const acc = await tx.cashAccount.findFirst({
          where: { id: transfer.sourceAccountId, businessId: transfer.businessId },
        })
        if (!acc || !acc.accountId) throw new TreasuryError('Source cash account GL mapping is invalid.')
        sourceGlAccountId = acc.accountId
        sourceBalance = new Decimal(acc.balance)
        sourceName = acc.name
      } else {
        const acc = await tx.bankAccount.findFirst({
          where: { id: transfer.sourceAccountId, businessId: transfer.businessId },
        })
        if (!acc || !acc.accountId) throw new TreasuryError('Source bank account GL mapping is invalid.')
        sourceGlAccountId = acc.accountId
        sourceBalance = new Decimal(acc.balance)
        sourceName = `${acc.bankName} - ${acc.accountName}`
      }

      // 2. Fetch destination treasury account & GL mapping
      let destGlAccountId: string
      let destBalance: Decimal
      let destName: string

      if (transfer.destinationAccountType === 'cash') {
        const acc = await tx.cashAccount.findFirst({
          where: { id: transfer.destinationAccountId, businessId: transfer.businessId },
        })
        if (!acc || !acc.accountId) throw new TreasuryError('Destination cash account GL mapping is invalid.')
        destGlAccountId = acc.accountId
        destBalance = new Decimal(acc.balance)
        destName = acc.name
      } else {
        const acc = await tx.bankAccount.findFirst({
          where: { id: transfer.destinationAccountId, businessId: transfer.businessId },
        })
        if (!acc || !acc.accountId) throw new TreasuryError('Destination bank account GL mapping is invalid.')
        destGlAccountId = acc.accountId
        destBalance = new Decimal(acc.balance)
        destName = `${acc.bankName} - ${acc.accountName}`
      }

      // 3. Update source account balance & record movement
      const newSourceBalance = sourceBalance.minus(amount)
      if (transfer.sourceAccountType === 'cash') {
        await tx.cashAccount.update({
          where: { id: transfer.sourceAccountId },
          data: { balance: newSourceBalance },
        })
        await tx.cashTransaction.create({
          data: {
            cashAccountId: transfer.sourceAccountId,
            businessId: transfer.businessId,
            type: 'transfer',
            amount,
            balanceAfter: newSourceBalance,
            description: `Transfer Out to ${destName} (${transfer.transferNumber})`,
            reference: transfer.transferNumber,
            sourceType: 'treasury_transfer',
            sourceId: transfer.id,
            transactionDate: transfer.transferDate,
          },
        })
      } else {
        await tx.bankAccount.update({
          where: { id: transfer.sourceAccountId },
          data: { balance: newSourceBalance },
        })
        await tx.bankTransaction.create({
          data: {
            bankAccountId: transfer.sourceAccountId,
            businessId: transfer.businessId,
            type: 'transfer',
            amount,
            balanceAfter: newSourceBalance,
            description: `Transfer Out to ${destName} (${transfer.transferNumber})`,
            reference: transfer.transferNumber,
            sourceType: 'treasury_transfer',
            sourceId: transfer.id,
            transactionDate: transfer.transferDate,
          },
        })
      }

      // 4. Update destination account balance & record movement
      const newDestBalance = destBalance.plus(destAmount)
      if (transfer.destinationAccountType === 'cash') {
        await tx.cashAccount.update({
          where: { id: transfer.destinationAccountId },
          data: { balance: newDestBalance },
        })
        await tx.cashTransaction.create({
          data: {
            cashAccountId: transfer.destinationAccountId,
            businessId: transfer.businessId,
            type: 'transfer',
            amount: destAmount,
            balanceAfter: newDestBalance,
            description: `Transfer In from ${sourceName} (${transfer.transferNumber})`,
            reference: transfer.transferNumber,
            sourceType: 'treasury_transfer',
            sourceId: transfer.id,
            transactionDate: transfer.transferDate,
          },
        })
      } else {
        await tx.bankAccount.update({
          where: { id: transfer.destinationAccountId },
          data: { balance: newDestBalance },
        })
        await tx.bankTransaction.create({
          data: {
            bankAccountId: transfer.destinationAccountId,
            businessId: transfer.businessId,
            type: 'transfer',
            amount: destAmount,
            balanceAfter: newDestBalance,
            description: `Transfer In from ${sourceName} (${transfer.transferNumber})`,
            reference: transfer.transferNumber,
            sourceType: 'treasury_transfer',
            sourceId: transfer.id,
            transactionDate: transfer.transferDate,
          },
        })
      }

      // 5. Post double-entry GL journal entry via AccountingService
      // Debit Destination Account, Credit Source Account
      const entryNumber = await DocumentNumberingService.generateNumber(transfer.businessId, 'journal_entry', tx)
      const journalEntry = await AccountingService.postJournalEntry(
        {
          businessId: transfer.businessId,
          entryNumber,
          entryDate: transfer.transferDate,
          description: `Treasury Transfer ${transfer.transferNumber}: ${sourceName} -> ${destName}`,
          currencyCode: transfer.currencyCode,
          exchangeRate: transfer.exchangeRate.toNumber(),
          reference: transfer.reference || transfer.transferNumber,
          sourceType: 'treasury_transfer',
          sourceId: transfer.id,
          lines: [
            {
              accountId: destGlAccountId,
              debitAmount: destAmount.toNumber(),
              creditAmount: 0,
              description: `Transfer In from ${sourceName}`,
            },
            {
              accountId: sourceGlAccountId,
              debitAmount: 0,
              creditAmount: amount.toNumber(),
              description: `Transfer Out to ${destName}`,
            },
          ],
          userId: validated.userId,
        },
        tx
      )

      // 6. Update transfer record to posted
      const updatedTransfer = await tx.treasuryTransfer.update({
        where: { id: transfer.id },
        data: {
          status: 'posted',
          postedBy: validated.userId,
          postedAt: new Date(),
          journalEntryId: journalEntry.id,
        },
      })

      // 7. Audit log
      await AuditService.log(
        {
          businessId: transfer.businessId,
          userId: validated.userId,
          entityType: 'treasury_transfer',
          entityId: transfer.id,
          action: 'post',
          newData: {
            status: 'posted',
            transferNumber: transfer.transferNumber,
            journalEntryId: journalEntry.id,
          },
        },
        tx
      )

      return {
        transfer: updatedTransfer,
        journalEntry,
        newSourceBalance: newSourceBalance.toNumber(),
        newDestBalance: newDestBalance.toNumber(),
      }
    })
  }

  static async getTransfers(businessId: string, filter?: { status?: string; startDate?: Date; endDate?: Date }) {
    const where: any = { businessId }
    if (filter?.status) where.status = filter.status
    if (filter?.startDate || filter?.endDate) {
      where.transferDate = {}
      if (filter.startDate) where.transferDate.gte = filter.startDate
      if (filter.endDate) where.transferDate.lte = filter.endDate
    }

    return prisma.treasuryTransfer.findMany({
      where,
      include: { creator: true, approver: true, poster: true },
      orderBy: { transferDate: 'desc' },
    })
  }

  static async getTransferById(businessId: string, id: string) {
    const transfer = await prisma.treasuryTransfer.findFirst({
      where: { id, businessId },
      include: { creator: true, approver: true, poster: true },
    })
    if (!transfer) {
      throw new TreasuryError(`Treasury transfer ${id} was not found.`)
    }
    return transfer
  }
}
