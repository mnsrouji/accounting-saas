import { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { DocumentTemplateService } from '@/lib/templates/document-template-service'
import { DocumentTemplateView } from '@/components/documents/document-template-view'

export const metadata: Metadata = {
  title: 'Payment Receipt | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string; paymentId: string }>
}

export default async function PaymentReceiptPrintPage({ params }: PageProps) {
  const { businessId, paymentId } = await params
  await requireBusinessAccess(businessId)

  const documentData = await DocumentTemplateService.getPaymentReceiptData(businessId, paymentId)

  return (
    <DocumentTemplateView
      data={documentData}
      backUrl={`/b/${businessId}/payments/${paymentId}`}
    />
  )
}
