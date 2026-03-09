import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/messages/mark-read
 * Body: { conversation_id: string }
 * Marks all messages in the conversation that were sent by the other user as delivered/read for the current user.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { conversation_id } = body
    if (!conversation_id) {
      return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 })
    }

    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('participant_one_id, participant_two_id')
      .eq('id', conversation_id)
      .single()

    if (convError || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const isParticipant = conv.participant_one_id === user.id || conv.participant_two_id === user.id
    if (!isParticipant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }

    const otherUserId = conv.participant_one_id === user.id ? conv.participant_two_id : conv.participant_one_id

    const now = new Date().toISOString()

    // Primary update: delivered + read.
    let { error: updateError } = await supabase
      .from('messages')
      .update({
        delivered_at: now,
        read_at: now,
        updated_at: now,
      })
      .eq('conversation_id', conversation_id)
      .eq('sender_id', otherUserId)

    // Backward-compatible fallback for databases without read_at column.
    if (updateError && /read_at/i.test(updateError.message || '')) {
      const fallback = await supabase
        .from('messages')
        .update({
          delivered_at: now,
          updated_at: now,
        })
        .eq('conversation_id', conversation_id)
        .eq('sender_id', otherUserId)

      updateError = fallback.error || null
    }

    if (updateError) {
      console.error('Error marking messages read:', updateError)
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error in mark-read:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}