'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import {
  OpeningInventoryService,
  ParsedOpeningStockRow,
  OpeningStockValidationSummary,
  OpeningStockImportOptions,
} from '@/lib/services/opening-inventory-service'
import { prisma } from '@/lib/db/prisma'

export async function validateOpeningInventoryExcelAction(
  businessId: string,
  fileBase64: string
): Promise<{ success: boolean; data?: OpeningStockValidationSummary; error?: string }> {
  try {
    await requireBusinessAccess(businessId, 'inventory', 'read')

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { defaultCurrency: true },
    })

    const buffer = Buffer.from(fileBase64, 'base64')
    const summary = await OpeningInventoryService.parseAndValidateExcel(
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
      error: error.message || 'فشل في تحليل ملف بضاعة أول المدة والتحقق من صحته.',
    }
  }
}

export async function importOpeningInventoryAction(
  businessId: string,
  rows: ParsedOpeningStockRow[],
  options: OpeningStockImportOptions
): Promise<{
  success: boolean
  result?: {
    importedCount: number
    totalQuantity: number
    totalValuation: number
    journalEntryId?: string | null
    journalEntryNumber?: string | null
  }
  error?: string
}> {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'inventory', 'write')

    if (!rows || rows.length === 0) {
      return {
        success: false,
        error: 'لا توجد بيانات أصناف صالحة للاستيراد.',
      }
    }

    const result = await OpeningInventoryService.importOpeningInventory(
      businessId,
      userId,
      rows,
      options
    )

    try {
      revalidatePath(`/b/${businessId}/inventory`)
      revalidatePath(`/b/${businessId}/inventory/adjustment`)
      revalidatePath(`/b/${businessId}/accounting`)
      revalidatePath(`/b/${businessId}/accounting/journal-entries`)
      revalidatePath(`/b/${businessId}/accounting/trial-balance`)
      revalidatePath(`/b/${businessId}/reports`)
    } catch {}

    return {
      success: true,
      result,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'حدث خطأ أثناء استيراد بضاعة أول المدة وتوليد القيد الافتتاحي.',
    }
  }
}
