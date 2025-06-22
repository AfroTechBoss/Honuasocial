import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/posts/[id]/like - Like a post
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

    // Check if post exists
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check if user already liked the post
    const { data: existingLike } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', session.user.id)
      .single()

    if (existingLike) {
      return NextResponse.json({ error: 'Post already liked' }, { status: 400 })
    }

    // Add like
    const { error } = await supabase
      .from('likes')
      .insert({
        post_id: postId,
        user_id: session.user.id
      })

    if (error) {
      console.error('Error liking post:', error)
      return NextResponse.json({ error: 'Failed to like post' }, { status: 500 })
    }

    // Get updated like count
    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)

    return NextResponse.json({ 
      message: 'Post liked successfully',
      likes_count: count || 0,
      liked_by_user: true
    })
  } catch (error) {
    console.error('Error in POST /api/posts/[id]/like:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/posts/[id]/like - Unlike a post
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

    // Remove like
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', session.user.id)

    if (error) {
      console.error('Error unliking post:', error)
      return NextResponse.json({ error: 'Failed to unlike post' }, { status: 500 })
    }

    // Get updated like count
    const { count } = await supabase
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId)

    return NextResponse.json({ 
      message: 'Post unliked successfully',
      likes_count: count || 0,
      liked_by_user: false
    })
  } catch (error) {
    console.error('Error in DELETE /api/posts/[id]/like:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}