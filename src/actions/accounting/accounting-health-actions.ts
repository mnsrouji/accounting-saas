'use server'

import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { AccountingHealthService } from '@/lib/services/accounting-health-service'
import { revalidatePath } from 'next/cache'

export async function runAccountingDiagnosticAction(businessId: string) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'accounting', 'read')
    const report = await AccountingHealthService.runComprehensiveDiagnostic(businessId)
    return { success: true, report }
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل في تشخيص القيود المحاسبية' }
  }
}

export async function healAndRepostLedgerAction(businessId: string) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'accounting', 'write')
    const result = await AccountingHealthService.repostAndHealLedgers(businessId, userId)

    revalidatePath(`/b/${businessId}/reports/balance-sheet`)
    revalidatePath(`/b/${businessId}/reports/pl`)
    revalidatePath(`/b/${businessId}/accounting/trial-balance`)
    revalidatePath(`/b/${businessId}/accounting/general-ledger`)
    revalidatePath(`/b/${businessId}/accounting/journal-entries`)

    return {
      success: true,
      healed: result.healed,
      report: result.report,
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'فشل في إعادة ترحيل القيود وتصحيح الحسابات' }
  }
}
