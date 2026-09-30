// =============================================================
// Zod Validation Schemas for Phase 11 Treasury & Cash Management
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { z } from 'zod'

export const uuidSchema = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  { message: 'Invalid UUID format' }
)
export const positiveDecimalSchema = z.number().positive({ message: 'Amount must be greater than zero' })
export const nonNegativeDecimalSchema = z.number().min(0, { message: 'Amount cannot be negative' })

// -------------------------------------------------------------
// 1. Cash & Bank Accounts
// -------------------------------------------------------------

export const createCashAccountSchema = z.object({
  businessId: uuidSchema,
  name: z.string().min(1, 'Account name is required').max(100),
  code: z.string().max(50).optional(),
  currencyCode: z.string().length(3).default('USD'),
  openingBalance: nonNegativeDecimalSchema.default(0),
  accountId: uuidSchema, // Mapping to GL Chart of Account is mandatory
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  isPettyCash: z.boolean().default(false),
  custodianId: uuidSchema.optional(),
  targetFloat: nonNegativeDecimalSchema.optional(),
  userId: uuidSchema,
})

export type CreateCashAccountInput = z.input<typeof createCashAccountSchema>

export const updateCashAccountSchema = z.object({
  businessId: uuidSchema,
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(50).optional(),
  accountId: uuidSchema.optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  custodianId: uuidSchema.nullable().optional(),
  targetFloat: nonNegativeDecimalSchema.nullable().optional(),
  userId: uuidSchema,
})

export type UpdateCashAccountInput = z.input<typeof updateCashAccountSchema>

export const createBankAccountSchema = z.object({
  businessId: uuidSchema,
  bankName: z.string().min(1, 'Bank name is required').max(100),
  accountName: z.string().min(1, 'Account name is required').max(100),
  code: z.string().max(50).optional(),
  accountNumber: z.string().max(50).optional(),
  iban: z.string().max(50).optional(),
  swift: z.string().max(20).optional(),
  branch: z.string().max(100).optional(),
  currencyCode: z.string().length(3).default('USD'),
  openingBalance: nonNegativeDecimalSchema.default(0),
  accountId: uuidSchema, // Mapping to GL Chart of Account is mandatory
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  userId: uuidSchema,
})

export type CreateBankAccountInput = z.input<typeof createBankAccountSchema>

export const updateBankAccountSchema = z.object({
  businessId: uuidSchema,
  bankName: z.string().min(1).max(100).optional(),
  accountName: z.string().min(1).max(100).optional(),
  code: z.string().max(50).optional(),
  accountNumber: z.string().max(50).optional(),
  iban: z.string().max(50).optional(),
  swift: z.string().max(20).optional(),
  branch: z.string().max(100).optional(),
  accountId: uuidSchema.optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  userId: uuidSchema,
})

export type UpdateBankAccountInput = z.input<typeof updateBankAccountSchema>

// -------------------------------------------------------------
// 2. Controlled Treasury Transactions
// -------------------------------------------------------------

export const treasuryTransactionTypeSchema = z.enum([
  'cash_deposit',
  'cash_withdrawal',
  'bank_deposit',
  'bank_withdrawal',
  'bank_fee',
  'interest_income',
  'interest_expense',
  'adjustment',
])

export const createTreasuryTransactionSchema = z.object({
  businessId: uuidSchema,
  accountType: z.enum(['cash', 'bank']),
  accountId: uuidSchema, // cashAccountId or bankAccountId
  type: treasuryTransactionTypeSchema,
  amount: positiveDecimalSchema,
  currencyCode: z.string().length(3).default('USD'),
  exchangeRate: positiveDecimalSchema.default(1),
  offsetAccountId: uuidSchema, // GL Account for the counterpart entry
  transactionDate: z.coerce.date(),
  description: z.string().min(1, 'Description is required'),
  reference: z.string().optional(),
  userId: uuidSchema,
})

export type CreateTreasuryTransactionInput = z.input<typeof createTreasuryTransactionSchema>

// -------------------------------------------------------------
// 3. Internal Transfers
// -------------------------------------------------------------

export const createTreasuryTransferSchema = z.object({
  businessId: uuidSchema,
  sourceAccountId: uuidSchema,
  sourceAccountType: z.enum(['cash', 'bank']),
  destinationAccountId: uuidSchema,
  destinationAccountType: z.enum(['cash', 'bank']),
  amount: positiveDecimalSchema,
  currencyCode: z.string().length(3).default('USD'),
  destinationAmount: positiveDecimalSchema.optional(),
  destinationCurrencyCode: z.string().length(3).optional(),
  exchangeRate: positiveDecimalSchema.default(1),
  transferDate: z.coerce.date(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  userId: uuidSchema,
})

export type CreateTreasuryTransferInput = z.input<typeof createTreasuryTransferSchema>

export const approveTreasuryTransferSchema = z.object({
  businessId: uuidSchema,
  transferId: uuidSchema,
  userId: uuidSchema,
})

export type ApproveTreasuryTransferInput = z.input<typeof approveTreasuryTransferSchema>

export const postTreasuryTransferSchema = z.object({
  businessId: uuidSchema,
  transferId: uuidSchema,
  userId: uuidSchema,
})

export type PostTreasuryTransferInput = z.input<typeof postTreasuryTransferSchema>

// -------------------------------------------------------------
// 4. Bank Statements
// -------------------------------------------------------------

export const bankStatementLineSchema = z.object({
  transactionDate: z.coerce.date(),
  valueDate: z.coerce.date().optional(),
  description: z.string().min(1, 'Line description is required'),
  reference: z.string().optional(),
  debitAmount: nonNegativeDecimalSchema.default(0),
  creditAmount: nonNegativeDecimalSchema.default(0),
  amount: z.number(), // Positive for credit, negative for debit, or net
  currencyCode: z.string().length(3).default('USD'),
  externalId: z.string().optional(),
  lineNumber: z.number().int().optional(),
})

export type BankStatementLineInput = z.input<typeof bankStatementLineSchema>

export const importBankStatementSchema = z.object({
  businessId: uuidSchema,
  bankAccountId: uuidSchema,
  statementNumber: z.string().min(1, 'Statement number is required'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  openingBalance: z.number(),
  closingBalance: z.number(),
  currencyCode: z.string().length(3).default('USD'),
  lines: z.array(bankStatementLineSchema).min(1, 'At least one transaction line is required'),
  userId: uuidSchema,
})

export type ImportBankStatementInput = z.input<typeof importBankStatementSchema>

// -------------------------------------------------------------
// 5. Bank Reconciliation Workspace
// -------------------------------------------------------------

export const createBankReconciliationSchema = z.object({
  businessId: uuidSchema,
  bankAccountId: uuidSchema,
  statementId: uuidSchema.optional(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  statementEndingBalance: z.number(),
  notes: z.string().optional(),
  userId: uuidSchema,
})

export type CreateBankReconciliationInput = z.input<typeof createBankReconciliationSchema>

export const autoMatchCriteriaSchema = z.object({
  businessId: uuidSchema,
  reconciliationId: uuidSchema,
  dateToleranceDays: z.number().min(0).max(30).default(3),
  matchReference: z.boolean().default(true),
  matchExternalId: z.boolean().default(true),
  matchAmountExact: z.boolean().default(true),
  userId: uuidSchema,
})

export type AutoMatchCriteriaInput = z.input<typeof autoMatchCriteriaSchema>

export const manualMatchSchema = z.object({
  businessId: uuidSchema,
  reconciliationId: uuidSchema,
  statementLineId: uuidSchema,
  bankTransactionId: uuidSchema.optional(),
  journalEntryLineId: uuidSchema.optional(),
  matchedAmount: positiveDecimalSchema,
  userId: uuidSchema,
})

export type ManualMatchInput = z.input<typeof manualMatchSchema>

export const unmatchSchema = z.object({
  businessId: uuidSchema,
  reconciliationId: uuidSchema,
  matchId: uuidSchema,
  userId: uuidSchema,
})

export type UnmatchInput = z.input<typeof unmatchSchema>

// -------------------------------------------------------------
// 6. Reconciliation Adjustments
// -------------------------------------------------------------

export const reconciliationAdjustmentSchema = z.object({
  businessId: uuidSchema,
  reconciliationId: uuidSchema,
  statementLineId: uuidSchema.optional(),
  adjustmentType: z.enum([
    'bank_fee',
    'interest_income',
    'interest_expense',
    'bank_charge',
    'timing_difference',
    'other',
  ]),
  amount: positiveDecimalSchema,
  currencyCode: z.string().length(3).default('USD'),
  reason: z.string().min(1, 'Reason is required'),
  accountId: uuidSchema, // Offset GL Account
  adjustmentDate: z.coerce.date(),
  userId: uuidSchema,
})

export type ReconciliationAdjustmentInput = z.input<typeof reconciliationAdjustmentSchema>

// -------------------------------------------------------------
// 7. Period Closing & Reopening
// -------------------------------------------------------------

export const closeReconciliationSchema = z.object({
  businessId: uuidSchema,
  reconciliationId: uuidSchema,
  userId: uuidSchema,
  forceClose: z.boolean().default(false), // Allows closing only if diff is 0 or explicitly approved
})

export type CloseReconciliationInput = z.input<typeof closeReconciliationSchema>

export const reopenReconciliationSchema = z.object({
  businessId: uuidSchema,
  reconciliationId: uuidSchema,
  reopenReason: z.string().min(5, 'Detailed reason is required to reopen a closed reconciliation'),
  userId: uuidSchema,
})

export type ReopenReconciliationInput = z.input<typeof reopenReconciliationSchema>

// -------------------------------------------------------------
// 8. Petty Cash Management
// -------------------------------------------------------------

export const pettyCashDenominationItemSchema = z.object({
  denomination: positiveDecimalSchema,
  quantity: z.number().int().min(0),
})

export const createPettyCashCountSchema = z.object({
  businessId: uuidSchema,
  cashAccountId: uuidSchema,
  countDate: z.coerce.date(),
  custodianId: uuidSchema.optional(),
  denominations: z.array(pettyCashDenominationItemSchema).min(1, 'At least one denomination is required'),
  notes: z.string().optional(),
  userId: uuidSchema,
})

export type CreatePettyCashCountInput = z.input<typeof createPettyCashCountSchema>

export const reviewPettyCashCountSchema = z.object({
  businessId: uuidSchema,
  countId: uuidSchema,
  notes: z.string().optional(),
  userId: uuidSchema,
})

export type ReviewPettyCashCountInput = z.input<typeof reviewPettyCashCountSchema>

export const postPettyCashCountSchema = z.object({
  businessId: uuidSchema,
  countId: uuidSchema,
  varianceAccountId: uuidSchema.optional(), // Required if variance != 0
  userId: uuidSchema,
})

export type PostPettyCashCountInput = z.input<typeof postPettyCashCountSchema>

// -------------------------------------------------------------
// 9 & 10. Cash Position & Liquidity Forecast Filters
// -------------------------------------------------------------

export const cashPositionFilterSchema = z.object({
  businessId: uuidSchema,
  asOfDate: z.coerce.date().optional(),
  currency: z.string().length(3).optional(),
  includeInactive: z.boolean().default(false),
})

export type CashPositionFilterInput = z.input<typeof cashPositionFilterSchema>

export const liquidityForecastFilterSchema = z.object({
  businessId: uuidSchema,
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  horizonDays: z.number().int().min(1).max(365).default(30),
  currency: z.string().length(3).optional(),
})

export type LiquidityForecastFilterInput = z.input<typeof liquidityForecastFilterSchema>
