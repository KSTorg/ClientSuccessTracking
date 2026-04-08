import { notFound } from 'next/navigation'
import { requireTeamMember } from '@/lib/auth/require-team'
import { createClient } from '@/lib/supabase/server'
import { ClientDetailView } from '@/components/clients/client-detail-view'
import type { ClientContact } from '@/components/clients/contacts-section'
import type { ClientWithCsm, CsmOption } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: PageProps) {
  await requireTeamMember()
  const { id } = await params

  const supabase = await createClient()

  const [clientRes, csmsRes, contactsRes] = await Promise.all([
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
    supabase
      .from('client_contacts')
      .select('*')
      .eq('client_id', id)
      .order('created_at'),
  ])

  if (clientRes.error || !clientRes.data) {
    notFound()
  }

  const client = clientRes.data as ClientWithCsm
  const csms = (csmsRes.data ?? []) as CsmOption[]
  const contacts = (contactsRes.data ?? []) as ClientContact[]

  return (
    <ClientDetailView client={client} csms={csms} contacts={contacts} />
  )
}
