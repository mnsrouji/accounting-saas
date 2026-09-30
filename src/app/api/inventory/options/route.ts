import { NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')

  if (!businessId) {
    return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
  }

  try {
    await requireBusinessAccess(businessId)

    const [products, warehouses] = await Promise.all([
      prisma.product.findMany({
        where: { businessId, isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      prisma.warehouse.findMany({
        where: { businessId, isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return NextResponse.json({ products, warehouses })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 })
  }
}
