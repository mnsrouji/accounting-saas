import { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { DocumentTemplateService } from '@/lib/templates/document-template-service'
import { DocumentTemplateView } from '@/components/documents/document-template-view'

export const metadata: Metadata = {
  title: 'Purchase Bill | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string; purchaseId: string }>
}

export default async function PurchaseBillPrintPage({ params }: PageProps) {
  const { businessId, purchaseId } = await params
  await requireBusinessAccess(businessId)

  const documentData = await DocumentTemplateService.getPurchaseInvoiceData(businessId, purchaseId)

  return (
    <DocumentTemplateView
      data={documentData}
      backUrl={`/b/${businessId}/purchases/${purchaseId}`}
    />
  )
}
