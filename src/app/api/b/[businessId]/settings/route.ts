import { NextRequest, NextResponse } from 'next/server'
import { SettingsService } from '@/lib/services/settings-service'
import { TaxService } from '@/lib/services/tax-service'
import { CurrencyService } from '@/lib/services/currency-service'
import { requireBusinessAccess } from '@/lib/auth/require-auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params
    await requireBusinessAccess(businessId)

    const settings = await SettingsService.getBusinessSettings(businessId)
    return NextResponse.json(settings)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params
    const { membership, userId } = await requireBusinessAccess(businessId)

    const body = await req.json()
    const { section, data } = body

    if (!section || !data) {
      return NextResponse.json({ error: 'Section and data are required' }, { status: 400 })
    }

    // Permission check
    const allowed = SettingsService.checkPermission(membership.role, section)
    if (!allowed) {
      return NextResponse.json({ error: 'Unauthorized: insufficient role permissions to update this setting' }, { status: 403 })
    }

    let result: any

    switch (section) {
      case 'company':
        result = await SettingsService.updateCompanyProfile(businessId, data, userId)
        break
      case 'financial':
        result = await SettingsService.updateFinancialSettings(businessId, data, userId)
        break
      case 'accounting':
        result = await SettingsService.updateAccountingDefaults(businessId, data, userId)
        break
      case 'numbering':
        if (data.docType && data.config) {
          result = await SettingsService.updateNumberingConfig(businessId, data.docType, data.config, userId)
        }
        break
      case 'businessDefaults':
        result = await SettingsService.updateBusinessDefaults(businessId, data, userId)
        break
      case 'templates':
        result = await SettingsService.updateTemplateSettings(businessId, data, userId)
        break
      case 'localization':
        result = await SettingsService.updateLocalizationSettings(businessId, data, userId)
        break
      case 'tax':
        if (data.taxId) {
          result = await TaxService.updateTax(businessId, data.taxId, data, userId)
        } else {
          result = await TaxService.createTax(businessId, data, userId)
        }
        break
      case 'exchangeRate':
        result = await CurrencyService.setExchangeRate(businessId, data, userId)
        break
      default:
        return NextResponse.json({ error: `Invalid configuration section: ${section}` }, { status: 400 })
    }

    return NextResponse.json({ success: true, result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
