import { redirect } from 'next/navigation'
import { getUserWithProfile } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { SetupChecklist } from '@/components/SetupChecklist'

export default async function MyProgressPage() {
  const data = await getUserWithProfile()
  if (!data || !data.profile) redirect('/login')

  const supabase = await createClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, company_name')
    .eq('user_id', data.user.id)
    .maybeSingle()

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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1
          className="text-5xl md:text-6xl text-kst-gold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          My Progress
        </h1>
        <p className="mt-3 text-kst-muted">
          Welcome, {name} — here&apos;s your setup checklist for{' '}
          <span className="text-kst-white">{client.company_name}</span>
        </p>
      </div>

      <SetupChecklist
        clientId={client.id}
        isTeamView={false}
        clientName={client.company_name}
      />
    </div>
  )
}
