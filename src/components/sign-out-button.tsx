'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface SignOutButtonProps {
  variant?: 'button' | 'link'
  className?: string
}

export function SignOutButton({
  variant = 'button',
  className,
}: SignOutButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  if (variant === 'link') {
    return (
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg text-kst-muted hover:text-kst-white hover:bg-white/5 transition-colors text-sm w-full',
          className
        )}
      >
        <LogOut size={16} />
        <span>{loading ? 'Signing out...' : 'Sign Out'}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className={cn(
        'inline-flex items-center gap-2 px-5 h-11 rounded-xl glass-panel-sm text-kst-white text-sm hover:bg-white/5 transition-colors disabled:opacity-60',
        className
      )}
    >
      <LogOut size={16} />
      {loading ? 'Signing out...' : 'Sign Out'}
    </button>
  )
}
