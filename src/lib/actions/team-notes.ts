'use server'

import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function fetchTeamNotes(clientId: string, weekNum: number) {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('team_notes')
    .select('*')
    .eq('client_id', clientId)
    .eq('week_number', weekNum)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[TeamNotes] fetch failed:', error)
    return { data: [], error: error.message }
  }
  return { data: data ?? [], error: null }
}

export async function addTeamNote(
  clientId: string,
  weekNum: number,
  content: string,
  authorName: string | null,
  createdBy: string | null,
) {
  console.log('[TeamNotes SERVER] addTeamNote called:', { clientId, weekNum, content, authorName, createdBy })
  console.log('[TeamNotes SERVER] SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING')
  console.log('[TeamNotes SERVER] SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING')
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('team_notes')
    .insert({
      client_id: clientId,
      week_number: weekNum,
      content,
      author_name: authorName,
      created_by: createdBy,
    })
    .select()
    .single()
  console.log('[TeamNotes SERVER] result:', { data, error })
  if (error) {
    console.error('[TeamNotes] insert failed:', error)
    return { data: null, error: error.message }
  }
  return { data, error: null }
}

export async function deleteTeamNote(id: string) {
  const supabase = adminClient()
  const { error } = await supabase.from('team_notes').delete().eq('id', id)
  if (error) {
    console.error('[TeamNotes] delete failed:', error)
    return { error: error.message }
  }
  return { error: null }
}
