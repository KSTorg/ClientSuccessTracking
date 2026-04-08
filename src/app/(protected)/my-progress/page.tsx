import { redirect } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import { getUserWithProfile } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { SetupChecklist } from '@/components/SetupChecklist'
import { formatDate } from '@/lib/utils'

export default async function MyProgressPage() {
  const data = await getUserWithProfile()
  if (!data || !data.profile) redirect('/login')

  const supabase = await createClient()

  // 1) Try the primary path: clients.user_id matches the signed-in user
  let { data: client } = await supabase
    .from('clients')
    .select('id, company_name, launched_date, program, joined_date, created_at')
    .eq('user_id', data.user.id)
    .maybeSingle()

  // 2) Fallback: secondary contacts via client_contacts.user_id
  if (!client) {
    const { data: contactRow } = await supabase
      .from('client_contacts')
      .select('client_id')
      .eq('user_id', data.user.id)
      .maybeSingle()

    if (contactRow?.client_id) {
      const { data: viaContact } = await supabase
        .from('clients')
        .select('id, company_name, launched_date, program, joined_date, created_at')
        .eq('id', contactRow.client_id)
        .maybeSingle()
      if (viaContact) client = viaContact
    }
  }

  const name = data.profile.full_name ?? data.user.email ?? 'there'

  if (!client) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1
          className="text-5xl md:text-6xl text-kst-gold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          My Progress
        </h1>
        <p className="mt-3 text-kst-muted">Welcome, {name}</p>

        <div className="glass-panel mt-8 p-8 text-center">
          <p className="text-kst-white text-base mb-2 font-semibold">
            Your account isn&apos;t linked yet
          </p>
          <p className="text-kst-muted text-sm leading-relaxed">
            Your account hasn&apos;t been linked to a client profile yet.
            Please contact your CSM to get set up.
          </p>
        </div>
      </div>
    )
  }

  const isLaunched = !!client.launched_date

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <h1
            className="text-5xl md:text-6xl text-kst-gold tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            My Progress
          </h1>
          {isLaunched && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border border-kst-success/60 text-kst-success bg-kst-success/10">
              <CheckCircle size={12} />
              Launched {formatDate(client.launched_date)}
            </span>
          )}
        </div>
        <p className="mt-3 text-kst-muted">
          Welcome, {name} — here&apos;s your setup checklist for{' '}
          <span className="text-kst-white">{client.company_name}</span>
        </p>
      </div>

      <SetupChecklist
        clientId={client.id}
        isTeamView={false}
        clientName={client.company_name}
        isLaunched={isLaunched}
        program={client.program ?? 'educator_incubator'}
        joinedDate={client.joined_date ?? client.created_at ?? null}
      />
    </div>
  )
}
