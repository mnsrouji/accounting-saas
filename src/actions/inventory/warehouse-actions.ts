'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'
import { serializeJson } from '@/utils'

export interface CreateWarehouseInput {
  name: string
  code?: string
  location?: string
  address?: string
  isDefault?: boolean
}

export interface UpdateWarehouseInput {
  name?: string
  code?: string
  location?: string
  address?: string
  isDefault?: boolean
  isActive?: boolean
}

import { UsageService } from '@/lib/services/usage-service'

export async function createWarehouseAction(businessId: string, input: CreateWarehouseInput) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'inventory', 'write')

    // Check SaaS plan warehouse quota limit
    await UsageService.assertQuota(businessId, 'warehouses')

    if (!input.name || !input.name.trim()) {
      return { success: false as const, error: 'اسم المستودع مطلوب' }
    }

    const trimmedName = input.name.trim()
    const trimmedCode = input.code?.trim() || `WH-${Date.now().toString().slice(-4)}`

    // Check unique code within business
    const existingCode = await prisma.warehouse.findFirst({
      where: {
        businessId,
        code: { equals: trimmedCode, mode: 'insensitive' },
      },
    })

    if (existingCode) {
      return { success: false as const, error: `كود المستودع "${trimmedCode}" مستخدم بالفعل، يرجى اختيار كود آخر` }
    }

    // If marked as default, unset other defaults
    if (input.isDefault) {
      await prisma.warehouse.updateMany({
        where: { businessId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const warehouse = await prisma.warehouse.create({
      data: {
        businessId,
        name: trimmedName,
        code: trimmedCode,
        location: input.location?.trim() || null,
        address: input.address?.trim() || null,
        isDefault: !!input.isDefault,
        isActive: true,
      },
    })

    safeRevalidate(businessId)
    return serializeJson({ success: true as const, warehouse, error: undefined })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'فشل في إنشاء المستودع' }
  }
}

export async function updateWarehouseAction(
  businessId: string,
  warehouseId: string,
  input: UpdateWarehouseInput
) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'inventory', 'write')

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, businessId },
    })

    if (!warehouse) {
      return { success: false as const, error: 'المستودع غير موجود' }
    }

    const trimmedName = input.name !== undefined ? input.name.trim() : undefined
    const trimmedCode = input.code !== undefined ? input.code.trim() : undefined

    if (trimmedName !== undefined && !trimmedName) {
      return { success: false as const, error: 'اسم المستودع لا يمكن أن يكون فارغاً' }
    }

    if (trimmedCode) {
      const existingCode = await prisma.warehouse.findFirst({
        where: {
          businessId,
          code: { equals: trimmedCode, mode: 'insensitive' },
          id: { not: warehouseId },
        },
      })
      if (existingCode) {
        return { success: false as const, error: `كود المستودع "${trimmedCode}" مستخدم بالفعل لمستودع آخر` }
      }
    }

    // If setting as default, unset others
    if (input.isDefault) {
      await prisma.warehouse.updateMany({
        where: { businessId, id: { not: warehouseId }, isDefault: true },
        data: { isDefault: false },
      })
    }

    const updated = await prisma.warehouse.update({
      where: { id: warehouseId },
      data: {
        ...(trimmedName !== undefined ? { name: trimmedName } : {}),
        ...(trimmedCode !== undefined ? { code: trimmedCode } : {}),
        ...(input.location !== undefined ? { location: input.location?.trim() || null } : {}),
        ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    })

    safeRevalidate(businessId)
    return serializeJson({ success: true as const, warehouse: updated, error: undefined })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'فشل في تحديث بيانات المستودع' }
  }
}

export async function deleteWarehouseAction(businessId: string, warehouseId: string) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'inventory', 'delete')

    const warehouse = await prisma.warehouse.findFirst({
      where: { id: warehouseId, businessId },
      include: {
        _count: {
          select: {
            inventoryMovements: true,
            inventoryBalances: true,
            stockTransfersFrom: true,
            stockTransfersTo: true,
            stockAdjustments: true,
            saleItems: true,
            purchaseItems: true,
          },
        },
      },
    })

    if (!warehouse) {
      return { success: false as const, error: 'المستودع غير موجود' }
    }

    const totalActivity =
      warehouse._count.inventoryMovements +
      warehouse._count.stockTransfersFrom +
      warehouse._count.stockTransfersTo +
      warehouse._count.stockAdjustments +
      warehouse._count.saleItems +
      warehouse._count.purchaseItems

    // Check balances with non-zero stock
    const activeBalances = await prisma.inventoryBalance.count({
      where: {
        warehouseId,
        quantity: { not: 0 },
      },
    })

    if (totalActivity > 0 || activeBalances > 0) {
      return {
        success: false as const,
        error: `لا يمكن حذف المستودع "${warehouse.name}" لوجود (${totalActivity}) حركة مخزنية مرتبطة به ورصيد نشط. يمكنك تعطيل حالة المستودع (إلغاء التفعيل) بدلاً من حذفه للحفاظ على سلامة القيود والتقارير المالية.`,
      }
    }

    // Clean up empty balances if any with 0 quantity
    await prisma.inventoryBalance.deleteMany({
      where: { warehouseId },
    })

    await prisma.warehouse.delete({
      where: { id: warehouseId },
    })

    safeRevalidate(businessId)
    return serializeJson({ success: true as const, error: undefined })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'فشل في حذف المستودع' }
  }
}

export async function toggleWarehouseStatusAction(
  businessId: string,
  warehouseId: string,
  isActive: boolean
) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'inventory', 'write')

    const updated = await prisma.warehouse.update({
      where: { id: warehouseId, businessId },
      data: { isActive },
    })

    safeRevalidate(businessId)
    return serializeJson({ success: true as const, warehouse: updated, error: undefined })
  } catch (err: any) {
    return { success: false as const, error: err.message || 'فشل في تغيير حالة المستودع' }
  }
}

function safeRevalidate(businessId: string) {
  try {
    revalidatePath(`/b/${businessId}/inventory`)
    revalidatePath(`/b/${businessId}/inventory/warehouses`)
    revalidatePath(`/b/${businessId}/inventory/transfer`)
    revalidatePath(`/b/${businessId}/inventory/adjustment`)
  } catch {}
}
