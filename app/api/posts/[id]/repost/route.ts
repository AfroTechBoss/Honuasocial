import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { awardPostPoints } from '@/lib/green-points-post'

// POST /api/posts/[id]/repost - Repost a post
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { id: postId } = params

    // Get current user session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Check if post exists and get green eligibility fields
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, user_id, sustainability_category, media_urls')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check if user already reposted this post
    const { data: existingRepost } = await supabase
      .from('reposts')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .single()

    if (existingRepost) {
      return NextResponse.json({ error: 'Post already reposted' }, { status: 400 })
    }

    // Create repost
    const { error: repostError } = await supabase
      .from('reposts')
      .insert({
        post_id: postId,
        user_id: userId
      })

    if (repostError) {
      console.error('Error creating repost:', repostError)
      return NextResponse.json({ error: 'Failed to repost' }, { status: 500 })
    }

    // Create notification for the post author (if not self-repost)
    if (post.user_id !== userId) {
      try {
        await supabase.rpc('create_notification', {
          p_recipient_id: post.user_id,
          p_actor_id: userId,
          p_type: 'repost',
          p_post_id: postId,
          p_content: 'reposted your post'
        })
      } catch (notificationError) {
        console.error('Error creating repost notification:', notificationError)
        // Don't fail the repost operation if notification fails
      }
      // Award green points to post author for engagement (green posts only)
      try {
        await awardPostPoints(supabase, {
          postId,
          authorUserId: post.user_id,
          actionType: 'share',
          sustainability_category: post.sustainability_category,
          media_urls: post.media_urls,
        })
      } catch (pointsError) {
        console.error('Green points award error:', pointsError)
      }
    }

    // Get updated repost count
    const { data: repostCount } = await supabase
      .from('reposts')
      .select('id', { count: 'exact' })
      .eq('post_id', postId)

    return NextResponse.json({
      success: true,
      reposts_count: repostCount?.length || 0
    })
  } catch (error) {
    console.error('Error in POST /api/posts/[id]/repost:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/posts/[id]/repost - Remove repost
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { id: postId } = params

    // Get current user session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Remove repost
    const { error: deleteError } = await supabase
      .from('reposts')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error removing repost:', deleteError)
      return NextResponse.json({ error: 'Failed to remove repost' }, { status: 500 })
    }

    // Get updated repost count
    const { data: repostCount } = await supabase
      .from('reposts')
      .select('id', { count: 'exact' })
      .eq('post_id', postId)

    return NextResponse.json({
      success: true,
      reposts_count: repostCount?.length || 0
    })
  } catch (error) {
    console.error('Error in DELETE /api/posts/[id]/repost:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}