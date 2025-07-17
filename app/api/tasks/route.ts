import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/tasks - Get sustainability tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const category = searchParams.get('category')
    const difficulty = searchParams.get('difficulty')
    const completed = searchParams.get('completed')

    if (userId && completed !== null) {
      // Get user's completed tasks
      const { data: completedTasks, error } = await supabase
        .from('user_task_completions')
        .select(`
          completed_at,
          verification_status,
          verification_proof,
          sustainability_tasks (
            id,
            title,
            description,
            category,
            difficulty,
            points,
            impact_score,
            verification_required
          )
        `)
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })

      if (error) {
        console.error('Error fetching completed tasks:', error)
        return NextResponse.json(
          { error: 'Failed to fetch completed tasks' },
          { status: 500 }
        )
      }

      return NextResponse.json({ tasks: completedTasks })
    } else {
      // Get all available tasks
      let query = supabase
        .from('sustainability_tasks')
        .select('*')
        .order('difficulty', { ascending: true })
        .order('points', { ascending: true })

      if (category) {
        query = query.eq('category', category)
      }

      if (difficulty) {
        query = query.eq('difficulty', difficulty)
      }

      const { data: tasks, error } = await query

      if (error) {
        console.error('Error fetching tasks:', error)
        return NextResponse.json(
          { error: 'Failed to fetch tasks' },
          { status: 500 }
        )
      }

      // If userId is provided, also get completion status for each task
      if (userId) {
        const { data: completions } = await supabase
          .from('user_task_completions')
          .select('task_id, verification_status')
          .eq('user_id', userId)

        const completionMap = new Map()
        completions?.forEach(completion => {
          completionMap.set(completion.task_id, completion.verification_status)
        })

        const tasksWithStatus = tasks?.map(task => ({
          ...task,
          completion_status: completionMap.get(task.id) || null
        }))

        return NextResponse.json({ tasks: tasksWithStatus })
      }

      return NextResponse.json({ tasks })
    }
  } catch (error) {
    console.error('Error in tasks GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/tasks - Create a new task or complete a task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'complete') {
      // Complete a task
      const { userId, taskId, verificationProof } = body

      if (!userId || !taskId) {
        return NextResponse.json(
          { error: 'userId and taskId are required' },
          { status: 400 }
        )
      }

      // Check if task exists
      const { data: task, error: taskError } = await supabase
        .from('sustainability_tasks')
        .select('*')
        .eq('id', taskId)
        .single()

      if (taskError || !task) {
        return NextResponse.json(
          { error: 'Task not found' },
          { status: 404 }
        )
      }

      // Check if user already completed this task
      const { data: existingCompletion } = await supabase
        .from('user_task_completions')
        .select('id')
        .eq('user_id', userId)
        .eq('task_id', taskId)
        .single()

      if (existingCompletion) {
        return NextResponse.json(
          { error: 'Task already completed' },
          { status: 400 }
        )
      }

      // Create task completion
      const { data: completion, error: completionError } = await supabase
        .from('user_task_completions')
        .insert({
          user_id: userId,
          task_id: taskId,
          verification_proof: verificationProof || null,
          verification_status: task.verification_required ? 'pending' : 'verified'
        })
        .select()
        .single()

      if (completionError) {
        console.error('Error creating task completion:', completionError)
        return NextResponse.json(
          { error: 'Failed to complete task' },
          { status: 500 }
        )
      }

      // Award points if task doesn't require verification or is auto-verified
      if (!task.verification_required) {
        await supabase
          .rpc('add_reputation_points', {
            user_uuid: userId,
            action_type_param: 'task_completed',
            points_param: task.points,
            reference_id_param: taskId,
            reference_type_param: 'task',
            description_param: `Completed task: ${task.title}`
          })
      }

      return NextResponse.json({ 
        completion,
        message: task.verification_required 
          ? 'Task submitted for verification' 
          : 'Task completed successfully'
      }, { status: 201 })

    } else {
      // Create a new task (admin only)
      const {
        title,
        description,
        category,
        difficulty,
        points,
        impactScore,
        verificationRequired
      } = body

      if (!title || !description || !category || !difficulty) {
        return NextResponse.json(
          { error: 'Title, description, category, and difficulty are required' },
          { status: 400 }
        )
      }

      const validDifficulties = ['easy', 'medium', 'hard']
      if (!validDifficulties.includes(difficulty)) {
        return NextResponse.json(
          { error: 'Invalid difficulty level' },
          { status: 400 }
        )
      }

      const { data: task, error } = await supabase
        .from('sustainability_tasks')
        .insert({
          title,
          description,
          category,
          difficulty,
          points: points || 0,
          impact_score: impactScore || 0,
          verification_required: verificationRequired || false
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating task:', error)
        return NextResponse.json(
          { error: 'Failed to create task' },
          { status: 500 }
        )
      }

      return NextResponse.json({ task }, { status: 201 })
    }
  } catch (error) {
    console.error('Error in tasks POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/tasks - Verify a task completion (admin/moderator only)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { completionId, verificationStatus, verifiedBy } = body

    if (!completionId || !verificationStatus || !verifiedBy) {
      return NextResponse.json(
        { error: 'completionId, verificationStatus, and verifiedBy are required' },
        { status: 400 }
      )
    }

    const validStatuses = ['verified', 'rejected']
    if (!validStatuses.includes(verificationStatus)) {
      return NextResponse.json(
        { error: 'Invalid verification status' },
        { status: 400 }
      )
    }

    // Get the task completion
    const { data: completion, error: completionError } = await supabase
      .from('user_task_completions')
      .select(`
        *,
        sustainability_tasks (
          title,
          points
        )
      `)
      .eq('id', completionId)
      .single()

    if (completionError || !completion) {
      return NextResponse.json(
        { error: 'Task completion not found' },
        { status: 404 }
      )
    }

    // Update verification status
    const { error: updateError } = await supabase
      .from('user_task_completions')
      .update({
        verification_status: verificationStatus,
        verified_by: verifiedBy,
        verified_at: new Date().toISOString()
      })
      .eq('id', completionId)

    if (updateError) {
      console.error('Error updating task verification:', updateError)
      return NextResponse.json(
        { error: 'Failed to update verification status' },
        { status: 500 }
      )
    }

    // Award points if verified
    if (verificationStatus === 'verified') {
      await supabase
        .rpc('add_reputation_points', {
          user_uuid: completion.user_id,
          action_type_param: 'verified_action',
          points_param: completion.sustainability_tasks.points,
          reference_id_param: completion.task_id,
          reference_type_param: 'task',
          description_param: `Task verified: ${completion.sustainability_tasks.title}`
        })
    }

    return NextResponse.json({ 
      success: true,
      message: `Task ${verificationStatus} successfully`
    })
  } catch (error) {
    console.error('Error in tasks PUT:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}