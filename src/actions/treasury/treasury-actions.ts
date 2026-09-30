'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import {
  TreasuryAccountService,
  TreasuryTransactionService,
  TreasuryTransferService,
  BankStatementService,
  BankReconciliationService,
  PettyCashService,
} from '@/lib/services'
import { DocumentNumberingService } from '@/lib/services/document-numbering-service'
import { prisma } from '@/lib/db/prisma'
import { serializeJson } from '@/utils'

function safeRevalidate(businessId: string) {
  try {
    revalidatePath(`/b/${businessId}/treasury`)
    revalidatePath(`/b/${businessId}/treasury/cash`)
    revalidatePath(`/b/${businessId}/treasury/banks`)
    revalidatePath(`/b/${businessId}/treasury/transactions`)
    revalidatePath(`/b/${businessId}/treasury/transfers`)
    revalidatePath(`/b/${businessId}/treasury/statements`)
    revalidatePath(`/b/${businessId}/treasury/reconciliation`)
    revalidatePath(`/b/${businessId}/treasury/petty-cash`)
    revalidatePath(`/b/${businessId}/treasury/cash-position`)
    revalidatePath(`/b/${businessId}/treasury/forecast`)
    revalidatePath(`/b/${businessId}/treasury/reports`)
    revalidatePath(`/b/${businessId}/dashboard`)
    revalidatePath(`/b/${businessId}/accounting`)
  } catch {}
}

// ----------------------------------------------------------------------
// 1. Treasury Accounts
// ----------------------------------------------------------------------

export async function createCashAccountAction(
  businessId: string,
  data: {
    name: string
    currency: string
    glAccountId: string
    isPettyCash?: boolean
    custodianId?: string
    targetFloat?: number
    openingBalance?: number
  }
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const account = await TreasuryAccountService.createCashAccount({
      businessId,
      name: data.name,
      currencyCode: data.currency,
      accountId: data.glAccountId,
      isPettyCash: !!data.isPettyCash,
      custodianId: data.custodianId,
      targetFloat: data.targetFloat,
      openingBalance: data.openingBalance || 0,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, account })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to create cash account' }
  }
}

export async function createBankAccountAction(
  businessId: string,
  data: {
    name: string
    bankName: string
    accountNumber: string
    iban?: string
    swiftCode?: string
    branch?: string
    currency: string
    glAccountId: string
    openingBalance?: number
  }
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const account = await TreasuryAccountService.createBankAccount({
      businessId,
      accountName: data.name,
      bankName: data.bankName,
      accountNumber: data.accountNumber,
      iban: data.iban,
      swift: data.swiftCode,
      branch: data.branch,
      currencyCode: data.currency,
      accountId: data.glAccountId,
      openingBalance: data.openingBalance || 0,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, account })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to create bank account' }
  }
}

export async function syncTreasuryBalancesAction(businessId: string) {
  try {
    await requireBusinessAccess(businessId)
    await TreasuryAccountService.syncTreasuryBalances(businessId)
    safeRevalidate(businessId)
    return { success: true as const }
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to sync treasury balances' }
  }
}

// ----------------------------------------------------------------------
// 2. Treasury Transactions
// ----------------------------------------------------------------------

export async function postTreasuryTransactionAction(
  businessId: string,
  data: {
    type: 'cash_deposit' | 'cash_withdrawal' | 'bank_deposit' | 'bank_withdrawal' | 'bank_fee' | 'interest_income' | 'interest_expense' | 'adjustment'
    accountType: 'cash' | 'bank'
    accountId: string
    amount: number
    currencyCode?: string
    date: string | Date
    counterpartGlAccountId?: string
    reference?: string
    description: string
  }
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)

    // Find default counterpart GL account if not provided
    let counterpartId = data.counterpartGlAccountId
    if (!counterpartId) {
      const type = data.type.includes('fee') || data.type.includes('expense')
        ? 'expense'
        : data.type.includes('income')
        ? 'revenue'
        : 'asset'
      const defaultAcc = await prisma.chartOfAccount.findFirst({
        where: { businessId, type, isActive: true },
      })
      counterpartId = defaultAcc?.id
    }

    if (!counterpartId) {
      throw new Error('Counterpart GL account could not be resolved.')
    }

    const result = await TreasuryTransactionService.createTransaction({
      businessId,
      accountType: data.accountType,
      accountId: data.accountId,
      type: data.type,
      amount: data.amount,
      currencyCode: data.currencyCode || 'USD',
      exchangeRate: 1,
      offsetAccountId: counterpartId,
      transactionDate: new Date(data.date),
      description: data.description,
      reference: data.reference,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, result })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to post treasury transaction' }
  }
}

// ----------------------------------------------------------------------
// 3. Internal Transfers
// ----------------------------------------------------------------------

export async function createTransferAction(
  businessId: string,
  data: {
    sourceAccountType: 'cash' | 'bank'
    sourceAccountId: string
    destinationAccountType: 'cash' | 'bank'
    destinationAccountId: string
    amount: number
    currency: string
    destinationAmount?: number
    destinationCurrency?: string
    exchangeRate?: number
    transferDate: string | Date
    reference?: string
    notes?: string
  }
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const transfer = await TreasuryTransferService.createTransfer({
      businessId,
      sourceAccountType: data.sourceAccountType,
      sourceAccountId: data.sourceAccountId,
      destinationAccountType: data.destinationAccountType,
      destinationAccountId: data.destinationAccountId,
      amount: data.amount,
      currencyCode: data.currency,
      destinationAmount: data.destinationAmount,
      destinationCurrencyCode: data.destinationCurrency,
      exchangeRate: data.exchangeRate || 1,
      transferDate: new Date(data.transferDate),
      reference: data.reference,
      notes: data.notes,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, transfer })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to create transfer' }
  }
}

export async function approveTransferAction(businessId: string, transferId: string) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const transfer = await TreasuryTransferService.approveTransfer({
      businessId,
      transferId,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, transfer })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to approve transfer' }
  }
}

export async function postTransferAction(businessId: string, transferId: string) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const result = await TreasuryTransferService.postTransfer({
      businessId,
      transferId,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, result })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to post transfer' }
  }
}

// ----------------------------------------------------------------------
// 4. Bank Statements
// ----------------------------------------------------------------------

export async function importBankStatementAction(
  businessId: string,
  data: {
    bankAccountId: string
    startDate: string | Date
    endDate: string | Date
    openingBalance: number
    closingBalance: number
    lines: Array<{
      date: string | Date
      valueDate?: string | Date
      description: string
      reference?: string
      amount: number
      type: 'debit' | 'credit'
      externalTxnId?: string
    }>
  }
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const statementNumber = await DocumentNumberingService.generateNumber(businessId, 'bank_statement')

    const statement = await BankStatementService.importStatement({
      businessId,
      bankAccountId: data.bankAccountId,
      statementNumber,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      openingBalance: data.openingBalance,
      closingBalance: data.closingBalance,
      currencyCode: 'USD',
      lines: data.lines.map((l, idx) => ({
        transactionDate: new Date(l.date),
        valueDate: l.valueDate ? new Date(l.valueDate) : undefined,
        description: l.description,
        reference: l.reference,
        amount: l.type === 'debit' ? -Math.abs(l.amount) : Math.abs(l.amount),
        debitAmount: l.type === 'debit' ? Math.abs(l.amount) : 0,
        creditAmount: l.type === 'credit' ? Math.abs(l.amount) : 0,
        currencyCode: 'USD',
        externalId: l.externalTxnId,
        lineNumber: idx + 1,
      })),
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, statement })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to import bank statement' }
  }
}

// ----------------------------------------------------------------------
// 5. Bank Reconciliation
// ----------------------------------------------------------------------

export async function createReconciliationSessionAction(
  businessId: string,
  data: {
    bankAccountId: string
    statementId?: string
    statementDate: string | Date
    statementBalance: number
  }
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const session = await BankReconciliationService.createReconciliation({
      businessId,
      bankAccountId: data.bankAccountId,
      statementId: data.statementId,
      periodStart: new Date(new Date(data.statementDate).getTime() - 30 * 24 * 60 * 60 * 1000),
      periodEnd: new Date(data.statementDate),
      statementEndingBalance: data.statementBalance,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, session })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to create reconciliation session' }
  }
}

export async function autoMatchTransactionsAction(
  businessId: string,
  reconciliationId: string,
  options?: {
    dateToleranceDays?: number
    matchReference?: boolean
    matchDescription?: boolean
  }
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const result = await BankReconciliationService.autoMatch({
      businessId,
      reconciliationId,
      dateToleranceDays: options?.dateToleranceDays ?? 3,
      matchReference: options?.matchReference ?? true,
      matchExternalId: true,
      matchAmountExact: true,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, result })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Auto match failed' }
  }
}

export async function matchTransactionsManuallyAction(
  businessId: string,
  data: {
    reconciliationId: string
    statementLineId: string
    bankTransactionId: string
    matchType?: string
  }
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    // Find amount of the statement line
    const line = await prisma.bankStatementLine.findUnique({
      where: { id: data.statementLineId },
    })
    const matchedAmount = line ? Math.abs(Number(line.amount)) : 0

    const match = await BankReconciliationService.manualMatch({
      businessId,
      reconciliationId: data.reconciliationId,
      statementLineId: data.statementLineId,
      bankTransactionId: data.bankTransactionId,
      matchedAmount,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, match })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to match transactions' }
  }
}

export async function unmatchTransactionAction(
  businessId: string,
  reconciliationId: string,
  matchId: string
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const result = await BankReconciliationService.unmatch({
      businessId,
      reconciliationId,
      matchId,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, result })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to unmatch transaction' }
  }
}

export async function postReconciliationAdjustmentAction(
  businessId: string,
  data: {
    reconciliationId: string
    reason: 'bank_fee' | 'interest_income' | 'interest_expense' | 'bank_charge' | 'timing_difference' | 'other'
    amount: number
    glAccountId: string
    date: string | Date
    notes?: string
  }
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const adjustment = await BankReconciliationService.createAdjustment({
      businessId,
      reconciliationId: data.reconciliationId,
      adjustmentType: data.reason,
      amount: data.amount,
      currencyCode: 'USD',
      reason: data.notes || `Reconciliation adjustment for ${data.reason}`,
      accountId: data.glAccountId,
      adjustmentDate: new Date(data.date),
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, adjustment })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to create adjustment' }
  }
}

export async function closeReconciliationPeriodAction(
  businessId: string,
  reconciliationId: string
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const session = await BankReconciliationService.closePeriod({
      businessId,
      reconciliationId,
      forceClose: true,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, session })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to close reconciliation period' }
  }
}

export async function reopenReconciliationPeriodAction(
  businessId: string,
  reconciliationId: string,
  reason: string
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const session = await BankReconciliationService.reopenPeriod({
      businessId,
      reconciliationId,
      reopenReason: reason,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, session })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to reopen reconciliation period' }
  }
}

// ----------------------------------------------------------------------
// 6. Petty Cash
// ----------------------------------------------------------------------

export async function createPettyCashCountAction(
  businessId: string,
  data: {
    cashAccountId: string
    countDate: string | Date
    denominations: Array<{
      denomination: number
      count: number
    }>
    notes?: string
  }
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const count = await PettyCashService.createCashCount({
      businessId,
      cashAccountId: data.cashAccountId,
      countDate: new Date(data.countDate),
      denominations: data.denominations.map((d) => ({
        denomination: d.denomination,
        quantity: d.count,
      })),
      notes: data.notes,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, count })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to create cash count' }
  }
}

export async function reviewPettyCashCountAction(businessId: string, countId: string) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const count = await PettyCashService.reviewCashCount({
      businessId,
      countId,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, count })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to review cash count' }
  }
}

export async function postPettyCashCountAction(
  businessId: string,
  data: {
    countId: string
    varianceGlAccountId?: string
  }
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const count = await PettyCashService.postCashCount({
      businessId,
      countId: data.countId,
      varianceAccountId: data.varianceGlAccountId,
      userId,
    })
    safeRevalidate(businessId)
    return serializeJson({ success: true as const, count })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'Failed to post cash count' }
  }
}
