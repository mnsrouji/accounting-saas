import { Metadata } from 'next'
import { requireBusinessAccess } from '@/lib/auth/require-auth'
import { DocumentTemplateService } from '@/lib/templates/document-template-service'
import { DocumentTemplateView } from '@/components/documents/document-template-view'

export const metadata: Metadata = {
  title: 'Expense Voucher | AccountFlow',
}

interface PageProps {
  params: Promise<{ businessId: string; expenseId: string }>
}

export default async function ExpenseVoucherPrintPage({ params }: PageProps) {
  const { businessId, expenseId } = await params
  await requireBusinessAccess(businessId)

  const documentData = await DocumentTemplateService.getExpenseVoucherData(businessId, expenseId)

  return (
    <DocumentTemplateView
      data={documentData}
      backUrl={`/b/${businessId}/expenses/${expenseId}`}
    />
  )
}
