import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { awardPostPoints } from '@/lib/green-points-post'

// GET /api/posts - Fetch posts for home feed
export async function GET(request: NextRequest) {
  try {
    // Check if Supabase environment variables are configured
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json([], { status: 200 })
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Get current user (optional - posts should be accessible to everyone)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    // Don't return error for auth issues - just log and continue without user context
    if (authError) {
      console.log('No authenticated user, showing public posts:', authError.message)
    }

    // Fetch posts with user information and engagement data
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          full_name,
          avatar_url
        ),
        likes!left (
          id,
          user_id
        ),
        comments!left (
          id
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching posts:', error)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return NextResponse.json({ 
        error: 'Database error: ' + error.message + (error.hint ? ' Hint: ' + error.hint : '')
      }, { status: 500 })
    }

    // Transform posts to include engagement metrics
    const transformedPosts = posts.map(post => ({
      ...post,
      user: post.profiles,
      author: post.profiles,
      likes_count: post.likes?.length || 0,
      comments_count: post.comments?.length || 0,
      liked_by_user: user?.id ? (post.likes?.some((like: any) => like.user_id === user.id) || false) : false,
      created_at: post.created_at,
      updated_at: post.updated_at
    }))

    return NextResponse.json(transformedPosts)
  } catch (error) {
    console.error('Error in GET /api/posts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/posts - Create a new post
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure user has a profile before creating post
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!existingProfile) {
      // Create profile if it doesn't exist
      const userMetadata = user.user_metadata || {}
      const username = userMetadata.username || 
                      userMetadata.full_name?.toLowerCase().replace(/\s+/g, '') || 
                      user.email?.split('@')[0] || 
                      `user_${user.id.slice(0, 8)}`
      
      // Ensure username is unique
      let uniqueUsername = username
      let counter = 1
      while (true) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', uniqueUsername)
          .single()
        
        if (!existingUser) break
        uniqueUsername = `${username}${counter}`
        counter++
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          full_name: userMetadata.full_name || userMetadata.name || user.email?.split('@')[0] || 'User',
          username: uniqueUsername,
          avatar_url: userMetadata.avatar_url || userMetadata.picture || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 })
      }

      // Update user metadata with the final username
      await supabase.auth.updateUser({
        data: {
          username: uniqueUsername,
          full_name: userMetadata.full_name || userMetadata.name || user.email?.split('@')[0] || 'User'
        }
      })
    }

    const body = await request.json()
    const { content, media_urls, parent_id, location, sustainability_category, impact_score, link_preview } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Prepare insert data, only include parent_id if it's provided and not null/undefined
    const insertData: any = {
      user_id: user.id,
      content: content.trim(),
      media_urls: media_urls || [],
      location: location || null,
      sustainability_category: sustainability_category || null,
      impact_score: impact_score || null,
      link_preview_url: link_preview?.url || null,
      link_preview_title: link_preview?.title || null,
      link_preview_description: link_preview?.description || null,
      link_preview_image: link_preview?.image || null,
      link_preview_domain: link_preview?.domain || null
    }

    // Only add parent_id if it's a valid UUID string
    if (parent_id && typeof parent_id === 'string' && parent_id.trim() !== '') {
      insertData.parent_id = parent_id
    }

    // Insert the new post
    const { data: post, error } = await supabase
      .from('posts')
      .insert(insertData)
      .select(`
         *,
         profiles!posts_user_id_fkey (
           id,
           username,
           full_name,
           avatar_url
         )
       `)
      .single()

    if (error) {
      console.error('Error creating post:', error)
      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
    }

    // Award green points if post is in an eco-friendly category (no AI; category-based)
    try {
      await awardPostPoints(supabase, {
        postId: post.id,
        authorUserId: user.id,
        actionType: 'create',
        sustainability_category: sustainability_category || null,
        media_urls: media_urls || null,
      })
    } catch (pointsError) {
      console.error('Green points award error:', pointsError)
    }

    // Handle mentions in the post content
    try {
      const mentionPattern = /@([a-zA-Z0-9_]+)/g
      const mentions = []
      let match
      
      while ((match = mentionPattern.exec(content)) !== null) {
        mentions.push(match[1])
      }
      
      if (mentions.length > 0) {
        // Get user IDs for mentioned usernames
        const { data: mentionedUsers } = await supabase
          .from('profiles')
          .select('id, username')
          .in('username', mentions)
        
        if (mentionedUsers && mentionedUsers.length > 0) {
          // Create mention notifications for each mentioned user
          for (const mentionedUser of mentionedUsers) {
            if (mentionedUser.id !== user.id) { // Don't notify self
              try {
                await supabase.rpc('create_notification', {
                  p_recipient_id: mentionedUser.id,
                  p_actor_id: user.id,
                  p_type: 'mention',
                  p_post_id: post.id,
                  p_content: `mentioned you in a post`
                })
              } catch (notificationError) {
                console.error('Error creating mention notification:', notificationError)
                // Don't fail the post creation if notification fails
              }
            }
          }
        }
      }
    } catch (mentionError) {
      console.error('Error processing mentions:', mentionError)
      // Don't fail the post creation if mention processing fails
    }

    // Return the created post with default interaction counts
    const transformedPost = {
      ...post,
      user: post.profiles,
      likes_count: 0,
      comments_count: 0,
      reposts_count: 0,
      user_liked: false,
      user_bookmarked: false,
      user_reposted: false
    }

    return NextResponse.json(transformedPost, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/posts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
