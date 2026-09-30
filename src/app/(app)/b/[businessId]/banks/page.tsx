import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ businessId: string }>
}

export default async function BanksRedirectPage({ params }: PageProps) {
  const { businessId } = await params
  redirect(`/b/${businessId}/treasury/banks`)
}
