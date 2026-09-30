import { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { DocumentTemplateService } from '@/lib/templates/document-template-service'
import { DocumentTemplateView } from '@/components/documents/document-template-view'

export const metadata: Metadata = {
  title: 'Customer Statement | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string; customerId: string }>
}

export default async function CustomerStatementPrintPage({ params }: PageProps) {
  const { businessId, customerId } = await params
  await requireBusinessAccess(businessId)

  const documentData = await DocumentTemplateService.getCustomerStatementData(businessId, customerId)

  return (
    <DocumentTemplateView
      data={documentData}
      backUrl={`/b/${businessId}/customers/${customerId}`}
    />
  )
}
