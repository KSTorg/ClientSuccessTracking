import { notFound } from 'next/navigation'
import { requireTeamMember } from '@/lib/auth/require-team'
import { createClient } from '@/lib/supabase/server'
import { ClientDetailView } from '@/components/clients/client-detail-view'
import type { ClientContact } from '@/components/clients/contacts-section'
import type { Client, ClientWithCsm, CsmOption } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { profile } = await requireTeamMember()
  const { id } = await params

  const supabase = await createClient()

  // Plain select on clients (no FK embed) — see clients/page.tsx for why.
  const [clientRes, csmsRes, contactsRes] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase
      .from('profiles')
      .select('id, full_name, specialty')
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

  const csms = (csmsRes.data ?? []) as CsmOption[]
  const contacts = (contactsRes.data ?? []) as ClientContact[]

  // Join CSM client-side
  const raw = clientRes.data as Client
  const csm = raw.assigned_csm
    ? csms.find((c) => c.id === raw.assigned_csm) ?? null
    : null
  const client: ClientWithCsm = { ...raw, csm }

  return (
    <ClientDetailView
      client={client}
      csms={csms}
      contacts={contacts}
      currentUserRole={profile!.role}
    />
  )
}
