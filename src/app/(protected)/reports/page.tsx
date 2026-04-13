import { redirect } from 'next/navigation'
import { requireTeamMember } from '@/lib/auth/require-team'
import { createClient } from '@/lib/supabase/server'
import { ReportsView, type BugReport } from '@/components/reports/reports-view'

export default async function ReportsPage() {
  const { profile } = await requireTeamMember()
  if (profile!.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data } = await supabase
    .from('bug_reports')
    .select('*')
    .order('created_at', { ascending: false })

  return <ReportsView reports={(data ?? []) as BugReport[]} />
}
