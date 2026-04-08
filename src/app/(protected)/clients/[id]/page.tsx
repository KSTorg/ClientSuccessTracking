import { notFound } from 'next/navigation'
import { requireTeamMember } from '@/lib/auth/require-team'
import { createClient } from '@/lib/supabase/server'
import { ClientDetailView } from '@/components/clients/client-detail-view'
import type { ClientWithCsm, CsmOption } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: PageProps) {
  await requireTeamMember()
  const { id } = await params

  const supabase = await createClient()

  const [clientRes, csmsRes] = await Promise.all([
    supabase
      .from('clients')
      .select('*, csm:profiles!assigned_csm(id, full_name)')
      .eq('id', id)
      .single(),
    supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin', 'csm'])
      .order('full_name'),
  ])

  if (clientRes.error || !clientRes.data) {
    notFound()
  }

  const client = clientRes.data as ClientWithCsm
  const csms = (csmsRes.data ?? []) as CsmOption[]

  return <ClientDetailView client={client} csms={csms} />
}
