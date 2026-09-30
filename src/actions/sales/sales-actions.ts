'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { SalesService } from '@/lib/services/sales-service'
import { PostSalesInvoiceInput } from '@/lib/validations/accounting-schemas'
import { prisma } from '@/lib/db/prisma'

import { serializeJson } from '@/utils'

export async function postSalesInvoiceAction(businessId: string, input: Omit<PostSalesInvoiceInput, 'businessId' | 'userId'>) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'sales', 'write')

    const result = await SalesService.postSalesInvoice({
      ...input,
      businessId,
      userId,
    })

    safeRevalidatePath(`/b/${businessId}/sales`)
    safeRevalidatePath(`/b/${businessId}/dashboard`)
    safeRevalidatePath(`/b/${businessId}/reports`)

    return serializeJson({ success: true as const, sale: result.sale, error: undefined })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Failed to post sales invoice' }
  }
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path)
  } catch {}
}

export async function createCustomerAction(businessId: string, data: { name: string; email?: string; phone?: string; companyName?: string; currency?: string }) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'customers', 'write')

    const customer = await prisma.customer.create({
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

    safeRevalidatePath(`/b/${businessId}/customers`)
    return serializeJson({ success: true as const, customer, error: undefined })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Failed to create customer' }
  }
}
