// =============================================================
// Cash Position Service — Real-Time Multi-Currency Liquidity View
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'
import {
  cashPositionFilterSchema,
  CashPositionFilterInput,
} from '@/lib/validations/treasury-schemas'

export interface CurrencyCashPosition {
  currencyCode: string
  cashOnHand: number
  pettyCash: number
  bankBalances: number
  totalLiquidFunds: number
  accountBreakdown: {
    id: string
    name: string
    type: 'cash' | 'petty_cash' | 'bank'
    accountNumber?: string
    currencyCode: string
    balance: number
    glAccountCode?: string
    glAccountName?: string
  }[]
}

export interface BusinessCashPositionSummary {
  businessId: string
  asOfDate: Date
  positionsByCurrency: Record<string, CurrencyCashPosition>
  totalAccountsCount: {
    cash: number
    pettyCash: number
    bank: number
    total: number
  }
}

export class CashPositionService {
  /**
   * Calculate real-time cash position segmented by currency and account.
   */
  static async getCashPosition(input: CashPositionFilterInput): Promise<BusinessCashPositionSummary> {
    const validated = cashPositionFilterSchema.parse(input)
    const asOf = validated.asOfDate || new Date()

    // Fetch cash accounts
    const cashWhere: any = { businessId: validated.businessId }
    if (!validated.includeInactive) cashWhere.isActive = true
    if (validated.currency) cashWhere.currencyCode = validated.currency

    const cashAccounts = await prisma.cashAccount.findMany({
      where: cashWhere,
      include: {
        account: {
          include: {
            journalLines: {
              where: {
                businessId: validated.businessId,
                journalEntry: {
                  status: 'posted',
                  entryDate: { lte: asOf },
                },
              },
            },
          },
        },
      },
    })

    // Fetch bank accounts
    const bankWhere: any = { businessId: validated.businessId }
    if (!validated.includeInactive) bankWhere.isActive = true
    if (validated.currency) bankWhere.currencyCode = validated.currency

    const bankAccounts = await prisma.bankAccount.findMany({
      where: bankWhere,
      include: {
        account: {
          include: {
            journalLines: {
              where: {
                businessId: validated.businessId,
                journalEntry: {
                  status: 'posted',
                  entryDate: { lte: asOf },
                },
              },
            },
          },
        },
      },
    })

    const positionsByCurrency: Record<string, CurrencyCashPosition> = {}

    let countCash = 0
    let countPetty = 0
    let countBank = bankAccounts.length

    // Process Cash Accounts
    for (const ca of cashAccounts) {
      const cur = ca.currencyCode
      if (!positionsByCurrency[cur]) {
        positionsByCurrency[cur] = {
          currencyCode: cur,
          cashOnHand: 0,
          pettyCash: 0,
          bankBalances: 0,
          totalLiquidFunds: 0,
          accountBreakdown: [],
        }
      }

      // Calculate effective balance: If linked to GL account with journal lines, use GL ledger balance
      let bal: number
      if (ca.account && ca.account.journalLines && ca.account.journalLines.length > 0) {
        const totalDebit = ca.account.journalLines.reduce((s, l) => s.plus(new Decimal(l.debitAmount)), new Decimal(0))
        const totalCredit = ca.account.journalLines.reduce((s, l) => s.plus(new Decimal(l.creditAmount)), new Decimal(0))
        const glNet = totalDebit.minus(totalCredit).toNumber()
        bal = glNet
      } else {
        bal = new Decimal(ca.balance).toNumber()
      }

      if (ca.isPettyCash) {
        countPetty++
        positionsByCurrency[cur].pettyCash = new Decimal(positionsByCurrency[cur].pettyCash).plus(bal).toNumber()
      } else {
        countCash++
        positionsByCurrency[cur].cashOnHand = new Decimal(positionsByCurrency[cur].cashOnHand).plus(bal).toNumber()
      }

      positionsByCurrency[cur].totalLiquidFunds = new Decimal(positionsByCurrency[cur].totalLiquidFunds).plus(bal).toNumber()

      positionsByCurrency[cur].accountBreakdown.push({
        id: ca.id,
        name: ca.name,
        type: ca.isPettyCash ? 'petty_cash' : 'cash',
        currencyCode: ca.currencyCode,
        balance: bal,
        glAccountCode: ca.account?.code,
        glAccountName: ca.account?.name,
      })
    }

    // Process Bank Accounts
    for (const ba of bankAccounts) {
      const cur = ba.currencyCode
      if (!positionsByCurrency[cur]) {
        positionsByCurrency[cur] = {
          currencyCode: cur,
          cashOnHand: 0,
          pettyCash: 0,
          bankBalances: 0,
          totalLiquidFunds: 0,
          accountBreakdown: [],
        }
      }

      // Calculate effective balance: If linked to GL account with journal lines, use GL ledger balance
      let bal: number
      if (ba.account && ba.account.journalLines && ba.account.journalLines.length > 0) {
        const totalDebit = ba.account.journalLines.reduce((s, l) => s.plus(new Decimal(l.debitAmount)), new Decimal(0))
        const totalCredit = ba.account.journalLines.reduce((s, l) => s.plus(new Decimal(l.creditAmount)), new Decimal(0))
        const glNet = totalDebit.minus(totalCredit).toNumber()
        bal = glNet
      } else {
        bal = new Decimal(ba.balance).toNumber()
      }

      positionsByCurrency[cur].bankBalances = new Decimal(positionsByCurrency[cur].bankBalances).plus(bal).toNumber()
      positionsByCurrency[cur].totalLiquidFunds = new Decimal(positionsByCurrency[cur].totalLiquidFunds).plus(bal).toNumber()

      positionsByCurrency[cur].accountBreakdown.push({
        id: ba.id,
        name: `${ba.bankName} - ${ba.accountName}`,
        type: 'bank',
        accountNumber: ba.accountNumber || ba.iban || undefined,
        currencyCode: ba.currencyCode,
        balance: bal,
        glAccountCode: ba.account?.code,
        glAccountName: ba.account?.name,
      })
    }

    return {
      businessId: validated.businessId,
      asOfDate: asOf,
      positionsByCurrency,
      totalAccountsCount: {
        cash: countCash,
        pettyCash: countPetty,
        bank: countBank,
        total: countCash + countPetty + countBank,
      },
    }
  }
}

