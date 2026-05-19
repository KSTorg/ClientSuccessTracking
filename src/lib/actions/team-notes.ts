'use server'

import { createClient } from '@/lib/supabase/server'

export async function fetchTeamNotes(clientId: string, weekNum: number) {
  const supabase = await createClient()
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
  const supabase = await createClient()
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
  if (error) {
    console.error('[TeamNotes] insert failed:', error)
    return { data: null, error: error.message }
  }
  return { data, error: null }
}

export async function deleteTeamNote(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('team_notes').delete().eq('id', id)
  if (error) {
    console.error('[TeamNotes] delete failed:', error)
    return { error: error.message }
  }
  return { error: null }
}
