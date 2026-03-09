import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/posts/[id]/points
 * Returns the actual green points earned from this post (from DB).
 * Only the post author gets a non-zero value; others get 0 or 404.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const params = await context.params
    const postId = params.id

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('id, user_id')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (post.user_id !== user.id) {
      return NextResponse.json({ points: 0 })
    }

    const { data: rows, error } = await supabase
      .from('green_points_transactions')
      .select('points')
      .eq('user_id', user.id)
      .eq('reference_id', postId)
      .eq('reference_type', 'post')
      .gt('points', 0)

    if (error) {
      console.error('Error fetching post points:', error)
      return NextResponse.json({ error: 'Failed to fetch points' }, { status: 500 })
    }

    const points = (rows || []).reduce((sum, r) => sum + (r.points || 0), 0)
    return NextResponse.json({ points })
  } catch (error) {
    console.error('Error in GET /api/posts/[id]/points:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
