'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { InventoryService } from '@/lib/services/inventory-service'
import { InventoryAdjustmentInput, WarehouseTransferInput } from '@/lib/validations/accounting-schemas'
import { prisma } from '@/lib/db/prisma'

import { serializeJson } from '@/utils'

export async function adjustStockAction(businessId: string, input: Omit<InventoryAdjustmentInput, 'businessId' | 'userId'>) {
  try {
    const { userId } = await requireBusinessAccess(businessId)

    const movement = await InventoryService.adjustStock({
      ...input,
      businessId,
      userId,
    })

    safeRevalidatePath(`/b/${businessId}/inventory`)
    safeRevalidatePath(`/b/${businessId}/dashboard`)

    return serializeJson({ success: true as const, movement, error: undefined })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Failed to adjust inventory' }
  }
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path)
  } catch {}
}

export async function transferStockAction(businessId: string, input: Omit<WarehouseTransferInput, 'businessId' | 'userId'>) {
  try {
    const { userId } = await requireBusinessAccess(businessId)

    const result = await InventoryService.executeTransfer({
      ...input,
      businessId,
      userId,
    })

    safeRevalidatePath(`/b/${businessId}/inventory`)
    return serializeJson({ success: true as const, result, error: undefined })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Failed to transfer inventory' }
  }
}

import { UsageService } from '@/lib/services/usage-service'

export async function createProductAction(businessId: string, data: { name: string; sku: string; type: string; price: number; cost: number; trackInventory?: boolean }) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'inventory', 'write')

    // Check SaaS plan product quota limit
    await UsageService.assertQuota(businessId, 'products')

    const product = await prisma.product.create({
      data: {
        businessId,
        name: data.name,
        code: data.sku,
        productType: data.type as any,
        salePrice: data.price,
        costPrice: data.cost,
        trackInventory: data.trackInventory ?? true,
      },
    })

    safeRevalidatePath(`/b/${businessId}/inventory`)
    return serializeJson({ success: true as const, product, error: undefined })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Failed to create product' }
  }
}
