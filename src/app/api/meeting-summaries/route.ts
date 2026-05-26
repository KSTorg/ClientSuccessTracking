import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// GET /api/meeting-summaries?clientId=...&weekNum=...
export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const clientId = searchParams.get('clientId')
  const weekNum = searchParams.get('weekNum')
  if (!clientId || !weekNum) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const { data, error } = await admin()
    .from('meeting_summaries')
    .select('*')
    .eq('client_id', clientId)
    .eq('week_number', Number(weekNum))
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[meeting-summaries GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

// POST /api/meeting-summaries
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const { data, error } = await admin()
    .from('meeting_summaries')
    .insert({
      client_id: body.clientId,
      week_number: body.weekNum,
      title: body.title || 'Call',
      content: body.content,
      author_name: body.authorName,
      created_by: body.createdBy,
    })
    .select()
    .single()

  if (error) {
    console.error('[meeting-summaries POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data })
}

// PUT /api/meeting-summaries
export async function PUT(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const update: Record<string, unknown> = {}
  if (body.title !== undefined) update.title = body.title
  if (body.content !== undefined) update.content = body.content

  const { error } = await admin()
    .from('meeting_summaries')
    .update(update)
    .eq('id', body.id)

  if (error) {
    console.error('[meeting-summaries PUT]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

// DELETE /api/meeting-summaries?id=...
export async function DELETE(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { error } = await admin().from('meeting_summaries').delete().eq('id', id)
  if (error) {
    console.error('[meeting-summaries DELETE]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
