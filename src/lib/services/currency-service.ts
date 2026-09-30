// =============================================================
// Currency Service — Currency Configuration & Exchange Rates
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import Decimal from 'decimal.js'

export interface CreateCurrencyInput {
  code: string
  name: string
  symbol: string
  decimalPlaces?: number
  isActive?: boolean
}

export interface SetExchangeRateInput {
  fromCurrency: string
  toCurrency: string
  rate: number
  rateDate?: Date
  source?: string
}

export class CurrencyService {
  /**
   * Get all supported currencies in the system.
   */
  static async getCurrencies(includeInactive = false) {
    return prisma.currency.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { code: 'asc' },
    })
  }

  /**
   * Get a currency by ISO code.
   */
  static async getCurrencyByCode(code: string) {
    return prisma.currency.findUnique({
      where: { code: code.toUpperCase() },
    })
  }

  /**
   * Create or update a currency in the global list.
   */
  static async upsertCurrency(data: CreateCurrencyInput) {
    return prisma.currency.upsert({
      where: { code: data.code.toUpperCase() },
      create: {
        code: data.code.toUpperCase(),
        name: data.name,
        symbol: data.symbol,
        decimalPlaces: data.decimalPlaces ?? 2,
        isActive: data.isActive ?? true,
      },
      update: {
        name: data.name,
        symbol: data.symbol,
        decimalPlaces: data.decimalPlaces ?? 2,
        isActive: data.isActive ?? true,
      },
    })
  }

  /**
   * Get exchange rates for a business.
   */
  static async getExchangeRates(businessId: string, fromCurrency?: string, toCurrency?: string) {
    return prisma.exchangeRate.findMany({
      where: {
        businessId,
        ...(fromCurrency ? { fromCurrency: fromCurrency.toUpperCase() } : {}),
        ...(toCurrency ? { toCurrency: toCurrency.toUpperCase() } : {}),
      },
      orderBy: { rateDate: 'desc' },
      take: 100,
    })
  }

  /**
   * Set an exchange rate for a given business on a specific date.
   * Historical transaction rates stored in journal entries and sales remain untouched.
   */
  static async setExchangeRate(businessId: string, input: SetExchangeRateInput, userId?: string) {
    const rateDate = input.rateDate || new Date()
    const fromCurrency = input.fromCurrency.toUpperCase()
    const toCurrency = input.toCurrency.toUpperCase()

    if (fromCurrency === toCurrency) {
      throw new Error('From and To currencies must be different')
    }

    const created = await prisma.exchangeRate.create({
      data: {
        businessId,
        fromCurrency,
        toCurrency,
        rate: new Decimal(input.rate),
        rateDate,
        source: input.source || 'manual',
      },
    })

    try {
      await prisma.auditLog.create({
        data: {
          businessId,
          userId: userId || null,
          action: 'create',
          module: 'currency_exchange_rates',
          recordId: created.id,
          recordType: 'ExchangeRate',
          newValues: {
            fromCurrency,
            toCurrency,
            rate: input.rate,
            rateDate: rateDate.toISOString(),
          },
          changedFields: ['fromCurrency', 'toCurrency', 'rate', 'rateDate'],
        },
      })
    } catch {
      // Non-blocking
    }

    return created
  }

  /**
   * Get the applicable exchange rate for a transaction date.
   * Finds the latest rate on or before the transaction date.
   */
  static async getExchangeRate(
    businessId: string,
    fromCurrency: string,
    toCurrency: string,
    date: Date = new Date()
  ): Promise<number> {
    const from = fromCurrency.toUpperCase()
    const to = toCurrency.toUpperCase()

    if (from === to) return 1.0

    const rateRecord = await prisma.exchangeRate.findFirst({
      where: {
        businessId,
        fromCurrency: from,
        toCurrency: to,
        rateDate: { lte: date },
      },
      orderBy: { rateDate: 'desc' },
    })

    if (rateRecord) {
      return Number(rateRecord.rate)
    }

    // Try inverse rate
    const inverseRecord = await prisma.exchangeRate.findFirst({
      where: {
        businessId,
        fromCurrency: to,
        toCurrency: from,
        rateDate: { lte: date },
      },
      orderBy: { rateDate: 'desc' },
    })

    if (inverseRecord) {
      const invRate = Number(inverseRecord.rate)
      return invRate > 0 ? 1 / invRate : 1.0
    }

    return 1.0 // Default 1:1 if not configured
  }
}
