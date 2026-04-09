import { redirect } from 'next/navigation'
import { getUserWithProfile } from '@/lib/supabase/get-user'
import { createClient } from '@/lib/supabase/server'
import { ProtectedShell } from '@/components/protected-shell'
import { ToastProvider } from '@/components/ui/toast'
import { getMyTaskCounts } from '@/lib/my-task-counts'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const data = await getUserWithProfile()

  if (!data) {
    redirect('/login')
  }
  if (!data.profile) {
    // Clear the session so the middleware doesn't bounce them back here.
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login?error=missing_profile')
  }

  // Compute my-tasks badge for admin/csm sidebar
  let taskBadge: { overdue: number; total: number } = { overdue: 0, total: 0 }
  if (data.profile.role === 'admin' || data.profile.role === 'csm') {
    taskBadge = await getMyTaskCounts(data.user.id)
  }

  return (
    <ToastProvider>
      <ProtectedShell
        fullName={data.profile.full_name ?? ''}
        email={data.user.email ?? ''}
        role={data.profile.role}
        taskBadge={taskBadge}
      >
        {children}
      </ProtectedShell>
    </ToastProvider>
  )
}
