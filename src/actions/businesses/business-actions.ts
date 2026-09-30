'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/require-auth'
import { createAuditLog } from '@/lib/audit/create-audit-log'
import type { ActionResult } from '@/actions/auth/auth-actions'

// ============================================================
// Validation
// ============================================================

const CreateBusinessSchema = z.object({
  name: z.string().min(2, 'Business name must be at least 2 characters').max(100),
  legalName: z.string().max(200).optional(),
  defaultCurrency: z.string().length(3, 'Currency must be a 3-letter ISO code').default('USD'),
  country: z.string().optional(),
  timezone: z.string().default('UTC'),
  taxNumber: z.string().optional(),
})

// ============================================================
// CREATE BUSINESS
// ============================================================

export async function createBusinessAction(
  formData: FormData
): Promise<ActionResult<{ businessId: string }>> {
  const user = await requireUser()

  const rawData = {
    name: formData.get('name') as string,
    legalName: (formData.get('legalName') as string) || undefined,
    defaultCurrency: (formData.get('defaultCurrency') as string) || 'USD',
    country: (formData.get('country') as string) || undefined,
    timezone: (formData.get('timezone') as string) || 'UTC',
    taxNumber: (formData.get('taxNumber') as string) || undefined,
  }

  const result = CreateBusinessSchema.safeParse(rawData)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return { success: false, error: firstError.message, field: firstError.path[0] as string }
  }

  const data = result.data

  const { business, membership } = await prisma.$transaction(async (tx) => {
    // Create the business
    const business = await tx.business.create({
      data: {
        name: data.name,
        legalName: data.legalName,
        defaultCurrency: data.defaultCurrency,
        country: data.country,
        timezone: data.timezone,
        taxNumber: data.taxNumber,
        status: 'active',
      },
    })

    // Make the creator the owner
    const membership = await tx.businessUser.create({
      data: {
        userId: user.id,
        businessId: business.id,
        role: 'owner',
        status: 'active',
        joinedAt: new Date(),
      },
    })

    // Seed default Chart of Accounts
    await seedDefaultChartOfAccounts(tx, business.id)

    // Seed default cash account
    await tx.cashAccount.create({
      data: {
        businessId: business.id,
        name: 'Petty Cash',
        currencyCode: data.defaultCurrency,
        isDefault: true,
      },
    })

    return { business, membership }
  })

  await createAuditLog({
    businessId: business.id,
    userId: user.id,
    action: 'create',
    module: 'businesses',
    recordType: 'business',
    recordId: business.id,
    newValues: { name: data.name, defaultCurrency: data.defaultCurrency },
  })

  revalidatePath('/dashboard')
  redirect(`/b/${business.id}/dashboard`)
}

// ============================================================
// SEED DEFAULT CHART OF ACCOUNTS
// ============================================================

async function seedDefaultChartOfAccounts(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  businessId: string
) {
  const defaultAccounts = [
    // Assets
    { code: '1000', name: 'Assets', type: 'asset', normalBalance: 'debit', isHeader: true, sortOrder: 100 },
    { code: '1100', name: 'Cash', type: 'asset', normalBalance: 'debit', isSystem: true, sortOrder: 110 },
    { code: '1200', name: 'Bank Accounts', type: 'asset', normalBalance: 'debit', isSystem: true, sortOrder: 120 },
    { code: '1300', name: 'Accounts Receivable', type: 'asset', normalBalance: 'debit', isSystem: true, sortOrder: 130 },
    { code: '1400', name: 'Inventory', type: 'asset', normalBalance: 'debit', isSystem: true, sortOrder: 140 },
    { code: '1500', name: 'Prepaid Expenses', type: 'asset', normalBalance: 'debit', sortOrder: 150 },

    // Liabilities
    { code: '2000', name: 'Liabilities', type: 'liability', normalBalance: 'credit', isHeader: true, sortOrder: 200 },
    { code: '2100', name: 'Accounts Payable', type: 'liability', normalBalance: 'credit', isSystem: true, sortOrder: 210 },
    { code: '2200', name: 'Tax Payable', type: 'liability', normalBalance: 'credit', isSystem: true, sortOrder: 220 },
    { code: '2300', name: 'Accrued Expenses', type: 'liability', normalBalance: 'credit', sortOrder: 230 },

    // Equity
    { code: '3000', name: 'Equity', type: 'equity', normalBalance: 'credit', isHeader: true, sortOrder: 300 },
    { code: '3100', name: "Owner's Equity", type: 'equity', normalBalance: 'credit', sortOrder: 310 },
    { code: '3200', name: 'Retained Earnings', type: 'equity', normalBalance: 'credit', isSystem: true, sortOrder: 320 },

    // Revenue
    { code: '4000', name: 'Revenue', type: 'revenue', normalBalance: 'credit', isHeader: true, sortOrder: 400 },
    { code: '4100', name: 'Sales Revenue', type: 'revenue', normalBalance: 'credit', isSystem: true, sortOrder: 410 },
    { code: '4200', name: 'Service Revenue', type: 'revenue', normalBalance: 'credit', sortOrder: 420 },
    { code: '4900', name: 'Other Income', type: 'revenue', normalBalance: 'credit', sortOrder: 490 },

    // Expenses
    { code: '5000', name: 'Expenses', type: 'expense', normalBalance: 'debit', isHeader: true, sortOrder: 500 },
    { code: '5100', name: 'Cost of Goods Sold', type: 'expense', normalBalance: 'debit', isSystem: true, sortOrder: 510 },
    { code: '5200', name: 'Salaries & Wages', type: 'expense', normalBalance: 'debit', sortOrder: 520 },
    { code: '5300', name: 'Rent Expense', type: 'expense', normalBalance: 'debit', sortOrder: 530 },
    { code: '5400', name: 'Utilities', type: 'expense', normalBalance: 'debit', sortOrder: 540 },
    { code: '5500', name: 'Marketing & Advertising', type: 'expense', normalBalance: 'debit', sortOrder: 550 },
    { code: '5900', name: 'Other Expenses', type: 'expense', normalBalance: 'debit', sortOrder: 590 },
  ]

  await (tx as typeof prisma).chartOfAccount.createMany({
    data: defaultAccounts.map((account) => ({
      businessId,
      code: account.code,
      name: account.name,
      type: account.type as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense',
      normalBalance: account.normalBalance as 'debit' | 'credit',
      isHeader: account.isHeader ?? false,
      isSystem: account.isSystem ?? false,
      sortOrder: account.sortOrder,
    })),
  })
}

// ============================================================
// GET USER BUSINESSES
// ============================================================

export async function getUserBusinessesAction() {
  const user = await requireUser()

  const memberships = await prisma.businessUser.findMany({
    where: {
      userId: user.id,
      status: 'active',
    },
    include: {
      business: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  return { success: true as const, data: memberships }
}
