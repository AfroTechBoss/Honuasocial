import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// GET /api/forums - Get all forums
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || ''
    const category = searchParams.get('category') || ''

    let forumsQuery = supabase
      .from('forums')
      .select(`
        *,
        profiles:admin_id(username, full_name, avatar_url)
      `)
      .order('created_at', { ascending: false })

    if (query) {
      forumsQuery = forumsQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`)
    }

    if (category && category !== 'All') {
      forumsQuery = forumsQuery.eq('category', category)
    }

    const { data: forums, error } = await forumsQuery

    if (error) {
      console.error('Error fetching forums:', error)
      return NextResponse.json({ error: 'Failed to fetch forums' }, { status: 500 })
    }

    const forumIds = (forums || []).map((forum) => forum.id)
    const forumStats = new Map<string, { threadCount: number; memberIds: Set<string> }>()
    for (const forumId of forumIds) {
      forumStats.set(forumId, { threadCount: 0, memberIds: new Set<string>() })
    }

    if (forumIds.length > 0) {
      const { data: threads, error: threadsError } = await supabase
        .from('threads')
        .select('id, forum_id, user_id')
        .in('forum_id', forumIds)

      if (threadsError) {
        console.error('Error fetching forum thread stats:', threadsError)
        return NextResponse.json({ error: 'Failed to fetch forum stats' }, { status: 500 })
      }

      const allThreadIds = (threads || []).map((thread) => thread.id)
      const threadForumMap = new Map<string, string>()

      for (const thread of threads || []) {
        const stats = forumStats.get(thread.forum_id)
        if (!stats) continue
        stats.threadCount += 1
        if (thread.user_id) {
          stats.memberIds.add(thread.user_id)
        }
        threadForumMap.set(thread.id, thread.forum_id)
      }

      if (allThreadIds.length > 0) {
        const threadIdsCsv = allThreadIds.join(',')
        const { data: comments, error: commentsError } = await supabase
          .from('comments')
          .select('user_id, thread_id, post_id')
          .or(`thread_id.in.(${threadIdsCsv}),post_id.in.(${threadIdsCsv})`)

        if (commentsError) {
          console.error('Error fetching forum comment stats:', commentsError)
          return NextResponse.json({ error: 'Failed to fetch forum stats' }, { status: 500 })
        }

        for (const comment of comments || []) {
          const threadId = comment.thread_id || comment.post_id
          if (!threadId || !comment.user_id) continue
          const forumId = threadForumMap.get(threadId)
          if (!forumId) continue
          const stats = forumStats.get(forumId)
          if (!stats) continue
          stats.memberIds.add(comment.user_id)
        }
      }
    }

    const formattedForums = (forums || []).map((forum) => {
      const stats = forumStats.get(forum.id)
      const memberIds = new Set<string>(stats?.memberIds || [])
      if (forum.admin_id) {
        memberIds.add(forum.admin_id)
      }

      return {
        id: forum.id,
        name: forum.name,
        description: forum.description,
        category: forum.category,
        member_count: memberIds.size,
        thread_count: stats?.threadCount || 0,
        latest_activity: forum.updated_at || forum.created_at,
        moderators: [forum.profiles?.username],
        is_private: forum.is_private || false,
        creator: forum.profiles?.username,
        admin_id: forum.admin_id,
      }
    })

    return NextResponse.json(formattedForums)
  } catch (error) {
    console.error('Error in forums GET route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/forums - Create a new forum
export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const { name, description, category, is_private } = await request.json()

    if (!name || !description || !category) {
      return NextResponse.json({ error: 'Name, description, and category are required' }, { status: 400 })
    }

    const { data: forum, error } = await supabase
      .from('forums')
      .insert({
        name,
        description,
        category,
        admin_id: userId,
        is_private: is_private || false,
      })
      .select()

    if (error) {
      console.error('Error creating forum:', error)
      return NextResponse.json({ error: 'Failed to create forum' }, { status: 500 })
    }

    return NextResponse.json(forum[0], { status: 201 })
  } catch (error) {
    console.error('Error in forums POST route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

