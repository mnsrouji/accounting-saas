// =============================================================
// Zod Validation Schemas for Phase 08 Commercial & ERP Workflows
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { z } from 'zod'
import { uuidSchema, positiveDecimalSchema, nonNegativeDecimalSchema } from './accounting-schemas'

// -------------------------------------------------------------
// 1. Quotations
// -------------------------------------------------------------
export const quotationLineSchema = z.object({
  productId: uuidSchema.optional(),
  description: z.string().min(1, 'Line description is required'),
  quantity: positiveDecimalSchema,
  unitPrice: nonNegativeDecimalSchema,
  discount: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
})

export const createQuotationSchema = z.object({
  businessId: uuidSchema,
  customerId: uuidSchema,
  quotationNumber: z.string().optional(),
  quotationDate: z.coerce.date(),
  validUntil: z.coerce.date().optional(),
  currency: z.string().length(3).default('USD'),
  exchangeRate: positiveDecimalSchema.default(1),
  notes: z.string().optional(),
  terms: z.string().optional(),
  lines: z.array(quotationLineSchema).min(1, 'At least one line item is required'),
  userId: uuidSchema,
})

export type CreateQuotationInput = z.input<typeof createQuotationSchema>

// -------------------------------------------------------------
// 2. Sales Orders
// -------------------------------------------------------------
export const salesOrderLineSchema = z.object({
  productId: uuidSchema.optional(),
  warehouseId: uuidSchema.optional(),
  description: z.string().min(1, 'Line description is required'),
  quantity: positiveDecimalSchema,
  unitPrice: nonNegativeDecimalSchema,
  discount: z.number().min(0).max(100).default(0),
  taxRate: z.number().min(0).max(100).default(0),
})

export const createSalesOrderSchema = z.object({
  businessId: uuidSchema,
  customerId: uuidSchema,
  quotationId: uuidSchema.optional(),
  warehouseId: uuidSchema.optional(),
  orderNumber: z.string().optional(),
  orderDate: z.coerce.date(),
  deliveryDate: z.coerce.date().optional(),
  currency: z.string().length(3).default('USD'),
  exchangeRate: positiveDecimalSchema.default(1),
  notes: z.string().optional(),
  lines: z.array(salesOrderLineSchema).min(1, 'At least one line item is required'),
  userId: uuidSchema,
})

export type CreateSalesOrderInput = z.input<typeof createSalesOrderSchema>

// -------------------------------------------------------------
// 3. Delivery Notes
// -------------------------------------------------------------
export const deliveryNoteLineSchema = z.object({
  salesOrderItemId: uuidSchema.optional(),
  productId: uuidSchema,
  warehouseId: uuidSchema.optional(),
  orderedQuantity: nonNegativeDecimalSchema.default(0),
  deliveredQuantity: positiveDecimalSchema,
  notes: z.string().optional(),
})

export const createDeliveryNoteSchema = z.object({
  businessId: uuidSchema,
  salesOrderId: uuidSchema.optional(),
  customerId: uuidSchema,
  warehouseId: uuidSchema.optional(),
  deliveryNumber: z.string().optional(),
  deliveryDate: z.coerce.date(),
  trackingNumber: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(deliveryNoteLineSchema).min(1, 'At least one line item is required'),
  userId: uuidSchema,
})

export type CreateDeliveryNoteInput = z.input<typeof createDeliveryNoteSchema>

// -------------------------------------------------------------
// 4. Purchase Requests
// -------------------------------------------------------------
export const purchaseRequestLineSchema = z.object({
  productId: uuidSchema,
  quantity: positiveDecimalSchema,
  estimatedUnitPrice: nonNegativeDecimalSchema.optional(),
  notes: z.string().optional(),
})

export const createPurchaseRequestSchema = z.object({
  businessId: uuidSchema,
  warehouseId: uuidSchema.optional(),
  requestNumber: z.string().optional(),
  requestDate: z.coerce.date(),
  requiredDate: z.coerce.date().optional(),
  department: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(purchaseRequestLineSchema).min(1, 'At least one line item is required'),
  userId: uuidSchema,
})

export type CreatePurchaseRequestInput = z.input<typeof createPurchaseRequestSchema>

// -------------------------------------------------------------
// 5. Purchase Orders
// -------------------------------------------------------------
export const purchaseOrderLineSchema = z.object({
  productId: uuidSchema.optional(),
  warehouseId: uuidSchema.optional(),
  description: z.string().min(1, 'Line description is required'),
  quantity: positiveDecimalSchema,
  unitPrice: nonNegativeDecimalSchema,
  taxRate: z.number().min(0).max(100).default(0),
})

export const createPurchaseOrderSchema = z.object({
  businessId: uuidSchema,
  supplierId: uuidSchema,
  purchaseRequestId: uuidSchema.optional(),
  warehouseId: uuidSchema.optional(),
  orderNumber: z.string().optional(),
  orderDate: z.coerce.date(),
  currency: z.string().length(3).default('USD'),
  exchangeRate: positiveDecimalSchema.default(1),
  notes: z.string().optional(),
  lines: z.array(purchaseOrderLineSchema).min(1, 'At least one line item is required'),
  userId: uuidSchema,
})

export type CreatePurchaseOrderInput = z.input<typeof createPurchaseOrderSchema>

// -------------------------------------------------------------
// 6. Goods Receipts
// -------------------------------------------------------------
export const goodsReceiptLineSchema = z.object({
  purchaseOrderItemId: uuidSchema.optional(),
  productId: uuidSchema,
  warehouseId: uuidSchema.optional(),
  orderedQuantity: nonNegativeDecimalSchema.default(0),
  receivedQuantity: positiveDecimalSchema,
  unitCost: nonNegativeDecimalSchema.default(0),
  notes: z.string().optional(),
})

export const createGoodsReceiptSchema = z.object({
  businessId: uuidSchema,
  purchaseOrderId: uuidSchema.optional(),
  supplierId: uuidSchema,
  warehouseId: uuidSchema.optional(),
  receiptNumber: z.string().optional(),
  receiptDate: z.coerce.date(),
  supplierDeliveryNote: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(goodsReceiptLineSchema).min(1, 'At least one line item is required'),
  userId: uuidSchema,
})

export type CreateGoodsReceiptInput = z.input<typeof createGoodsReceiptSchema>

// -------------------------------------------------------------
// 7. Sales Returns
// -------------------------------------------------------------
export const salesReturnLineSchema = z.object({
  saleItemId: uuidSchema.optional(),
  productId: uuidSchema,
  warehouseId: uuidSchema.optional(),
  quantity: positiveDecimalSchema,
  unitPrice: nonNegativeDecimalSchema,
  taxRate: z.number().min(0).max(100).default(0),
})

export const createSalesReturnSchema = z.object({
  businessId: uuidSchema,
  saleId: uuidSchema.optional(),
  customerId: uuidSchema,
  warehouseId: uuidSchema.optional(),
  returnNumber: z.string().optional(),
  returnDate: z.coerce.date(),
  reason: z.string().optional(),
  lines: z.array(salesReturnLineSchema).min(1, 'At least one line item is required'),
  userId: uuidSchema,
})

export type CreateSalesReturnInput = z.input<typeof createSalesReturnSchema>

// -------------------------------------------------------------
// 8. Purchase Returns
// -------------------------------------------------------------
export const purchaseReturnLineSchema = z.object({
  purchaseItemId: uuidSchema.optional(),
  productId: uuidSchema,
  warehouseId: uuidSchema.optional(),
  quantity: positiveDecimalSchema,
  unitCost: nonNegativeDecimalSchema,
  taxRate: z.number().min(0).max(100).default(0),
})

export const createPurchaseReturnSchema = z.object({
  businessId: uuidSchema,
  purchaseId: uuidSchema.optional(),
  supplierId: uuidSchema,
  warehouseId: uuidSchema.optional(),
  returnNumber: z.string().optional(),
  returnDate: z.coerce.date(),
  reason: z.string().optional(),
  lines: z.array(purchaseReturnLineSchema).min(1, 'At least one line item is required'),
  userId: uuidSchema,
})

export type CreatePurchaseReturnInput = z.input<typeof createPurchaseReturnSchema>

// -------------------------------------------------------------
// 9. Credit & Debit Notes
// -------------------------------------------------------------
export const creditDebitNoteLineSchema = z.object({
  productId: uuidSchema.optional(),
  accountId: uuidSchema.optional(),
  description: z.string().min(1, 'Description is required'),
  quantity: positiveDecimalSchema.default(1),
  unitPrice: nonNegativeDecimalSchema,
  taxRate: z.number().min(0).max(100).default(0),
})

export const createCreditDebitNoteSchema = z.object({
  businessId: uuidSchema,
  type: z.enum(['credit_note', 'debit_note']),
  customerId: uuidSchema.optional(),
  supplierId: uuidSchema.optional(),
  relatedSaleId: uuidSchema.optional(),
  relatedPurchaseId: uuidSchema.optional(),
  noteNumber: z.string().optional(),
  noteDate: z.coerce.date(),
  reason: z.string().optional(),
  currency: z.string().length(3).default('USD'),
  exchangeRate: positiveDecimalSchema.default(1),
  lines: z.array(creditDebitNoteLineSchema).min(1, 'At least one line item is required'),
  userId: uuidSchema,
})

export type CreateCreditDebitNoteInput = z.input<typeof createCreditDebitNoteSchema>
