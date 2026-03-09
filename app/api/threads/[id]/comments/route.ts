import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/threads/[id]/comments - Get comments for a thread
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const params = await context.params;
    const { id: threadId } = params;
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Get current user session (optional for viewing comments)
    const { data: { session } } = await supabase.auth.getSession()

    // Verify thread exists
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .select('id')
      .eq('id', threadId)
      .single()

    if (threadError || !thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      )
    }

    // Get comments for the thread
    // Try thread_id first, fallback to post_id if thread_id column doesn't exist
    const commentsQuery = supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        parent_id,
        thread_id,
        post_id,
        profiles:user_id(
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .or(`thread_id.eq.${threadId},post_id.eq.${threadId}`)
      .is('parent_id', null) // Only get top-level comments
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    const { data: comments, error: commentsError } = await commentsQuery

    if (commentsError) {
      console.error('Error fetching comments:', commentsError)
      return NextResponse.json(
        { error: 'Failed to fetch comments' },
        { status: 500 }
      )
    }

    // Get replies for each comment
    const commentsWithReplies = await Promise.all(
      comments.map(async (comment) => {
        const { data: replies } = await supabase
          .from('comments')
          .select(`
            id,
            content,
            created_at,
            likes_count,
            profiles:user_id(
              id,
              username,
              full_name,
              avatar_url
            )
          `)
          .eq('parent_id', comment.id)
          .order('created_at', { ascending: true })

        // Get user vote for comment if user is logged in
        let userVote = null
        if (session?.user) {
          const { data: vote } = await supabase
            .from('comment_votes')
            .select('vote_type')
            .eq('comment_id', comment.id)
            .eq('user_id', session.user.id)
            .single()
          
          userVote = vote?.vote_type || null
        }

        return {
          id: comment.id,
          content: comment.content,
          author: {
            username: (comment.profiles as any)?.username || 'Unknown',
            full_name: (comment.profiles as any)?.full_name || 'Unknown User',
            avatar_url: (comment.profiles as any)?.avatar_url || '/placeholder.svg',
            badges: []
          },
          likes_count: 0, // Will be implemented with proper vote system
          dislikes_count: 0, // Will be implemented with proper vote system
          created_at: comment.created_at,
          user_vote: userVote,
          replies: replies?.map(reply => ({
            id: reply.id,
            content: reply.content,
            author: {
              username: (reply.profiles as any)?.username || 'Unknown',
              full_name: (reply.profiles as any)?.full_name || 'Unknown User',
              avatar_url: (reply.profiles as any)?.avatar_url || '/placeholder.svg'
            },
            likes_count: 0, // Will be implemented with proper vote system
            created_at: reply.created_at,
            user_vote: null // Would need to fetch user votes for replies too
          })) || []
        }
      })
    )

    return NextResponse.json({
      comments: commentsWithReplies,
      pagination: {
        page,
        limit,
        total: comments.length
      }
    })

  } catch (error) {
    console.error('Error in GET /api/threads/[id]/comments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/threads/[id]/comments - Create a new comment
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const params = await context.params;
    const { id: threadId } = params;
    const { content, parent_id } = await request.json()

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify thread exists
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .select('id')
      .eq('id', threadId)
      .single()

    if (threadError || !thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      )
    }

    // If parent_id is provided, verify the parent comment exists
    if (parent_id) {
      const { data: parentComment, error: parentError } = await supabase
        .from('comments')
        .select('id, thread_id, post_id')
        .eq('id', parent_id)
        .or(`thread_id.eq.${threadId},post_id.eq.${threadId}`)
        .single()

      if (parentError || !parentComment) {
        return NextResponse.json(
          { error: 'Parent comment not found' },
          { status: 404 }
        )
      }
    }

    // Create the comment
    // Try to insert with thread_id first, fallback to post_id if thread_id column doesn't exist
    let insertData: any = {
      content,
      user_id: session.user.id,
      parent_id: parent_id || null
    }

    // Check if thread_id column exists by trying to insert with it first
    insertData.thread_id = threadId
    
    let { data: comment, error: commentError } = await supabase
      .from('comments')
      .insert(insertData)
      .select(`
        id,
        content,
        created_at,
        parent_id,
        profiles:user_id(
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .single()

    // If thread_id column doesn't exist, fallback to post_id
    if (commentError && commentError.message?.includes('thread_id')) {
      console.log('thread_id column not found, falling back to post_id')
      insertData = {
        content,
        post_id: threadId,
        user_id: session.user.id,
        parent_id: parent_id || null
      }
      
      const fallbackResult = await supabase
        .from('comments')
        .insert(insertData)
        .select(`
          id,
          content,
          created_at,
          parent_id,
          profiles:user_id(
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .single()
      
      comment = fallbackResult.data
      commentError = fallbackResult.error
    }

    if (commentError || !comment) {
      console.error('Error creating comment:', commentError)
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500 }
      )
    }

    // Format the response
    const formattedComment = {
      id: comment.id,
      content: comment.content,
      author: {
        username: (comment.profiles as any)?.username || 'Unknown',
        full_name: (comment.profiles as any)?.full_name || 'Unknown User',
        avatar_url: (comment.profiles as any)?.avatar_url || '/placeholder.svg',
        badges: []
      },
      likes_count: 0, // Will be implemented with proper vote system
      dislikes_count: 0, // Will be implemented with proper vote system
      created_at: comment.created_at,
      user_vote: null,
      replies: []
    }

    return NextResponse.json({ comment: formattedComment }, { status: 201 })

  } catch (error) {
    console.error('Error in POST /api/threads/[id]/comments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}