'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function AuthRefresh() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // When the user returns to the tab (after backgrounding on mobile
    // or switching apps), proactively refresh the session before any
    // server component or middleware tries to read the expired token.
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            // Token was refreshed — tell Next.js to re-run server
            // components so they pick up the new cookies.
            router.refresh()
          }
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Also listen for the Supabase auth state change to catch token
    // refreshes that happen automatically in the background.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          router.refresh()
        }
        if (event === 'SIGNED_OUT') {
          router.replace('/login')
        }
      }
    )

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      subscription.unsubscribe()
    }
  }, [router])

  return null
}
