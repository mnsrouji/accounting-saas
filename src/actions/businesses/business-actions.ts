'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db/prisma'
import { requireUser } from '@/lib/auth/require-auth'
import { createAuditLog } from '@/lib/audit/create-audit-log'
import { AccountingService } from '@/lib/services/accounting-service'
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
    await AccountingService.ensureStandardChartOfAccounts(business.id, tx)

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
