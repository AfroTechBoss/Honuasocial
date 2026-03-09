import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/messages/mark-delivered
 * Body: { message_id: string } | { message_ids: string[] }
 * Call when the recipient receives the message (e.g. via realtime). Sets delivered_at so sender sees two grey ticks.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const messageId = body.message_id as string | undefined
    const messageIds = body.message_ids as string[] | undefined
    const ids = messageId ? [messageId] : Array.isArray(messageIds) ? messageIds : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'message_id or message_ids required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    for (const id of ids) {
      const { data: msg } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id')
        .eq('id', id)
        .single()
      if (!msg || msg.sender_id === user.id) continue
      const { data: conv } = await supabase
        .from('conversations')
        .select('participant_one_id, participant_two_id')
        .eq('id', msg.conversation_id)
        .single()
      if (!conv) continue
      const isParticipant = conv.participant_one_id === user.id || conv.participant_two_id === user.id
      if (!isParticipant) continue
      await supabase
        .from('messages')
        .update({ delivered_at: now, updated_at: now })
        .eq('id', id)
        .is('delivered_at', null)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error in mark-delivered:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
