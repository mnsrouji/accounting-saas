import { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { DocumentTemplateService } from '@/lib/templates/document-template-service'
import { DocumentTemplateView } from '@/components/documents/document-template-view'

export const metadata: Metadata = {
  title: 'Invoice | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string; saleId: string }>
}

export default async function SalesInvoicePrintPage({ params }: PageProps) {
  const { businessId, saleId } = await params
  await requireBusinessAccess(businessId)

  const documentData = await DocumentTemplateService.getSalesInvoiceData(businessId, saleId)

  return (
    <DocumentTemplateView
      data={documentData}
      backUrl={`/b/${businessId}/sales/${saleId}`}
    />
  )
}
