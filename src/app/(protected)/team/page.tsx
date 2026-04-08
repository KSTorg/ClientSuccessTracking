import { requireTeamMember } from '@/lib/auth/require-team'
import { createClient } from '@/lib/supabase/server'
import { TeamView } from '@/components/team/team-view'

export default async function TeamPage() {
  const { user, profile } = await requireTeamMember()
  const supabase = await createClient()

  const { data: members } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, specialty')
    .in('role', ['admin', 'csm'])
    .order('full_name')

  return (
    <TeamView
      members={(members ?? []) as Parameters<typeof TeamView>[0]['members']}
      currentUserId={user.id}
      currentUserRole={profile!.role}
    />
  )
}
