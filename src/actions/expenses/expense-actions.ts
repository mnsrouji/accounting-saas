'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { ExpenseService } from '@/lib/services/expense-service'
import { PostExpenseInput } from '@/lib/validations/accounting-schemas'

import { serializeJson } from '@/utils'

export async function postExpenseAction(businessId: string, input: Omit<PostExpenseInput, 'businessId' | 'userId'>) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'expenses', 'write')

    const result = await ExpenseService.postExpense({
      ...input,
      businessId,
      userId,
    })

    safeRevalidatePath(`/b/${businessId}/expenses`)
    safeRevalidatePath(`/b/${businessId}/dashboard`)
    safeRevalidatePath(`/b/${businessId}/reports`)

    return serializeJson({ success: true as const, expense: result.expense, journalEntry: result.journalEntry, error: undefined })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Failed to post expense' }
  }
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path)
  } catch {}
}
