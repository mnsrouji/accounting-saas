import { NextRequest, NextResponse } from 'next/server'
import { ExportService } from '@/lib/export/export-service'
import { requireBusinessAccess } from '@/lib/auth/require-auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params
    await requireBusinessAccess(businessId)

    const searchParams = req.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    const fromDateStr = searchParams.get('fromDate')
    const toDateStr = searchParams.get('toDate')

    const fromDate = fromDateStr ? new Date(fromDateStr) : undefined
    const toDate = toDateStr ? new Date(toDateStr) : undefined

    const { data, columns } = await ExportService.exportExpenses(businessId, { fromDate, toDate })

    if (format === 'xlsx') {
      const xmlContent = ExportService.generateXLSX('Expenses', data, columns)
      return new NextResponse(xmlContent, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="expenses_${new Date().toISOString().split('T')[0]}.xls"`,
        },
      })
    }

    const csvContent = ExportService.generateCSV(data, columns)
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="expenses_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
