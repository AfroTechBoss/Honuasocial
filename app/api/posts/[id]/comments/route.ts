import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { awardPostPoints } from '@/lib/green-points-post'

// GET /api/posts/[id]/comments - Get comments for a post
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const params = await context.params;
    const { id: postId } = params;
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Get current user session (optional for viewing comments)
    const { data: { session } } = await supabase.auth.getSession()

    // Fetch ALL comments (both top-level and replies) with user data and like counts
    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        comment_likes:comment_likes(count)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching comments:', error)
      return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
    }

    // Transform the data
    const transformedComments = await Promise.all(
      (comments || []).map(async (comment) => {
        let liked_by_user = false
        
        // Check if user liked this comment (only if user is logged in)
        if (session?.user?.id) {
          const { data: userLike } = await supabase
            .from('comment_likes')
            .select('id')
            .eq('comment_id', comment.id)
            .eq('user_id', session.user.id)
            .single()
          
          liked_by_user = !!userLike
        }
        
        return {
          ...comment,
          user: {
            ...comment.profiles,
            verified: false // Default value until verified column is added to database
          },
          likes_count: comment.comment_likes?.[0]?.count || 0,
          liked_by_user
        }
      })
    )

    return NextResponse.json({ comments: transformedComments })
  } catch (error) {
    console.error('Error in GET /api/posts/[id]/comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/posts/[id]/comments - Create a new comment
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const params = await context.params;
    const { id: postId } = params;

    // Get current user session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user profile exists
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .single()

    if (profileError || !userProfile) {
      console.error('User profile not found:', profileError)
      return NextResponse.json({ error: 'User profile not found. Please complete your profile setup.' }, { status: 400 })
    }

    const body = await request.json()
    const { content, parent_id } = body

    // Validate required fields
    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Check if post exists and get author info + green eligibility fields
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, user_id, sustainability_category, media_urls')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // If replying to a comment, check if parent comment exists
    if (parent_id) {
      const { data: parentComment, error: parentError } = await supabase
        .from('comments')
        .select('id')
        .eq('id', parent_id)
        .eq('post_id', postId)
        .single()

      if (parentError || !parentComment) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
      }
    }

    // Insert new comment
    const { data: comment, error } = await supabase
      .from('comments')
      .insert({
        post_id: postId,
        user_id: session.user.id,
        content: content.trim(),
        parent_id: parent_id || null
      })
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .single()

    if (error) {
      console.error('Error creating comment:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      
      // Handle specific error cases
      if (error.code === '23503') {
        return NextResponse.json({ error: 'Invalid reference: post or user not found' }, { status: 400 })
      }
      if (error.code === '42501') {
        return NextResponse.json({ error: 'Permission denied: check your account permissions' }, { status: 403 })
      }
      
      return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
    }

    // Create notification for post author (if not commenting on own post)
    if (post.user_id !== session.user.id) {
      try {
        await supabase.rpc('create_notification', {
          p_recipient_id: post.user_id,
          p_actor_id: session.user.id,
          p_type: 'comment',
          p_post_id: postId,
          p_comment_id: comment.id,
          p_content: 'commented on your post'
        })
      } catch (notificationError) {
        console.error('Error creating comment notification:', notificationError)
        // Don't fail the comment operation if notification fails
      }
      // Award green points to post author for engagement (green posts only)
      try {
        await awardPostPoints(supabase, {
          postId,
          authorUserId: post.user_id,
          actionType: 'comment',
          sustainability_category: post.sustainability_category,
          media_urls: post.media_urls,
        })
      } catch (pointsError) {
        console.error('Green points award error:', pointsError)
      }
    }

    // Handle mentions in comment content
    try {
      const mentionRegex = /@([a-zA-Z0-9_]+)/g
      const mentions: string[] = []
      let match
      
      while ((match = mentionRegex.exec(content)) !== null) {
        mentions.push(match[1]) // Extract username without @
      }
      
      if (mentions.length > 0) {
        // Get user IDs for mentioned usernames
        const { data: mentionedUsers } = await supabase
          .from('profiles')
          .select('id, username')
          .in('username', [...new Set(mentions)]) // Remove duplicates
        
        // Create mention notifications
        if (mentionedUsers) {
          for (const mentionedUser of mentionedUsers) {
            if (mentionedUser.id !== session.user.id) { // Don't notify self
              await supabase.rpc('create_notification', {
                p_recipient_id: mentionedUser.id,
                p_actor_id: session.user.id,
                p_type: 'mention',
                p_post_id: postId,
                p_comment_id: comment.id,
                p_content: 'mentioned you in a comment'
              })
            }
          }
        }
      }
    } catch (mentionError) {
      console.error('Error handling mentions:', mentionError)
      // Don't fail the comment operation if mention handling fails
    }

    // Transform the response
    const transformedComment = {
      ...comment,
      user: {
        ...comment.profiles,
        verified: false // Default value until verified column is added to database
      },
      likes_count: 0,
      liked_by_user: false
    }

    return NextResponse.json({ comment: transformedComment }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/posts/[id]/comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}