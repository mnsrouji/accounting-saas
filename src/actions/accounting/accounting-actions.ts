'use server'

import { revalidatePath } from 'next/cache'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { AccountingService } from '@/lib/services/accounting-service'
import {
  PostJournalEntryInput,
  ReverseJournalEntryInput,
  UpdateJournalEntryInput,
  createChartOfAccountSchema,
  updateChartOfAccountSchema,
  CreateChartOfAccountInput,
  UpdateChartOfAccountInput,
} from '@/lib/validations/accounting-schemas'
import { prisma } from '@/lib/db/prisma'
import { serializeJson } from '@/utils'

export async function postJournalEntryAction(businessId: string, input: Omit<PostJournalEntryInput, 'businessId' | 'userId'>) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'accounting', 'write')

    const journalEntry = await AccountingService.postJournalEntry({
      ...input,
      businessId,
      userId,
    })

    safeRevalidatePath(`/b/${businessId}/accounting`)
    safeRevalidatePath(`/b/${businessId}/reports`)

    return serializeJson({ success: true as const, journalEntry })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Failed to post journal entry' }
  }
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path)
  } catch {}
}

export async function reverseJournalEntryAction(businessId: string, input: Omit<ReverseJournalEntryInput, 'businessId' | 'userId'>) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'accounting', 'write')

    const reversalEntry = await AccountingService.reverseJournalEntry({
      ...input,
      businessId,
      userId,
    })

    safeRevalidatePath(`/b/${businessId}/accounting`)
    safeRevalidatePath(`/b/${businessId}/accounting/journal-entries`)
    safeRevalidatePath(`/b/${businessId}/reports`)

    return serializeJson({ success: true as const, reversalEntry })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Failed to reverse journal entry' }
  }
}

export async function updateJournalEntryAction(
  businessId: string,
  input: Omit<UpdateJournalEntryInput, 'businessId' | 'userId'>
) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'accounting', 'write')

    const updated = await AccountingService.updateJournalEntry({
      ...input,
      businessId,
      userId,
    })

    safeRevalidatePath(`/b/${businessId}/accounting`)
    safeRevalidatePath(`/b/${businessId}/accounting/journal-entries`)
    safeRevalidatePath(`/b/${businessId}/reports`)

    return serializeJson({ success: true as const, journalEntry: updated })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'فشل في تعديل القيد المحاسبي' }
  }
}

export async function deleteJournalEntryAction(businessId: string, journalEntryId: string) {
  try {
    const { userId } = await requireBusinessAccess(businessId, 'accounting', 'delete')

    const result = await AccountingService.deleteJournalEntry(businessId, journalEntryId, userId)

    safeRevalidatePath(`/b/${businessId}/accounting`)
    safeRevalidatePath(`/b/${businessId}/accounting/journal-entries`)
    safeRevalidatePath(`/b/${businessId}/reports`)

    return serializeJson({ success: true as const, result })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'فشل في حذف القيد المحاسبي' }
  }
}

export async function createChartOfAccountAction(
  businessId: string,
  input: Omit<CreateChartOfAccountInput, 'businessId'>
) {
  try {
    await requireBusinessAccess(businessId, 'accounting', 'write')

    const validated = createChartOfAccountSchema.parse({
      ...input,
      businessId,
    })

    // Check if code is already used
    const existing = await prisma.chartOfAccount.findUnique({
      where: {
        businessId_code: {
          businessId,
          code: validated.code.trim(),
        },
      },
    })

    if (existing) {
      return { success: false as const, error: `Account code "${validated.code}" is already in use.` }
    }

    const account = await prisma.chartOfAccount.create({
      data: {
        businessId,
        code: validated.code.trim(),
        name: validated.name.trim(),
        type: validated.type,
        normalBalance: validated.normalBalance,
        parentId: validated.parentId || null,
        currency: validated.currency || null,
        description: validated.description?.trim() || null,
        isHeader: validated.isHeader ?? false,
        isActive: validated.isActive ?? true,
      },
    })

    safeRevalidatePath(`/b/${businessId}/accounting/chart-of-accounts`)
    safeRevalidatePath(`/b/${businessId}/accounting`)

    return serializeJson({ success: true as const, account })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Failed to create chart of account' }
  }
}

export async function updateChartOfAccountAction(
  businessId: string,
  input: Omit<UpdateChartOfAccountInput, 'businessId'>
) {
  try {
    await requireBusinessAccess(businessId, 'accounting', 'write')

    const validated = updateChartOfAccountSchema.parse({
      ...input,
      businessId,
    })

    const existing = await prisma.chartOfAccount.findFirst({
      where: {
        id: validated.accountId,
        businessId,
      },
    })

    if (!existing) {
      return { success: false as const, error: 'Account not found or access denied.' }
    }

    // If code changed, check uniqueness
    if (validated.code.trim() !== existing.code) {
      const duplicate = await prisma.chartOfAccount.findUnique({
        where: {
          businessId_code: {
            businessId,
            code: validated.code.trim(),
          },
        },
      })

      if (duplicate) {
        return { success: false as const, error: `Account code "${validated.code}" is already in use by another account.` }
      }
    }

    const updated = await prisma.chartOfAccount.update({
      where: { id: validated.accountId },
      data: {
        code: validated.code.trim(),
        name: validated.name.trim(),
        type: validated.type,
        normalBalance: validated.normalBalance,
        parentId: validated.parentId || null,
        currency: validated.currency || null,
        description: validated.description?.trim() || null,
        isHeader: validated.isHeader ?? false,
        isActive: validated.isActive ?? true,
      },
    })

    safeRevalidatePath(`/b/${businessId}/accounting/chart-of-accounts`)
    safeRevalidatePath(`/b/${businessId}/accounting`)

    return serializeJson({ success: true as const, account: updated })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'Failed to update chart of account' }
  }
}

/**
 * Pre-check if an account can be safely deleted or why it cannot be deleted
 */
export async function checkAccountDeletabilityAction(businessId: string, accountId: string) {
  try {
    await requireBusinessAccess(businessId, 'accounting', 'read')

    const account = await prisma.chartOfAccount.findFirst({
      where: { id: accountId, businessId },
      include: {
        _count: {
          select: {
            journalLines: true,
            children: true,
            cashAccounts: true,
            bankAccounts: true,
            expenses: true,
            salesTaxes: true,
            purchaseTaxes: true,
            reconciliationAdjustments: true,
            pettyCashVariances: true,
          },
        },
      },
    })

    if (!account) {
      return { success: false as const, error: 'الحساب غير موجود.' }
    }

    const isSystem = account.isSystem
    const transactionCount = account._count.journalLines
    const childrenCount = account._count.children
    const linkedCount =
      account._count.cashAccounts +
      account._count.bankAccounts +
      account._count.expenses +
      account._count.salesTaxes +
      account._count.purchaseTaxes +
      account._count.reconciliationAdjustments +
      account._count.pettyCashVariances

    let canDelete = true
    const blockingReasons: string[] = []

    if (transactionCount > 0) {
      canDelete = false
      blockingReasons.push(
        `يوجد ${transactionCount} قيد/حركة محاسبية مسجلة على هذا الحساب. يمنع الحذف لضمان سلامة وتوازن السجلات المالية، ويمكنك تعطيل الحساب بدلاً من حذفه.`
      )
    }

    if (childrenCount > 0) {
      canDelete = false
      blockingReasons.push(
        `يوجد ${childrenCount} حساب(ات) فرعية تابعة لهذا الحساب في الشجرة. يرجى نقل أو حذف الحسابات التابعة له أولاً.`
      )
    }

    if (linkedCount > 0 && transactionCount === 0) {
      // If linked to cash/bank configuration but no transactions, we allow delete or give note
      canDelete = false
      blockingReasons.push('الحساب مرتبط بحساب خزينة أو بنك أو ضريبة مفعلة في إعدادات النظام.')
    }

    return serializeJson({
      success: true as const,
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        isSystem,
        isActive: account.isActive,
      },
      canDelete,
      transactionCount,
      childrenCount,
      linkedCount,
      blockingReasons,
    })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'فشل في التحقق من إمكانية حذف الحساب' }
  }
}

/**
 * Safely delete an account if and only if it has zero transactions and zero active children
 */
export async function deleteChartOfAccountAction(businessId: string, accountId: string) {
  try {
    await requireBusinessAccess(businessId, 'accounting', 'delete')

    return await prisma.$transaction(
      async (tx) => {
        const account = await tx.chartOfAccount.findFirst({
          where: { id: accountId, businessId },
          include: {
            _count: {
              select: {
                journalLines: true,
                children: true,
                cashAccounts: true,
                bankAccounts: true,
                expenses: true,
                salesTaxes: true,
                purchaseTaxes: true,
                reconciliationAdjustments: true,
                pettyCashVariances: true,
              },
            },
          },
        })

        if (!account) {
          return { success: false as const, error: 'الحساب غير موجود أو تم حذفه مسبقاً.' }
        }

        if (account._count.journalLines > 0) {
          return {
            success: false as const,
            error: `لا يمكن حذف الحساب "${account.name}" لوجود ${account._count.journalLines} حركة وقيود محاسبية عليه. يمكنك تعطيل الحساب بدلاً من حذفه.`,
          }
        }

        if (account._count.children > 0) {
          return {
            success: false as const,
            error: `لا يمكن حذف الحساب "${account.name}" لوجود ${account._count.children} حسابات فرعية تابعة له.`,
          }
        }

        const linkedCount =
          account._count.cashAccounts +
          account._count.bankAccounts +
          account._count.expenses +
          account._count.salesTaxes +
          account._count.purchaseTaxes +
          account._count.reconciliationAdjustments +
          account._count.pettyCashVariances

        if (linkedCount > 0) {
          return {
            success: false as const,
            error: `الحساب "${account.name}" مرتبط بحسابات بنكية أو إعدادات ضريبية نشطة.`,
          }
        }

        // Safe to delete!
        await tx.chartOfAccount.delete({
          where: { id: accountId },
        })

        safeRevalidatePath(`/b/${businessId}/accounting/chart-of-accounts`)
        safeRevalidatePath(`/b/${businessId}/accounting`)
        safeRevalidatePath(`/b/${businessId}/reports`)

        return {
          success: true as const,
          deletedAccount: {
            id: account.id,
            code: account.code,
            name: account.name,
          },
        }
      },
      { maxWait: 10000, timeout: 20000 }
    )
  } catch (error: any) {
    return { success: false as const, error: error.message || 'فشل في حذف الحساب' }
  }
}

/**
 * Toggle Account Active Status (Alternative to deletion for accounts with journal history)
 */
export async function toggleChartOfAccountStatusAction(
  businessId: string,
  accountId: string,
  isActive: boolean
) {
  try {
    await requireBusinessAccess(businessId, 'accounting', 'write')

    const updated = await prisma.chartOfAccount.update({
      where: { id: accountId },
      data: { isActive },
    })

    safeRevalidatePath(`/b/${businessId}/accounting/chart-of-accounts`)
    safeRevalidatePath(`/b/${businessId}/accounting`)

    return serializeJson({ success: true as const, account: updated })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'فشل في تعديل حالة الحساب' }
  }
}

/**
 * Re-initialize & Smart Sync standard Chart of Accounts
 * - Creates missing standard accounts.
 * - Restores parent-child hierarchy and linkages without touching historical transactions.
 */
export async function syncStandardChartOfAccountsAction(businessId: string) {
  try {
    await requireBusinessAccess(businessId, 'accounting', 'write')

    const result = await AccountingService.ensureStandardChartOfAccounts(businessId)

    const accounts = await prisma.chartOfAccount.findMany({
      where: { businessId },
      orderBy: { code: 'asc' },
    })

    safeRevalidatePath(`/b/${businessId}/accounting/chart-of-accounts`)
    safeRevalidatePath(`/b/${businessId}/accounting`)
    safeRevalidatePath(`/b/${businessId}/reports`)

    return serializeJson({
      success: true as const,
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      totalAccounts: result.totalAccounts,
      accounts,
    })
  } catch (error: any) {
    return { success: false as const, error: error.message || 'فشل في مزامنة وتهيئة شجرة الحسابات' }
  }
}



