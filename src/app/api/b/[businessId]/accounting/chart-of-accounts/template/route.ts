import { NextRequest, NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { ChartOfAccountExcelService } from '@/lib/services/coa-excel-service'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params
    await requireBusinessAccess(businessId)

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { defaultCurrency: true, name: true },
    })

    const currency = business?.defaultCurrency || 'SAR'
    const buffer = ChartOfAccountExcelService.generateTemplate(currency)

    const filename = `chart_of_accounts_template_${currency}.xlsx`

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') || error.message?.includes('Forbidden') ? 401 : 500
    return NextResponse.json(
      { error: error.message || 'Failed to download template' },
      { status }
    )
  }
}
