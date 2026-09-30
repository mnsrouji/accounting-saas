// =============================================================
// Tax Service — Configurable Business Tax Management
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { TaxType } from '@prisma/client'
import Decimal from 'decimal.js'

export interface CreateTaxInput {
  name: string
  code: string
  rate: number
  taxType?: 'percentage' | 'fixed'
  salesAccountId?: string | null
  purchaseAccountId?: string | null
  isDefault?: boolean
  isActive?: boolean
}

export interface UpdateTaxInput {
  name?: string
  rate?: number
  taxType?: 'percentage' | 'fixed'
  salesAccountId?: string | null
  purchaseAccountId?: string | null
  isDefault?: boolean
  isActive?: boolean
}

export class TaxService {
  /**
   * Get all taxes for a business.
   */
  static async getTaxes(businessId: string, includeInactive = false) {
    return prisma.tax.findMany({
      where: {
        businessId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        salesAccount: { select: { id: true, code: true, name: true } },
        purchaseAccount: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })
  }

  /**
   * Get a single tax by ID.
   */
  static async getTaxById(businessId: string, taxId: string) {
    return prisma.tax.findFirst({
      where: { id: taxId, businessId },
      include: {
        salesAccount: { select: { id: true, code: true, name: true } },
        purchaseAccount: { select: { id: true, code: true, name: true } },
      },
    })
  }

  /**
   * Get the default tax for a business.
   */
  static async getDefaultTax(businessId: string) {
    return prisma.tax.findFirst({
      where: { businessId, isDefault: true, isActive: true },
      include: {
        salesAccount: { select: { id: true, code: true, name: true } },
        purchaseAccount: { select: { id: true, code: true, name: true } },
      },
    })
  }

  /**
   * Create a new tax configuration.
   */
  static async createTax(businessId: string, data: CreateTaxInput, userId?: string) {
    // Validate account mapping belongs to business
    if (data.salesAccountId) {
      const salesAcc = await prisma.chartOfAccount.findFirst({
        where: { id: data.salesAccountId, businessId, isActive: true },
      })
      if (!salesAcc) {
        throw new Error(`Sales account ${data.salesAccountId} not found in business ${businessId}`)
      }
    }

    if (data.purchaseAccountId) {
      const purchAcc = await prisma.chartOfAccount.findFirst({
        where: { id: data.purchaseAccountId, businessId, isActive: true },
      })
      if (!purchAcc) {
        throw new Error(`Purchase account ${data.purchaseAccountId} not found in business ${businessId}`)
      }
    }

    // Check code uniqueness within business
    const existing = await prisma.tax.findUnique({
      where: { businessId_code: { businessId, code: data.code.toUpperCase() } },
    })
    if (existing) {
      throw new Error(`Tax with code '${data.code}' already exists for this business`)
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.tax.updateMany({
        where: { businessId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const created = await prisma.tax.create({
      data: {
        businessId,
        name: data.name,
        code: data.code.toUpperCase(),
        rate: new Decimal(data.rate),
        taxType: (data.taxType as TaxType) || 'percentage',
        salesAccountId: data.salesAccountId || null,
        purchaseAccountId: data.purchaseAccountId || null,
        isDefault: data.isDefault ?? false,
        isActive: data.isActive ?? true,
      },
    })

    // Write audit record
    try {
      await prisma.auditLog.create({
        data: {
          businessId,
          userId: userId || null,
          action: 'create',
          module: 'tax_configuration',
          recordId: created.id,
          recordType: 'Tax',
          newValues: created,
          changedFields: Object.keys(data),
        },
      })
    } catch {
      // Non-blocking
    }

    return created
  }

  /**
   * Update an existing tax configuration.
   */
  static async updateTax(businessId: string, taxId: string, data: UpdateTaxInput, userId?: string) {
    const existing = await prisma.tax.findFirst({
      where: { id: taxId, businessId },
    })
    if (!existing) throw new Error(`Tax ${taxId} not found in business ${businessId}`)

    // Validate accounts
    if (data.salesAccountId) {
      const salesAcc = await prisma.chartOfAccount.findFirst({
        where: { id: data.salesAccountId, businessId, isActive: true },
      })
      if (!salesAcc) {
        throw new Error(`Sales account ${data.salesAccountId} not found in business ${businessId}`)
      }
    }

    if (data.purchaseAccountId) {
      const purchAcc = await prisma.chartOfAccount.findFirst({
        where: { id: data.purchaseAccountId, businessId, isActive: true },
      })
      if (!purchAcc) {
        throw new Error(`Purchase account ${data.purchaseAccountId} not found in business ${businessId}`)
      }
    }

    if (data.isDefault) {
      await prisma.tax.updateMany({
        where: { businessId, isDefault: true, id: { not: taxId } },
        data: { isDefault: false },
      })
    }

    const updated = await prisma.tax.update({
      where: { id: taxId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.rate !== undefined ? { rate: new Decimal(data.rate) } : {}),
        ...(data.taxType !== undefined ? { taxType: data.taxType as TaxType } : {}),
        ...(data.salesAccountId !== undefined ? { salesAccountId: data.salesAccountId } : {}),
        ...(data.purchaseAccountId !== undefined ? { purchaseAccountId: data.purchaseAccountId } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    })

    try {
      await prisma.auditLog.create({
        data: {
          businessId,
          userId: userId || null,
          action: 'update',
          module: 'tax_configuration',
          recordId: taxId,
          recordType: 'Tax',
          oldValues: existing,
          newValues: updated,
          changedFields: Object.keys(data),
        },
      })
    } catch {
      // Non-blocking
    }

    return updated
  }
}
