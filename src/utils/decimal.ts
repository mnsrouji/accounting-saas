import Decimal from 'decimal.js'

// Configure Decimal.js for financial precision
Decimal.set({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpPos: 20,
  toExpNeg: -7,
})

/**
 * Add two financial amounts safely.
 * Accepts string, number, or Decimal inputs.
 */
export function add(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  return new Decimal(a).plus(new Decimal(b))
}

/**
 * Subtract b from a.
 */
export function subtract(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  return new Decimal(a).minus(new Decimal(b))
}

/**
 * Multiply two amounts.
 */
export function multiply(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  return new Decimal(a).times(new Decimal(b))
}

/**
 * Divide a by b. Throws if b is zero.
 */
export function divide(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  const divisor = new Decimal(b)
  if (divisor.isZero()) throw new Error('Division by zero')
  return new Decimal(a).dividedBy(divisor)
}

/**
 * Round to 4 decimal places (standard for money amounts).
 */
export function roundMoney(value: string | number | Decimal): Decimal {
  return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
}

/**
 * Round to 10 decimal places (standard for exchange rates).
 */
export function roundRate(value: string | number | Decimal): Decimal {
  return new Decimal(value).toDecimalPlaces(10, Decimal.ROUND_HALF_UP)
}

/**
 * Convert an amount from one currency to base currency.
 */
export function toBaseCurrency(
  amount: string | number | Decimal,
  exchangeRate: string | number | Decimal
): Decimal {
  return roundMoney(multiply(amount, exchangeRate))
}

/**
 * Calculate line total: (quantity × unitPrice) × (1 - discount%) × (1 + tax%)
 */
export function calcLineTotal(params: {
  quantity: string | number | Decimal
  unitPrice: string | number | Decimal
  discountPercent?: string | number | Decimal
  taxPercent?: string | number | Decimal
}): {
  subtotal: Decimal
  discountAmount: Decimal
  taxAmount: Decimal
  lineTotal: Decimal
} {
  const qty = new Decimal(params.quantity)
  const price = new Decimal(params.unitPrice)
  const discountPct = new Decimal(params.discountPercent ?? 0)
  const taxPct = new Decimal(params.taxPercent ?? 0)

  const grossSubtotal = roundMoney(multiply(qty, price))
  const discountAmount = roundMoney(multiply(grossSubtotal, divide(discountPct, 100)))
  const subtotal = roundMoney(subtract(grossSubtotal, discountAmount))
  const taxAmount = roundMoney(multiply(subtotal, divide(taxPct, 100)))
  const lineTotal = roundMoney(add(subtotal, taxAmount))

  return { subtotal, discountAmount, taxAmount, lineTotal }
}

/**
 * Safely convert a Prisma Decimal to a string for serialization.
 * Prisma returns Decimal objects; JSON.stringify converts them to numbers — use this.
 */
export function decimalToString(value: Decimal | null | undefined): string {
  if (value === null || value === undefined) return '0'
  return new Decimal(value.toString()).toString()
}

/**
 * Format a number as a currency string.
 * @example formatCurrency('1234.5', 'USD', 'en') → "$1,234.50"
 */
export function formatCurrency(
  amount: string | number | Decimal,
  currencyCode: string,
  locale: string = 'en'
): string {
  const num = parseFloat(new Decimal(amount).toString())
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(num)
}

export function formatDate(
  date: Date | string | number | null | undefined,
  locale: string = 'en'
): string {
  if (!date) return '—'
  const d = new Date(date)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(d)
}

export { Decimal }
