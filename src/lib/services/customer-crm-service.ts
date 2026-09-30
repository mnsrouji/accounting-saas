// =============================================================
// Customer & Supplier CRM Service — Master Data & Contacts Engine
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================

import { prisma } from '@/lib/db/prisma'
import {
  createCustomerGroupSchema,
  updateCustomerGroupSchema,
  createCustomerContactSchema,
  updateCustomerContactSchema,
  createSupplierContactSchema,
  updateSupplierContactSchema,
  CreateCustomerGroupInput,
  UpdateCustomerGroupInput,
  CreateCustomerContactInput,
  UpdateCustomerContactInput,
  CreateSupplierContactInput,
  UpdateSupplierContactInput,
} from '@/lib/validations/crm-schemas'
import { TenantAccessDeniedError, ValidationError } from '@/lib/errors/accounting-error'
import { AuditService } from './audit-service'
import Decimal from 'decimal.js'

export class CustomerCrmService {
  // -------------------------------------------------------------
  // 1. Customer Groups & Segmentation
  // -------------------------------------------------------------
  static async createCustomerGroup(input: CreateCustomerGroupInput, userId?: string) {
    const validated = createCustomerGroupSchema.parse(input)

    const group = await prisma.customerGroup.create({
      data: {
        businessId: validated.businessId,
        name: validated.name,
        code: validated.code || null,
        description: validated.description || null,
        discountPercent: new Decimal(validated.discountPercent || 0),
        priceTier: validated.priceTier || null,
        creditLimit: validated.creditLimit ? new Decimal(validated.creditLimit) : null,
        paymentTerms: validated.paymentTerms || null,
        isActive: validated.isActive,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId,
      entityType: 'customer_group',
      entityId: group.id,
      action: 'create',
      newData: group,
    })

    return group
  }

  static async updateCustomerGroup(input: UpdateCustomerGroupInput, userId?: string) {
    const validated = updateCustomerGroupSchema.parse(input)

    const existing = await prisma.customerGroup.findFirst({
      where: { id: validated.id, businessId: validated.businessId },
    })
    if (!existing) throw new TenantAccessDeniedError('CustomerGroup')

    const updated = await prisma.customerGroup.update({
      where: { id: validated.id },
      data: {
        name: validated.name !== undefined ? validated.name : undefined,
        code: validated.code !== undefined ? validated.code : undefined,
        description: validated.description !== undefined ? validated.description : undefined,
        discountPercent: validated.discountPercent !== undefined ? new Decimal(validated.discountPercent) : undefined,
        priceTier: validated.priceTier !== undefined ? validated.priceTier : undefined,
        creditLimit: validated.creditLimit !== undefined ? (validated.creditLimit ? new Decimal(validated.creditLimit) : null) : undefined,
        paymentTerms: validated.paymentTerms !== undefined ? validated.paymentTerms : undefined,
        isActive: validated.isActive !== undefined ? validated.isActive : undefined,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId,
      entityType: 'customer_group',
      entityId: updated.id,
      action: 'update',
      oldData: existing,
      newData: updated,
    })

    return updated
  }

  static async getCustomerGroups(businessId: string) {
    return prisma.customerGroup.findMany({
      where: { businessId },
      include: {
        _count: {
          select: { customers: true },
        },
      },
      orderBy: { name: 'asc' },
    })
  }

  // -------------------------------------------------------------
  // 2. Customer Contacts
  // -------------------------------------------------------------
  static async createCustomerContact(input: CreateCustomerContactInput, userId?: string) {
    const validated = createCustomerContactSchema.parse(input)

    const customer = await prisma.customer.findFirst({
      where: { id: validated.customerId, businessId: validated.businessId, deletedAt: null },
    })
    if (!customer) throw new TenantAccessDeniedError('Customer')

    // If marked as primary, demote other contacts for this customer
    if (validated.isPrimary) {
      await prisma.customerContact.updateMany({
        where: { customerId: validated.customerId, businessId: validated.businessId },
        data: { isPrimary: false },
      })
    }

    const contact = await prisma.customerContact.create({
      data: {
        businessId: validated.businessId,
        customerId: validated.customerId,
        name: validated.name,
        title: validated.title || null,
        department: validated.department || null,
        email: validated.email || null,
        phone: validated.phone || null,
        mobile: validated.mobile || null,
        whatsapp: validated.whatsapp || null,
        isPrimary: validated.isPrimary || false,
        notes: validated.notes || null,
        isActive: validated.isActive,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId,
      entityType: 'customer_contact',
      entityId: contact.id,
      action: 'create',
      newData: contact,
    })

    return contact
  }

  static async updateCustomerContact(input: UpdateCustomerContactInput, userId?: string) {
    const validated = updateCustomerContactSchema.parse(input)

    const existing = await prisma.customerContact.findFirst({
      where: { id: validated.id, businessId: validated.businessId },
    })
    if (!existing) throw new TenantAccessDeniedError('CustomerContact')

    if (validated.isPrimary && existing.customerId) {
      await prisma.customerContact.updateMany({
        where: { customerId: existing.customerId, businessId: validated.businessId, id: { not: validated.id } },
        data: { isPrimary: false },
      })
    }

    const updated = await prisma.customerContact.update({
      where: { id: validated.id },
      data: {
        name: validated.name !== undefined ? validated.name : undefined,
        title: validated.title !== undefined ? validated.title : undefined,
        department: validated.department !== undefined ? validated.department : undefined,
        email: validated.email !== undefined ? validated.email : undefined,
        phone: validated.phone !== undefined ? validated.phone : undefined,
        mobile: validated.mobile !== undefined ? validated.mobile : undefined,
        whatsapp: validated.whatsapp !== undefined ? validated.whatsapp : undefined,
        isPrimary: validated.isPrimary !== undefined ? validated.isPrimary : undefined,
        notes: validated.notes !== undefined ? validated.notes : undefined,
        isActive: validated.isActive !== undefined ? validated.isActive : undefined,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId,
      entityType: 'customer_contact',
      entityId: updated.id,
      action: 'update',
      oldData: existing,
      newData: updated,
    })

    return updated
  }

  static async deleteCustomerContact(businessId: string, contactId: string, userId?: string) {
    const existing = await prisma.customerContact.findFirst({
      where: { id: contactId, businessId },
    })
    if (!existing) throw new TenantAccessDeniedError('CustomerContact')

    await prisma.customerContact.delete({
      where: { id: contactId },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'customer_contact',
      entityId: contactId,
      action: 'delete',
      oldData: existing,
    })

    return { success: true }
  }

  static async getCustomerContacts(businessId: string, customerId: string) {
    return prisma.customerContact.findMany({
      where: { businessId, customerId },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    })
  }

  // -------------------------------------------------------------
  // 3. Supplier Contacts
  // -------------------------------------------------------------
  static async createSupplierContact(input: CreateSupplierContactInput, userId?: string) {
    const validated = createSupplierContactSchema.parse(input)

    const supplier = await prisma.supplier.findFirst({
      where: { id: validated.supplierId, businessId: validated.businessId, deletedAt: null },
    })
    if (!supplier) throw new TenantAccessDeniedError('Supplier')

    if (validated.isPrimary) {
      await prisma.supplierContact.updateMany({
        where: { supplierId: validated.supplierId, businessId: validated.businessId },
        data: { isPrimary: false },
      })
    }

    const contact = await prisma.supplierContact.create({
      data: {
        businessId: validated.businessId,
        supplierId: validated.supplierId,
        name: validated.name,
        title: validated.title || null,
        department: validated.department || null,
        email: validated.email || null,
        phone: validated.phone || null,
        mobile: validated.mobile || null,
        whatsapp: validated.whatsapp || null,
        isPrimary: validated.isPrimary || false,
        notes: validated.notes || null,
        isActive: validated.isActive,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId,
      entityType: 'supplier_contact',
      entityId: contact.id,
      action: 'create',
      newData: contact,
    })

    return contact
  }

  static async updateSupplierContact(input: UpdateSupplierContactInput, userId?: string) {
    const validated = updateSupplierContactSchema.parse(input)

    const existing = await prisma.supplierContact.findFirst({
      where: { id: validated.id, businessId: validated.businessId },
    })
    if (!existing) throw new TenantAccessDeniedError('SupplierContact')

    if (validated.isPrimary && existing.supplierId) {
      await prisma.supplierContact.updateMany({
        where: { supplierId: existing.supplierId, businessId: validated.businessId, id: { not: validated.id } },
        data: { isPrimary: false },
      })
    }

    const updated = await prisma.supplierContact.update({
      where: { id: validated.id },
      data: {
        name: validated.name !== undefined ? validated.name : undefined,
        title: validated.title !== undefined ? validated.title : undefined,
        department: validated.department !== undefined ? validated.department : undefined,
        email: validated.email !== undefined ? validated.email : undefined,
        phone: validated.phone !== undefined ? validated.phone : undefined,
        mobile: validated.mobile !== undefined ? validated.mobile : undefined,
        whatsapp: validated.whatsapp !== undefined ? validated.whatsapp : undefined,
        isPrimary: validated.isPrimary !== undefined ? validated.isPrimary : undefined,
        notes: validated.notes !== undefined ? validated.notes : undefined,
        isActive: validated.isActive !== undefined ? validated.isActive : undefined,
      },
    })

    await AuditService.log({
      businessId: validated.businessId,
      userId,
      entityType: 'supplier_contact',
      entityId: updated.id,
      action: 'update',
      oldData: existing,
      newData: updated,
    })

    return updated
  }

  static async deleteSupplierContact(businessId: string, contactId: string, userId?: string) {
    const existing = await prisma.supplierContact.findFirst({
      where: { id: contactId, businessId },
    })
    if (!existing) throw new TenantAccessDeniedError('SupplierContact')

    await prisma.supplierContact.delete({
      where: { id: contactId },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'supplier_contact',
      entityId: contactId,
      action: 'delete',
      oldData: existing,
    })

    return { success: true }
  }

  static async getSupplierContacts(businessId: string, supplierId: string) {
    return prisma.supplierContact.findMany({
      where: { businessId, supplierId },
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    })
  }

  // -------------------------------------------------------------
  // 4. Customer Master Data Extensions
  // -------------------------------------------------------------
  static async updateCustomerMasterData(
    businessId: string,
    customerId: string,
    data: {
      name?: string
      companyName?: string
      email?: string
      phone?: string
      mobile?: string
      whatsapp?: string
      website?: string
      address?: string
      billingAddress?: string
      shippingAddress?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
      taxNumber?: string
      taxRegistrationNumber?: string
      taxExemptionNumber?: string
      creditLimit?: number | string | Decimal
      paymentTerms?: number
      category?: string
      industry?: string
      region?: string
      tags?: string[]
      assignedUserId?: string
      customerGroupId?: string
      creditCategory?: string
      notes?: string
      isActive?: boolean
    },
    userId?: string
  ) {
    const existing = await prisma.customer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
    })
    if (!existing) throw new TenantAccessDeniedError('Customer')

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...data,
        creditLimit: data.creditLimit !== undefined ? new Decimal(data.creditLimit) : undefined,
        updatedBy: userId,
      },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'customer',
      entityId: customerId,
      action: 'update',
      oldData: existing,
      newData: updated,
    })

    return updated
  }

  // -------------------------------------------------------------
  // 5. Supplier Master Data Extensions
  // -------------------------------------------------------------
  static async updateSupplierMasterData(
    businessId: string,
    supplierId: string,
    data: {
      name?: string
      companyName?: string
      email?: string
      phone?: string
      mobile?: string
      whatsapp?: string
      website?: string
      address?: string
      billingAddress?: string
      shippingAddress?: string
      city?: string
      state?: string
      postalCode?: string
      country?: string
      taxNumber?: string
      taxRegistrationNumber?: string
      paymentTerms?: number
      category?: string
      industry?: string
      region?: string
      tags?: string[]
      assignedUserId?: string
      rating?: number | Decimal
      notes?: string
      isActive?: boolean
    },
    userId?: string
  ) {
    const existing = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId, deletedAt: null },
    })
    if (!existing) throw new TenantAccessDeniedError('Supplier')

    const updated = await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        ...data,
        rating: data.rating !== undefined ? new Decimal(data.rating) : undefined,
        updatedBy: userId,
      },
    })

    await AuditService.log({
      businessId,
      userId,
      entityType: 'supplier',
      entityId: supplierId,
      action: 'update',
      oldData: existing,
      newData: updated,
    })

    return updated
  }
}
