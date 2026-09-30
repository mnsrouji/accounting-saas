// =============================================================
// Accounting Period Service — Fiscal Period Locking
// Multi-Tenant SaaS Accounting & Business Management Platform
// =============================================================
// Implements period locking to prevent backdated transactions in
// closed or locked accounting periods. This is a fundamental
// accounting control required by GAAP/IFRS compliance.
// =============================================================

import { prisma } from '@/lib/db/prisma'
import { AccountingError } from '@/lib/errors/accounting-error'

export type PeriodStatus = 'open' | 'closed' | 'locked'

export class AccountingPeriodService {
  /**
   * Check if a given date falls within a closed or locked period.
   * This is the primary guard that must be called before posting any journal entry.
   *
   * @param businessId - The tenant business ID
   * @param entryDate  - The date of the journal entry being posted
   * @param tx         - Optional Prisma transaction context
   *
   * @throws AccountingError if the period is locked (hard lock — no exceptions).
   * @throws AccountingError if the period is closed (soft lock).
   */
  static async checkPeriodOpen(
    businessId: string,
    entryDate: Date,
    tx: any = prisma
  ): Promise<void> {
    // Find any period that encompasses this date and is not 'open'
    const restrictedPeriod = await tx.accountingPeriod.findFirst({
      where: {
        businessId,
        status: { in: ['closed', 'locked'] },
        periodStart: { lte: entryDate },
        periodEnd: { gte: entryDate },
      },
    })

    if (!restrictedPeriod) {
      // No locked/closed period found — allow posting
      return
    }

    const periodLabel =
      restrictedPeriod.fiscalMonth === 0
        ? `السنة المالية ${restrictedPeriod.fiscalYear}`
        : `${restrictedPeriod.fiscalYear}/${String(restrictedPeriod.fiscalMonth).padStart(2, '0')}`

    const dateStr = entryDate.toISOString().split('T')[0]

    if (restrictedPeriod.status === 'locked') {
      throw new AccountingError(
        `لا يمكن ترحيل قيد بتاريخ ${dateStr} — الفترة المحاسبية "${periodLabel}" مقفلة نهائياً (Locked). ` +
        `يجب على المدير إلغاء قفل الفترة قبل إجراء أي قيود في هذه الفترة. ` +
        `(Period is hard-locked. Contact an administrator to unlock it.)`
      )
    }

    // status === 'closed'
    throw new AccountingError(
      `لا يمكن ترحيل قيد بتاريخ ${dateStr} — الفترة المحاسبية "${periodLabel}" مغلقة (Closed). ` +
      `يُرجى فتح الفترة أولاً أو ترحيل القيد في فترة مفتوحة. ` +
      `(Period is closed. Open the period first or use a date in an open period.)`
    )
  }

  /**
   * Create or retrieve an accounting period for a given year/month.
   */
  static async ensurePeriod(
    businessId: string,
    fiscalYear: number,
    fiscalMonth: number, // 1–12 for monthly, 0 for annual
    userId: string
  ) {
    const existing = await prisma.accountingPeriod.findUnique({
      where: { businessId_fiscalYear_fiscalMonth: { businessId, fiscalYear, fiscalMonth } },
    })
    if (existing) return existing

    // Compute period dates
    let periodStart: Date
    let periodEnd: Date

    if (fiscalMonth === 0) {
      // Annual period
      periodStart = new Date(`${fiscalYear}-01-01`)
      periodEnd = new Date(`${fiscalYear}-12-31`)
    } else {
      periodStart = new Date(fiscalYear, fiscalMonth - 1, 1)
      periodEnd = new Date(fiscalYear, fiscalMonth, 0) // Last day of month
    }

    return prisma.accountingPeriod.create({
      data: {
        businessId,
        fiscalYear,
        fiscalMonth,
        periodStart,
        periodEnd,
        status: 'open',
        createdAt: new Date(),
      },
    })
  }

  /**
   * Close a period (soft lock).
   * Closed periods block new transactions but can be re-opened by accountants.
   */
  static async closePeriod(
    businessId: string,
    fiscalYear: number,
    fiscalMonth: number,
    userId: string,
    notes?: string
  ) {
    const period = await prisma.accountingPeriod.findUnique({
      where: { businessId_fiscalYear_fiscalMonth: { businessId, fiscalYear, fiscalMonth } },
    })

    if (!period) {
      throw new AccountingError(`الفترة المحاسبية ${fiscalYear}/${fiscalMonth} غير موجودة.`)
    }
    if (period.status === 'locked') {
      throw new AccountingError(`الفترة مقفلة نهائياً ولا يمكن إغلاقها مرة أخرى.`)
    }

    return prisma.accountingPeriod.update({
      where: { businessId_fiscalYear_fiscalMonth: { businessId, fiscalYear, fiscalMonth } },
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedBy: userId,
        notes,
      },
    })
  }

  /**
   * Hard-lock a period. Only administrators should be able to call this.
   * Locked periods cannot receive any new transactions until explicitly unlocked.
   */
  static async lockPeriod(
    businessId: string,
    fiscalYear: number,
    fiscalMonth: number,
    userId: string,
    notes?: string
  ) {
    return prisma.accountingPeriod.upsert({
      where: { businessId_fiscalYear_fiscalMonth: { businessId, fiscalYear, fiscalMonth } },
      create: {
        businessId,
        fiscalYear,
        fiscalMonth,
        periodStart: new Date(fiscalYear, fiscalMonth - 1, 1),
        periodEnd: new Date(fiscalYear, fiscalMonth, 0),
        status: 'locked',
        lockedAt: new Date(),
        lockedBy: userId,
        notes,
      },
      update: {
        status: 'locked',
        lockedAt: new Date(),
        lockedBy: userId,
        notes,
      },
    })
  }

  /**
   * Re-open a closed period (administrator action).
   */
  static async openPeriod(
    businessId: string,
    fiscalYear: number,
    fiscalMonth: number,
    userId: string,
    notes?: string
  ) {
    const period = await prisma.accountingPeriod.findUnique({
      where: { businessId_fiscalYear_fiscalMonth: { businessId, fiscalYear, fiscalMonth } },
    })

    if (!period) {
      throw new AccountingError(`الفترة المحاسبية ${fiscalYear}/${fiscalMonth} غير موجودة.`)
    }

    return prisma.accountingPeriod.update({
      where: { businessId_fiscalYear_fiscalMonth: { businessId, fiscalYear, fiscalMonth } },
      data: {
        status: 'open',
        lockedAt: null,
        lockedBy: null,
        notes,
      },
    })
  }

  /**
   * List all accounting periods for a business.
   */
  static async listPeriods(businessId: string) {
    return prisma.accountingPeriod.findMany({
      where: { businessId },
      orderBy: [{ fiscalYear: 'desc' }, { fiscalMonth: 'desc' }],
    })
  }
}
