// =============================================================
// Currency Revaluation Service — Period-End FX Revaluation (IAS 21)
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import { AccountingService } from './accounting-service'
import { CurrencyService } from './currency-service'
import { DocumentNumberingService } from './document-numbering-service'

export interface RevaluationCandidate {
  accountId: string
  accountCode: string
  accountName: string
  accountType: string
  currencyCode: string
  foreignBalance: number
  currentBaseBalance: number
  closingExchangeRate: number
  revaluedBaseBalance: number
  unrealizedGainLoss: number // positive for gain, negative for loss
  isGain: boolean
}

export interface RevaluationPreviewResult {
  asOfDate: string
  baseCurrency: string
  candidates: RevaluationCandidate[]
  totalUnrealizedGain: number
  totalUnrealizedLoss: number
  netUnrealizedGainLoss: number
}

export interface ExecuteRevaluationInput {
  asOfDate: Date
  rates: Record<string, number> // e.g. { 'EUR': 1.08, 'USD': 3.75 }
  description?: string
  autoReverse?: boolean
  reversalDate?: Date
}

export class CurrencyRevaluationService {
  /**
   * Ensures that standard FX gain & loss accounts exist in the business chart of accounts.
   */
  static async ensureStandardFxAccounts(businessId: string) {
    const defaultAccounts = [
      {
        code: '420101',
        name: 'أرباح فروق أسعار الصرف المحققة (Realized FX Gain)',
        type: 'revenue' as const,
        normalBalance: 'credit' as const,
        sortOrder: 491,
      },
      {
        code: '520101',
        name: 'خسائر فروق أسعار الصرف المحققة (Realized FX Loss)',
        type: 'expense' as const,
        normalBalance: 'debit' as const,
        sortOrder: 591,
      },
      {
        code: '420102',
        name: 'أرباح إعادة تقييم العملات غير المحققة (Unrealized FX Gain)',
        type: 'revenue' as const,
        normalBalance: 'credit' as const,
        sortOrder: 492,
      },
      {
        code: '520102',
        name: 'خسائر إعادة تقييم العملات غير المحققة (Unrealized FX Loss)',
        type: 'expense' as const,
        normalBalance: 'debit' as const,
        sortOrder: 592,
      },
    ]

    const accountsMap: Record<string, string> = {}

    for (const acc of defaultAccounts) {
      const existing = await prisma.chartOfAccount.findUnique({
        where: { businessId_code: { businessId, code: acc.code } },
      })

      if (existing) {
        accountsMap[acc.code] = existing.id
      } else {
        const created = await prisma.chartOfAccount.create({
          data: {
            businessId,
            code: acc.code,
            name: acc.name,
            type: acc.type,
            normalBalance: acc.normalBalance,
            isSystem: true,
            sortOrder: acc.sortOrder,
          },
        })
        accountsMap[acc.code] = created.id
      }
    }

    return accountsMap
  }

  /**
   * Calculates the revaluation preview for monetary accounts denominated in foreign currencies as of a given date.
   */
  static async getRevaluationPreview(
    businessId: string,
    asOfDate: Date = new Date(),
    customRates?: Record<string, number>
  ): Promise<RevaluationPreviewResult> {
    const business = await prisma.business.findUniqueOrThrow({
      where: { id: businessId },
    })
    const baseCurrency = business.defaultCurrency.toUpperCase()

    // Query all journal lines up to asOfDate grouped by account & currency
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        businessId,
        journalEntry: {
          status: 'posted',
          entryDate: { lte: asOfDate },
        },
      },
      include: {
        account: true,
      },
    })

    // Group balances by (accountId + currencyCode)
    const balances = new Map<
      string,
      {
        account: any
        currencyCode: string
        debitSum: Decimal
        creditSum: Decimal
        baseDebitSum: Decimal
        baseCreditSum: Decimal
      }
    >()

    for (const line of lines) {
      const lineCurr = (line.currencyCode || baseCurrency).toUpperCase()
      const key = `${line.accountId}_${lineCurr}`

      if (!balances.has(key)) {
        balances.set(key, {
          account: line.account,
          currencyCode: lineCurr,
          debitSum: new Decimal(0),
          creditSum: new Decimal(0),
          baseDebitSum: new Decimal(0),
          baseCreditSum: new Decimal(0),
        })
      }

      const item = balances.get(key)!
      item.debitSum = item.debitSum.plus(new Decimal(line.debitAmount || 0))
      item.creditSum = item.creditSum.plus(new Decimal(line.creditAmount || 0))
      item.baseDebitSum = item.baseDebitSum.plus(new Decimal(line.baseDebit || 0))
      item.baseCreditSum = item.baseCreditSum.plus(new Decimal(line.baseCredit || 0))
    }

    const candidates: RevaluationCandidate[] = []
    let totalGain = new Decimal(0)
    let totalLoss = new Decimal(0)

    for (const [, item] of balances.entries()) {
      // Revalue only foreign currency balances
      if (item.currencyCode === baseCurrency) continue

      // Monetary accounts are typically Assets (Cash, Bank, AR) and Liabilities (AP)
      if (item.account.type !== 'asset' && item.account.type !== 'liability') continue

      const isAsset = item.account.type === 'asset'
      const foreignBal = isAsset
        ? item.debitSum.minus(item.creditSum)
        : item.creditSum.minus(item.debitSum)

      if (foreignBal.isZero()) continue

      const currentBaseBal = isAsset
        ? item.baseDebitSum.minus(item.baseCreditSum)
        : item.baseCreditSum.minus(item.baseDebitSum)

      // Determine closing rate
      let closingRate = customRates?.[item.currencyCode]
      if (!closingRate) {
        closingRate = await CurrencyService.getExchangeRate(
          businessId,
          item.currencyCode,
          baseCurrency,
          asOfDate
        )
      }

      const revaluedBaseBal = foreignBal.mul(new Decimal(closingRate))
      const variance = isAsset
        ? revaluedBaseBal.minus(currentBaseBal) // For asset: higher revalued = gain
        : currentBaseBal.minus(revaluedBaseBal) // For liability: lower revalued = gain

      if (variance.abs().lt(0.01)) continue

      const isGain = variance.gte(0)
      if (isGain) {
        totalGain = totalGain.plus(variance)
      } else {
        totalLoss = totalLoss.plus(variance.abs())
      }

      candidates.push({
        accountId: item.account.id,
        accountCode: item.account.code,
        accountName: item.account.name,
        accountType: item.account.type,
        currencyCode: item.currencyCode,
        foreignBalance: foreignBal.toNumber(),
        currentBaseBalance: currentBaseBal.toNumber(),
        closingExchangeRate: Number(closingRate),
        revaluedBaseBalance: revaluedBaseBal.toNumber(),
        unrealizedGainLoss: variance.toNumber(),
        isGain,
      })
    }

    return {
      asOfDate: asOfDate.toISOString().slice(0, 10),
      baseCurrency,
      candidates,
      totalUnrealizedGain: totalGain.toNumber(),
      totalUnrealizedLoss: totalLoss.toNumber(),
      netUnrealizedGainLoss: totalGain.minus(totalLoss).toNumber(),
    }
  }

  /**
   * Executes and posts the period-end FX revaluation journal entry in the General Ledger.
   */
  static async executeRevaluation(
    businessId: string,
    input: ExecuteRevaluationInput,
    userId: string
  ) {
    const preview = await this.getRevaluationPreview(businessId, input.asOfDate, input.rates)

    if (preview.candidates.length === 0) {
      throw new Error('لا توجد فروق أسعار صرف لإعادة تقييمها في التاريخ المحدد.')
    }

    const fxAccounts = await this.ensureStandardFxAccounts(businessId)
    const unrealizedGainAccountId = fxAccounts['420102']
    const unrealizedLossAccountId = fxAccounts['520102']

    const lines: Array<{
      accountId: string
      description: string
      currencyCode: string
      exchangeRate: number
      debitAmount: number
      creditAmount: number
    }> = []

    for (const c of preview.candidates) {
      const isAsset = c.accountType === 'asset'
      const varianceAbs = Math.abs(c.unrealizedGainLoss)

      if (c.isGain) {
        // Gain:
        // For asset: Debit Asset Account, Credit Unrealized Gain
        // For liability: Debit Liability Account, Credit Unrealized Gain
        lines.push({
          accountId: c.accountId,
          description: `إعادة تقييم فروق صرف ${c.currencyCode} (${c.accountName})`,
          currencyCode: preview.baseCurrency,
          exchangeRate: 1,
          debitAmount: varianceAbs,
          creditAmount: 0,
        })
        lines.push({
          accountId: unrealizedGainAccountId,
          description: `أرباح غير محققة لإعادة تقييم ${c.accountCode} - ${c.currencyCode}`,
          currencyCode: preview.baseCurrency,
          exchangeRate: 1,
          debitAmount: 0,
          creditAmount: varianceAbs,
        })
      } else {
        // Loss:
        // For asset: Debit Unrealized Loss, Credit Asset Account
        // For liability: Debit Unrealized Loss, Credit Liability Account
        lines.push({
          accountId: unrealizedLossAccountId,
          description: `خسائر غير محققة لإعادة تقييم ${c.accountCode} - ${c.currencyCode}`,
          currencyCode: preview.baseCurrency,
          exchangeRate: 1,
          debitAmount: varianceAbs,
          creditAmount: 0,
        })
        lines.push({
          accountId: c.accountId,
          description: `تخفيض فروق صرف ${c.currencyCode} (${c.accountName})`,
          currencyCode: preview.baseCurrency,
          exchangeRate: 1,
          debitAmount: 0,
          creditAmount: varianceAbs,
        })
      }
    }

    const entryNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry')
    const desc =
      input.description ||
      `قيد إعادة تقييم فروق أسعار الصرف الدورية (IAS 21) كما في ${preview.asOfDate}`

    const journalEntry = await AccountingService.postJournalEntry({
      businessId,
      entryNumber,
      entryDate: input.asOfDate,
      description: desc,
      currencyCode: preview.baseCurrency,
      exchangeRate: 1,
      sourceType: 'closing_entry',
      reference: `REVAL-${preview.asOfDate}`,
      lines,
      userId,
    })

    // If auto-reverse is requested (standard accounting practice for beginning of next period)
    let reversingEntry = null
    if (input.autoReverse) {
      const nextDay = new Date(input.asOfDate)
      nextDay.setDate(nextDay.getDate() + 1)
      const reversalDate = input.reversalDate || nextDay

      const reversedLines = lines.map((l) => ({
        accountId: l.accountId,
        description: `عكس قيد إعادة التقييم الدوري ${entryNumber}`,
        currencyCode: l.currencyCode,
        exchangeRate: l.exchangeRate,
        debitAmount: l.creditAmount,
        creditAmount: l.debitAmount,
      }))

      const reversalNumber = await DocumentNumberingService.generateNumber(businessId, 'journal_entry')
      reversingEntry = await AccountingService.postJournalEntry({
        businessId,
        entryNumber: reversalNumber,
        entryDate: reversalDate,
        description: `عكس آلي لقيد إعادة التقييم الدوري ${entryNumber}`,
        currencyCode: preview.baseCurrency,
        exchangeRate: 1,
        sourceType: 'closing_entry',
        reversedEntryId: journalEntry.id,
        lines: reversedLines,
        userId,
      })
    }

    return {
      success: true,
      journalEntry,
      reversingEntry,
      preview,
    }
  }
}
