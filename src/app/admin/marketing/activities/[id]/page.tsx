import { redirect } from 'next/navigation'

export default async function MarketingActivityEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/admin/activities/${id}`)
}
