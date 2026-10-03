'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { ChartOfAccountExcelService, ParsedAccountRow, ValidationSummary } from '@/lib/services/coa-excel-service'
import { prisma } from '@/lib/db/prisma'

export async function validateChartOfAccountsExcelAction(
  businessId: string,
  fileBase64: string
): Promise<{ success: boolean; data?: ValidationSummary; error?: string }> {
  try {
    await requireBusinessAccess(businessId, 'accounting', 'read')

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { defaultCurrency: true },
    })

    const buffer = Buffer.from(fileBase64, 'base64')
    const summary = await ChartOfAccountExcelService.parseAndValidateExcel(
      buffer,
      businessId,
      business?.defaultCurrency || 'SAR'
    )

    return {
      success: true,
      data: summary,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'فشل في تحليل ملف الإكسل والتحقق من صحته.',
    }
  }
}

export async function importChartOfAccountsExcelAction(
  businessId: string,
  accountsData: ParsedAccountRow[],
  mode: 'merge' | 'insert_only'
): Promise<{ success: boolean; result?: { created: number; updated: number; skipped: number }; error?: string }> {
  try {
    await requireBusinessAccess(businessId, 'accounting', 'write')

    if (!accountsData || accountsData.length === 0) {
      return {
        success: false,
        error: 'لا توجد بيانات حسابات صالحة للاستيراد.',
      }
    }

    const result = await ChartOfAccountExcelService.importAccounts(businessId, accountsData, mode)

    try {
      revalidatePath(`/b/${businessId}/accounting`)
      revalidatePath(`/b/${businessId}/accounting/chart-of-accounts`)
      revalidatePath(`/b/${businessId}/reports`)
    } catch {}

    return {
      success: true,
      result,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'حدث خطأ أثناء استيراد شجرة الحسابات.',
    }
  }
}
