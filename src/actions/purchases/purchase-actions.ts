'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { PurchaseService } from '@/lib/services/purchase-service'
import { PostPurchaseInvoiceInput } from '@/lib/validations/accounting-schemas'
import { prisma } from '@/lib/db/prisma'

import { serializeJson } from '@/utils'

export async function postPurchaseInvoiceAction(businessId: string, input: Omit<PostPurchaseInvoiceInput, 'businessId' | 'userId'>) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'purchases', 'write')

    const result = await PurchaseService.postPurchaseInvoice({
      ...input,
      businessId,
      userId,
    })

    safeRevalidatePath(`/b/${businessId}/purchases`)
    safeRevalidatePath(`/b/${businessId}/dashboard`)
    safeRevalidatePath(`/b/${businessId}/inventory`)
    safeRevalidatePath(`/b/${businessId}/reports`)

    return serializeJson({ success: true as const, purchase: result.purchase, error: undefined })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Failed to post purchase invoice' }
  }
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path)
  } catch {}
}

export async function createSupplierAction(businessId: string, data: { name: string; email?: string; phone?: string; companyName?: string; currency?: string }) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'suppliers', 'write')

    const supplier = await prisma.supplier.create({
      data: {
        businessId,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        companyName: data.companyName || null,
        currency: data.currency || 'USD',
        createdBy: userId,
      },
    })

    safeRevalidatePath(`/b/${businessId}/suppliers`)
    return serializeJson({ success: true as const, supplier, error: undefined })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Failed to create supplier' }
  }
}
