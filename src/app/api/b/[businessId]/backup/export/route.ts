import { NextRequest, NextResponse } from 'next/server'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { DataManagementService } from '@/lib/services/data-management-service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params
    const { business } = await requireBusinessAccess(businessId)

    const backupPayload = await DataManagementService.exportBusinessBackup(businessId)
    const jsonString = JSON.stringify(backupPayload, null, 2)

    const sanitizedName = business.name.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_')
    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `backup-${sanitizedName}-${dateStr}.json`

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: any) {
    console.error('Export backup error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export backup' },
      { status: 500 }
    )
  }
}
