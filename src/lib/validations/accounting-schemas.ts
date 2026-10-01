// =============================================================
// Zod Validation Schemas for Phase 03 Accounting Service Layer
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { z } from 'zod'

// Shared schemas
export const uuidSchema = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, { message: 'Invalid UUID format' })
export const positiveDecimalSchema = z.number().positive({ message: 'Amount must be greater than zero' })
export const nonNegativeDecimalSchema = z.number().min(0, { message: 'Amount cannot be negative' })

// -------------------------------------------------------------
// 1. Sales Invoice Posting Schema
// -------------------------------------------------------------
export const salesInvoiceLineSchema = z.object({
  productId: uuidSchema.optional(),
  warehouseId: uuidSchema.optional(),
  description: z.string().min(1, 'Line description is required'),
  quantity: positiveDecimalSchema,
  unitPrice: nonNegativeDecimalSchema,
  discountPercent: z.number().min(0).max(100).default(0),
  taxRatePercent: z.number().min(0).max(100).default(0),
})

export const postSalesInvoiceSchema = z.object({
  businessId: uuidSchema,
  customerId: uuidSchema.optional().nullable(),
  isCash: z.boolean().default(false),
  cashAccountId: uuidSchema.optional().nullable(),
  bankAccountId: uuidSchema.optional().nullable(),
  salesOrderId: uuidSchema.optional(),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  currencyCode: z.string().length(3).default('USD'),
  exchangeRate: positiveDecimalSchema.default(1),
  warehouseId: uuidSchema.optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  lines: z.array(salesInvoiceLineSchema).min(1, 'At least one line item is required'),
  userId: uuidSchema,
})

export type PostSalesInvoiceInput = z.input<typeof postSalesInvoiceSchema>

// -------------------------------------------------------------
// 2. Purchase Invoice Posting Schema
// -------------------------------------------------------------
export const purchaseInvoiceLineSchema = z.object({
  productId: uuidSchema.optional(),
  warehouseId: uuidSchema.optional(),
  description: z.string().min(1, 'Line description is required'),
  quantity: positiveDecimalSchema,
  unitPrice: nonNegativeDecimalSchema,
  taxRatePercent: z.number().min(0).max(100).default(0),
})

export const postPurchaseInvoiceSchema = z.object({
  businessId: uuidSchema,
  supplierId: uuidSchema,
  purchaseOrderId: uuidSchema.optional(),
  purchaseNumber: z.string().min(1, 'Purchase invoice number is required'),
  referenceNumber: z.string().optional(), // Vendor invoice no
  purchaseDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  currencyCode: z.string().length(3).default('USD'),
  exchangeRate: positiveDecimalSchema.default(1),
  warehouseId: uuidSchema.optional(),
  notes: z.string().optional(),
  lines: z.array(purchaseInvoiceLineSchema).min(1, 'At least one line item is required'),
  userId: uuidSchema,
})

export type PostPurchaseInvoiceInput = z.input<typeof postPurchaseInvoiceSchema>

// -------------------------------------------------------------
// 3. Payment Processing & Allocation Schema
// -------------------------------------------------------------
export const paymentAllocationItemSchema = z.object({
  saleId: uuidSchema.optional(),
  purchaseId: uuidSchema.optional(),
  allocatedAmount: positiveDecimalSchema,
})

export const processPaymentSchema = z.object({
  businessId: uuidSchema,
  paymentNumber: z.string().min(1, 'Payment number is required'),
  paymentDate: z.coerce.date(),
  type: z.enum(['incoming', 'outgoing', 'transfer', 'advance', 'refund']),
  method: z.enum(['cash', 'bank_transfer', 'cheque', 'card', 'other']).default('cash'),
  customerId: uuidSchema.optional(),
  supplierId: uuidSchema.optional(),
  cashAccountId: uuidSchema.optional(),
  bankAccountId: uuidSchema.optional(),
  currencyCode: z.string().length(3).default('USD'),
  exchangeRate: positiveDecimalSchema.default(1),
  amount: positiveDecimalSchema,
  reference: z.string().optional(),
  notes: z.string().optional(),
  allocations: z.array(paymentAllocationItemSchema).default([]),
  userId: uuidSchema,
})

export type ProcessPaymentInput = z.input<typeof processPaymentSchema>

// -------------------------------------------------------------
// 4. Accounting & Journal Entry Schemas
// -------------------------------------------------------------
export const journalLineSchema = z.object({
  accountId: uuidSchema,
  description: z.string().optional(),
  currencyCode: z.string().length(3).optional(),
  exchangeRate: positiveDecimalSchema.optional(),
  debitAmount: nonNegativeDecimalSchema.default(0),
  creditAmount: nonNegativeDecimalSchema.default(0),
  customerId: uuidSchema.optional(),
  supplierId: uuidSchema.optional(),
  productId: uuidSchema.optional(),
})

export const postJournalEntrySchema = z.object({
  businessId: uuidSchema,
  entryNumber: z.string().min(1, 'Journal entry number is required'),
  entryDate: z.coerce.date(),
  description: z.string().optional(),
  currencyCode: z.string().length(3).default('USD'),
  exchangeRate: positiveDecimalSchema.default(1),
  reference: z.string().optional(),
  sourceType: z.enum([
    'sale',
    'purchase',
    'payment',
    'expense',
    'manual',
    'opening_balance',
    'inventory_adjustment',
    'closing_entry',
    'treasury_transfer',
    'petty_cash',
    'bank_reconciliation',
    'treasury_transaction',
  ]).default('manual'),
  sourceId: uuidSchema.optional(),
  reversedEntryId: uuidSchema.optional(),
  lines: z.array(journalLineSchema).min(2, 'At least 2 lines are required for double-entry'),
  userId: uuidSchema,
})

export type PostJournalEntryInput = z.input<typeof postJournalEntrySchema>

export const reverseJournalEntrySchema = z.object({
  businessId: uuidSchema,
  journalEntryId: uuidSchema,
  reversalEntryNumber: z.string().min(1, 'Reversal entry number is required'),
  reversalDate: z.coerce.date(),
  reason: z.string().min(1, 'Reversal reason is required'),
  userId: uuidSchema,
})

export type ReverseJournalEntryInput = z.input<typeof reverseJournalEntrySchema>

export const updateJournalEntrySchema = z.object({
  businessId: uuidSchema,
  journalEntryId: uuidSchema,
  entryDate: z.coerce.date(),
  description: z.string().optional(),
  currencyCode: z.string().length(3).optional(),
  exchangeRate: positiveDecimalSchema.optional(),
  reference: z.string().optional(),
  lines: z.array(journalLineSchema).min(2, 'At least 2 lines are required for double-entry'),
  userId: uuidSchema,
})

export type UpdateJournalEntryInput = z.input<typeof updateJournalEntrySchema>

// -------------------------------------------------------------
// 5. Expense Posting Schema
// -------------------------------------------------------------
export const postExpenseSchema = z.object({
  businessId: uuidSchema,
  expenseNumber: z.string().min(1, 'Expense number is required'),
  expenseDate: z.coerce.date(),
  description: z.string().min(1, 'Description is required'),
  vendor: z.string().optional(),
  categoryId: uuidSchema.optional(),
  accountId: uuidSchema, // Expense account in Chart of Accounts
  supplierId: uuidSchema.optional(),
  cashAccountId: uuidSchema.optional(),
  bankAccountId: uuidSchema.optional(),
  currencyCode: z.string().length(3).default('USD'),
  exchangeRate: positiveDecimalSchema.default(1),
  amount: positiveDecimalSchema,
  taxAmount: nonNegativeDecimalSchema.default(0),
  notes: z.string().optional(),
  userId: uuidSchema,
})

export type PostExpenseInput = z.input<typeof postExpenseSchema>

// -------------------------------------------------------------
// 6. Inventory Adjustment & Transfer Schemas
// -------------------------------------------------------------
export const inventoryAdjustmentSchema = z.object({
  businessId: uuidSchema,
  productId: uuidSchema,
  warehouseId: uuidSchema,
  adjustmentType: z.enum(['adjustment_increase', 'adjustment_decrease']),
  quantity: positiveDecimalSchema,
  reason: z.string().min(1, 'Reason for adjustment is required'),
  userId: uuidSchema,
})

export type InventoryAdjustmentInput = z.input<typeof inventoryAdjustmentSchema>

export const warehouseTransferSchema = z.object({
  businessId: uuidSchema,
  productId: uuidSchema,
  fromWarehouseId: uuidSchema,
  toWarehouseId: uuidSchema,
  quantity: positiveDecimalSchema,
  notes: z.string().optional(),
  userId: uuidSchema,
})

export type WarehouseTransferInput = z.input<typeof warehouseTransferSchema>

// -------------------------------------------------------------
// 7. Chart of Accounts Management Schemas
// -------------------------------------------------------------
export const createChartOfAccountSchema = z.object({
  businessId: uuidSchema,
  code: z.string().min(1, 'Account code is required').max(50),
  name: z.string().min(1, 'Account name is required').max(200),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  normalBalance: z.enum(['debit', 'credit']),
  parentId: uuidSchema.optional().nullable(),
  currency: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isHeader: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export type CreateChartOfAccountInput = z.input<typeof createChartOfAccountSchema>

export const updateChartOfAccountSchema = z.object({
  businessId: uuidSchema,
  accountId: uuidSchema,
  code: z.string().min(1, 'Account code is required').max(50),
  name: z.string().min(1, 'Account name is required').max(200),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  normalBalance: z.enum(['debit', 'credit']),
  parentId: uuidSchema.optional().nullable(),
  currency: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  isHeader: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export type UpdateChartOfAccountInput = z.input<typeof updateChartOfAccountSchema>

