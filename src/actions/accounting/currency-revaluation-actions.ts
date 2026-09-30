'use server'

import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { CurrencyRevaluationService } from '@/lib/services/currency-revaluation-service'
import { revalidatePath } from 'next/cache'

export async function getRevaluationPreviewAction(
  businessId: string,
  asOfDateStr?: string,
  rates?: Record<string, number>
) {
  try {
    await requireBusinessAccess(businessId)
    const asOfDate = asOfDateStr ? new Date(asOfDateStr) : new Date()
    const preview = await CurrencyRevaluationService.getRevaluationPreview(businessId, asOfDate, rates)
    return { success: true, preview }
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل في استعراض فروق تقييم العملات' }
  }
}

export async function executeRevaluationAction(
  businessId: string,
  payload: {
    asOfDateStr: string
    rates: Record<string, number>
    description?: string
    autoReverse?: boolean
    reversalDateStr?: string
  }
) {
  try {
    const { userId } = await requireBusinessAccess(businessId)
    const asOfDate = new Date(payload.asOfDateStr)
    const reversalDate = payload.reversalDateStr ? new Date(payload.reversalDateStr) : undefined

    const result = await CurrencyRevaluationService.executeRevaluation(
      businessId,
      {
        asOfDate,
        rates: payload.rates,
        description: payload.description,
        autoReverse: payload.autoReverse,
        reversalDate,
      },
      userId
    )

    revalidatePath(`/b/${businessId}/reports/balance-sheet`)
    revalidatePath(`/b/${businessId}/reports/pl`)
    revalidatePath(`/b/${businessId}/accounting/trial-balance`)
    revalidatePath(`/b/${businessId}/accounting/general-ledger`)
    revalidatePath(`/b/${businessId}/accounting/journal-entries`)
    revalidatePath(`/b/${businessId}/settings/currencies`)

    return { success: true, result }
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل في ترحيل قيد إعادة تقييم العملات' }
  }
}
