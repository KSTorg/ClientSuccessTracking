import { requireTeamMember } from '@/lib/auth/require-team'
import { createClient } from '@/lib/supabase/server'
import { TemplatesView } from '@/components/templates/templates-view'

export default async function TemplatesPage() {
  await requireTeamMember()
  const supabase = await createClient()

  const [stagesRes, tasksRes] = await Promise.all([
    supabase.from('stages').select('*').order('order_index'),
    supabase
      .from('tasks')
      .select('*')
      .eq('is_active', true)
      .order('order_index'),
  ])

  return (
    <TemplatesView
      stages={stagesRes.data ?? []}
      tasks={tasksRes.data ?? []}
    />
  )
}
