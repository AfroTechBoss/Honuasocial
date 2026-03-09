import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { conversationId } = await context.params

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: conversation, error } = await supabase
      .from('conversations')
      .select('id, participant_one_id, participant_two_id, created_at, updated_at')
      .eq('id', conversationId)
      .single()

    if (error || !conversation) {
      console.error('Error fetching conversation:', error)
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    if (conversation.participant_one_id !== user.id && conversation.participant_two_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const otherParticipantId =
      conversation.participant_one_id === user.id
        ? conversation.participant_two_id
        : conversation.participant_one_id

    let otherParticipant: {
      id: string
      username: string | null
      full_name: string | null
      avatar_url: string | null
      is_online: boolean
    } | null = null

    if (otherParticipantId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, is_online')
        .eq('id', otherParticipantId)
        .single()

      if (profile) {
        otherParticipant = {
          id: profile.id,
          username: profile.username,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          is_online: !!profile.is_online,
        }
      }
    }

    const formattedConversation = {
      id: conversation.id,
      participant_one_id: conversation.participant_one_id,
      participant_two_id: conversation.participant_two_id,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
      otherParticipant,
    }

    return NextResponse.json(formattedConversation)
  } catch (error) {
    console.error('Error in conversation API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

