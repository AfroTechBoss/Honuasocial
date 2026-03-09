import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { blockDevOnlyRoute, safeErrorLog } from '@/lib/security'

// POST /api/fix-rls - Add missing RLS policies for sustainability_tasks
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

    try {
      const { error: tableAccessError } = await supabase.from('sustainability_tasks').select('id').limit(1)

      if (tableAccessError) {
        safeErrorLog('Error accessing sustainability_tasks:', tableAccessError)
        return NextResponse.json({ success: false, error: 'Cannot access sustainability_tasks table' }, { status: 500 })
      }
    } catch (setupError) {
      safeErrorLog('Error during RLS setup:', setupError)
      return NextResponse.json({ success: false, error: 'Failed to execute RLS policy setup' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'RLS policy check completed successfully' })
  } catch (error) {
    safeErrorLog('Error in fix-rls endpoint:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/fix-rls - Check current RLS policies
export async function GET() {
  const blocked = blockDevOnlyRoute()
  if (blocked) return blocked

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ success: false, error: 'Missing Supabase configuration' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabase.from('pg_policies').select('*').eq('tablename', 'sustainability_tasks')

    if (error) {
      safeErrorLog('Failed to check policies:', error)
      return NextResponse.json({ success: false, error: 'Failed to check policies' }, { status: 500 })
    }

    return NextResponse.json({ success: true, policies: data })
  } catch (error) {
    safeErrorLog('Error checking RLS policies:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}