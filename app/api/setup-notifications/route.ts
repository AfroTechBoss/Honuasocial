import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { blockDevOnlyRoute, safeErrorLog } from '@/lib/security'

// POST /api/setup-notifications - Create notifications table if it doesn't exist
export async function POST() {
  const blocked = blockDevOnlyRoute()
  if (blocked) return blocked

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ success: false, error: 'Missing Supabase configuration' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error: checkError } = await supabase.from('notifications').select('count').limit(1)

    if (!checkError) {
      return NextResponse.json({ success: true, message: 'Notifications table already exists' })
    }

    try {
      const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', 'create_notifications_table.sql')

      if (!fs.existsSync(migrationPath)) {
        return NextResponse.json({ success: false, error: 'Migration file not found' }, { status: 500 })
      }

      const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
      const statements = migrationSQL
        .split(';')
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'))

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await supabase.rpc('exec', { sql: `${statement};` })
          } catch {
            break
          }
        }
      }
    } catch (migrationError) {
      safeErrorLog('Migration execution failed:', migrationError)

      try {
        const createTableResult = await supabase.rpc('create_notifications_table_basic')

        if (createTableResult.error) {
          return NextResponse.json(
            {
              success: false,
              error: 'Unable to create notifications table automatically',
              instructions:
                'Please run the migration manually in Supabase SQL editor: supabase/migrations/create_notifications_table.sql',
            },
            { status: 500 }
          )
        }
      } catch (fallbackError) {
        safeErrorLog('Fallback notifications setup failed:', fallbackError)
        return NextResponse.json(
          {
            success: false,
            error: 'Unable to create notifications table automatically',
            instructions:
              'Please run the migration manually in Supabase SQL editor: supabase/migrations/create_notifications_table.sql',
          },
          { status: 500 }
        )
      }
    }

    const { error: testError } = await supabase.from('notifications').select('count').limit(1)

    if (testError) {
      safeErrorLog('Error testing notifications table:', testError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to verify notifications table creation',
          instructions:
            'Please run the migration manually in Supabase SQL editor: supabase/migrations/create_notifications_table.sql',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'Notifications table created successfully' })
  } catch (error) {
    safeErrorLog('Error in setup-notifications:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        instructions:
          'Please run the migration manually in Supabase SQL editor: supabase/migrations/create_notifications_table.sql',
      },
      { status: 500 }
    )
  }
}

// GET /api/setup-notifications - Check if notifications table exists
export async function GET() {
  const blocked = blockDevOnlyRoute()
  if (blocked) return blocked

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ exists: false, error: 'Missing Supabase configuration' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { error } = await supabase.from('notifications').select('count').limit(1)

    if (error) {
      if (
        error.message.includes('relation "notifications" does not exist') ||
        error.message.includes('table "notifications" does not exist')
      ) {
        return NextResponse.json({ exists: false, message: 'Notifications table does not exist' })
      }

      return NextResponse.json({ exists: false, error: 'Error checking notifications table' }, { status: 500 })
    }

    return NextResponse.json({ exists: true, message: 'Notifications table exists' })
  } catch (error) {
    safeErrorLog('Error checking notifications table:', error)
    return NextResponse.json({ exists: false, error: 'Internal server error' }, { status: 500 })
  }
}