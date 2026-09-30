import { NextRequest, NextResponse } from 'next/server'
import { ExportService } from '@/lib/export/export-service'
import { requireBusinessAccess } from '@/lib/auth/require-auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string; reportType: string }> }
) {
  try {
    const { businessId, reportType } = await params
    await requireBusinessAccess(businessId)

    const searchParams = req.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    const fromDateStr = searchParams.get('fromDate')
    const toDateStr = searchParams.get('toDate')

    const fromDate = fromDateStr ? new Date(fromDateStr) : new Date(new Date().getFullYear(), 0, 1)
    const toDate = toDateStr ? new Date(toDateStr) : new Date()

    let result: { data: any[]; columns: any[]; title?: string }

    switch (reportType) {
      case 'pl':
        result = await ExportService.exportProfitAndLoss(businessId, fromDate, toDate)
        break
      case 'balance-sheet':
        result = await ExportService.exportBalanceSheet(businessId, toDate)
        break
      case 'cash-flow':
        result = await ExportService.exportCashFlow(businessId, fromDate, toDate)
        break
      case 'ar-aging':
        result = await ExportService.exportAging(businessId, 'ar')
        break
      case 'ap-aging':
        result = await ExportService.exportAging(businessId, 'ap')
        break
      case 'inventory':
        result = await ExportService.exportInventoryValuation(businessId)
        break
      default:
        return NextResponse.json({ error: `Unknown report type: ${reportType}` }, { status: 400 })
    }

    if (format === 'xlsx') {
      const xmlContent = ExportService.generateXLSX(reportType.toUpperCase(), result.data, result.columns)
      return new NextResponse(xmlContent, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${reportType}_${new Date().toISOString().split('T')[0]}.xls"`,
        },
      })
    }

    const csvContent = ExportService.generateCSV(result.data, result.columns)
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${reportType}_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
