import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { blockDevOnlyRoute, safeErrorLog } from '@/lib/security'

// POST /api/test-notifications - Create sample notifications for testing
export async function POST() {
  const blocked = blockDevOnlyRoute()
  if (blocked) return blocked

  try {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const { data: userPost } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    const notifications = []

    try {
      const followNotification = await supabase.rpc('create_notification', {
        p_recipient_id: user.id,
        p_actor_id: user.id,
        p_type: 'follow',
        p_content: 'Welcome! This is a sample follow notification.',
      })
      notifications.push({ type: 'follow', id: followNotification })

      if (userPost) {
        const likeNotification = await supabase.rpc('create_notification', {
          p_recipient_id: user.id,
          p_actor_id: user.id,
          p_type: 'like',
          p_post_id: userPost.id,
          p_content: 'This is a sample like notification on your post.',
        })
        notifications.push({ type: 'like', id: likeNotification })
      }

      if (userPost) {
        const commentNotification = await supabase.rpc('create_notification', {
          p_recipient_id: user.id,
          p_actor_id: user.id,
          p_type: 'comment',
          p_post_id: userPost.id,
          p_content: 'This is a sample comment notification on your post.',
        })
        notifications.push({ type: 'comment', id: commentNotification })
      }

      const mentionNotification = await supabase.rpc('create_notification', {
        p_recipient_id: user.id,
        p_actor_id: user.id,
        p_type: 'mention',
        p_content: `This is a sample mention notification for @${userProfile.username}.`,
      })
      notifications.push({ type: 'mention', id: mentionNotification })
    } catch (notificationError) {
      safeErrorLog('Error creating sample notifications:', notificationError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create sample notifications',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Created ${notifications.length} sample notifications`,
      notifications,
    })
  } catch (error) {
    safeErrorLog('Error in test notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}