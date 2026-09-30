'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { PaymentService } from '@/lib/services/payment-service'
import { ProcessPaymentInput } from '@/lib/validations/accounting-schemas'

import { serializeJson } from '@/utils'

export async function processPaymentAction(businessId: string, input: Omit<ProcessPaymentInput, 'businessId' | 'userId'>) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'accounting', 'write')

    const result = await PaymentService.processPayment({
      ...input,
      businessId,
      userId,
    })

    safeRevalidatePath(`/b/${businessId}/payments`)
    safeRevalidatePath(`/b/${businessId}/sales`)
    safeRevalidatePath(`/b/${businessId}/purchases`)
    safeRevalidatePath(`/b/${businessId}/customers`)
    safeRevalidatePath(`/b/${businessId}/suppliers`)
    safeRevalidatePath(`/b/${businessId}/dashboard`)
    safeRevalidatePath(`/b/${businessId}/reports`)

    return serializeJson({ success: true as const, payment: result.payment, journalEntry: result.journalEntry, error: undefined })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Failed to process payment' }
  }
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path)
  } catch {}
}
