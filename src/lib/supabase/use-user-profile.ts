'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/supabase/get-user'

export interface UserWithProfileClient {
  user: User
  profile: Profile | null
}

/**
 * Client-side React hook that returns the current user and profile.
 * `loading` is true until the initial fetch completes.
 */
export function useUserProfile() {
  const [data, setData] = useState<UserWithProfileClient | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (mounted) {
          setData(null)
          setLoading(false)
        }
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (mounted) {
        setData({ user, profile: (profile as Profile) ?? null })
        setLoading(false)
      }
    }

    load()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      load()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return { data, loading }
}
