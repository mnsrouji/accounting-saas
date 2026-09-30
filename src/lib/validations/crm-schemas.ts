// =============================================================
// Zod Validation Schemas for Phase 10 CRM & Collections Workflows
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { z } from 'zod'
import { uuidSchema, nonNegativeDecimalSchema, positiveDecimalSchema } from './accounting-schemas'

// -------------------------------------------------------------
// 1. Customer Groups & Segmentation
// -------------------------------------------------------------
export const createCustomerGroupSchema = z.object({
  businessId: uuidSchema,
  name: z.string().min(1, 'Group name is required').max(100),
  code: z.string().max(50).optional().nullable(),
  description: z.string().optional().nullable(),
  discountPercent: z.number().min(0).max(100).default(0),
  priceTier: z.string().optional().nullable(),
  creditLimit: nonNegativeDecimalSchema.optional().nullable(),
  paymentTerms: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
})

export const updateCustomerGroupSchema = createCustomerGroupSchema.partial().extend({
  id: uuidSchema,
  businessId: uuidSchema,
})

export type CreateCustomerGroupInput = z.input<typeof createCustomerGroupSchema>
export type UpdateCustomerGroupInput = z.input<typeof updateCustomerGroupSchema>

// -------------------------------------------------------------
// 2. Contacts (Customer & Supplier)
// -------------------------------------------------------------
export const createCustomerContactSchema = z.object({
  businessId: uuidSchema,
  customerId: uuidSchema,
  name: z.string().min(1, 'Contact name is required').max(100),
  title: z.string().max(100).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  mobile: z.string().max(50).optional().nullable(),
  whatsapp: z.string().max(50).optional().nullable(),
  isPrimary: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})

export const updateCustomerContactSchema = createCustomerContactSchema.partial().extend({
  id: uuidSchema,
  businessId: uuidSchema,
})

export type CreateCustomerContactInput = z.input<typeof createCustomerContactSchema>
export type UpdateCustomerContactInput = z.input<typeof updateCustomerContactSchema>

export const createSupplierContactSchema = z.object({
  businessId: uuidSchema,
  supplierId: uuidSchema,
  name: z.string().min(1, 'Contact name is required').max(100),
  title: z.string().max(100).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  mobile: z.string().max(50).optional().nullable(),
  whatsapp: z.string().max(50).optional().nullable(),
  isPrimary: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
})

export const updateSupplierContactSchema = createSupplierContactSchema.partial().extend({
  id: uuidSchema,
  businessId: uuidSchema,
})

export type CreateSupplierContactInput = z.input<typeof createSupplierContactSchema>
export type UpdateSupplierContactInput = z.input<typeof updateSupplierContactSchema>

// -------------------------------------------------------------
// 3. CRM Activities
// -------------------------------------------------------------
export const activityTypeSchema = z.enum([
  'call',
  'email',
  'meeting',
  'whatsapp',
  'follow_up',
  'note',
  'task',
])

export const createCrmActivitySchema = z.object({
  businessId: uuidSchema,
  customerId: uuidSchema.optional().nullable(),
  supplierId: uuidSchema.optional().nullable(),
  customerContactId: uuidSchema.optional().nullable(),
  supplierContactId: uuidSchema.optional().nullable(),
  opportunityId: uuidSchema.optional().nullable(),
  activityType: activityTypeSchema,
  subject: z.string().min(1, 'Subject is required').max(255),
  description: z.string().optional().nullable(),
  activityDate: z.coerce.date().default(() => new Date()),
  dueDate: z.coerce.date().optional().nullable(),
  status: z.enum(['pending', 'completed', 'cancelled']).default('completed'),
  outcome: z.string().optional().nullable(),
  relatedEntityType: z.string().optional().nullable(),
  relatedEntityId: uuidSchema.optional().nullable(),
  userId: uuidSchema.optional().nullable(),
})

export const updateCrmActivitySchema = createCrmActivitySchema.partial().extend({
  id: uuidSchema,
  businessId: uuidSchema,
})

export type CreateCrmActivityInput = z.input<typeof createCrmActivitySchema>
export type UpdateCrmActivityInput = z.input<typeof updateCrmActivitySchema>

// -------------------------------------------------------------
// 4. CRM Tasks
// -------------------------------------------------------------
export const taskPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent'])
export const taskStatusSchema = z.enum(['open', 'in_progress', 'completed', 'cancelled'])

export const createCrmTaskSchema = z.object({
  businessId: uuidSchema,
  customerId: uuidSchema.optional().nullable(),
  supplierId: uuidSchema.optional().nullable(),
  opportunityId: uuidSchema.optional().nullable(),
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional().nullable(),
  dueDate: z.coerce.date(),
  priority: taskPrioritySchema.default('medium'),
  status: taskStatusSchema.default('open'),
  reminderAt: z.coerce.date().optional().nullable(),
  relatedEntityType: z.string().optional().nullable(),
  relatedEntityId: uuidSchema.optional().nullable(),
  assignedToId: uuidSchema.optional().nullable(),
  createdById: uuidSchema.optional().nullable(),
})

export const updateCrmTaskSchema = createCrmTaskSchema.partial().extend({
  id: uuidSchema,
  businessId: uuidSchema,
})

export type CreateCrmTaskInput = z.input<typeof createCrmTaskSchema>
export type UpdateCrmTaskInput = z.input<typeof updateCrmTaskSchema>

// -------------------------------------------------------------
// 5. Sales Opportunities
// -------------------------------------------------------------
export const opportunityStageSchema = z.enum([
  'lead',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
])

export const createOpportunitySchema = z.object({
  businessId: uuidSchema,
  customerId: uuidSchema.optional().nullable(),
  name: z.string().min(1, 'Opportunity name is required').max(255),
  expectedValue: nonNegativeDecimalSchema.default(0),
  currency: z.string().length(3).default('USD'),
  probability: z.number().int().min(0).max(100).default(50),
  stage: opportunityStageSchema.default('lead'),
  expectedClosingDate: z.coerce.date().optional().nullable(),
  actualClosingDate: z.coerce.date().optional().nullable(),
  source: z.string().optional().nullable(),
  assignedUserId: uuidSchema.optional().nullable(),
  lostReason: z.string().optional().nullable(),
  nextAction: z.string().optional().nullable(),
  nextActionDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
  quotationId: uuidSchema.optional().nullable(),
  salesOrderId: uuidSchema.optional().nullable(),
})

export const updateOpportunitySchema = createOpportunitySchema.partial().extend({
  id: uuidSchema,
  businessId: uuidSchema,
})

export type CreateOpportunityInput = z.input<typeof createOpportunitySchema>
export type UpdateOpportunityInput = z.input<typeof updateOpportunitySchema>

// -------------------------------------------------------------
// 6. Payment Promises
// -------------------------------------------------------------
export const promiseStatusSchema = z.enum(['open', 'kept', 'broken', 'cancelled'])

export const createPaymentPromiseSchema = z.object({
  businessId: uuidSchema,
  customerId: uuidSchema,
  invoiceId: uuidSchema.optional().nullable(),
  promisedAmount: positiveDecimalSchema,
  promiseDate: z.coerce.date(),
  assignedUserId: uuidSchema.optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const updatePaymentPromiseSchema = z.object({
  id: uuidSchema,
  businessId: uuidSchema,
  status: promiseStatusSchema.optional(),
  actualPaidAmount: nonNegativeDecimalSchema.optional(),
  paidAt: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type CreatePaymentPromiseInput = z.input<typeof createPaymentPromiseSchema>
export type UpdatePaymentPromiseInput = z.input<typeof updatePaymentPromiseSchema>

// -------------------------------------------------------------
// 7. Credit Management & Overrides
// -------------------------------------------------------------
export const creditControlConfigSchema = z.object({
  blockOnCreditLimitExceeded: z.boolean().default(true),
  blockOnOverdueInvoices: z.boolean().default(true),
  warningThresholdPercent: z.number().min(0).max(100).default(80),
  maxOverdueDaysAllowed: z.number().int().min(0).default(30),
})

export type CreditControlConfigInput = z.input<typeof creditControlConfigSchema>

export const createCreditOverrideSchema = z.object({
  businessId: uuidSchema,
  customerId: uuidSchema,
  salesOrderId: uuidSchema.optional().nullable(),
  authorizedBy: uuidSchema.optional(),
  requestedAmount: nonNegativeDecimalSchema,
  currentExposure: nonNegativeDecimalSchema,
  creditLimit: nonNegativeDecimalSchema,
  reason: z.string().min(5, 'Reason for credit override must be at least 5 characters'),
  expiresAt: z.coerce.date().optional().nullable(),
})

export type CreateCreditOverrideInput = z.input<typeof createCreditOverrideSchema>
