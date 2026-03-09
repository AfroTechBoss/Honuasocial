import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { blockDevOnlyRoute, safeErrorLog } from '@/lib/security'

// GET /api/test-connection - Test Supabase connection
export async function GET() {
  const blocked = blockDevOnlyRoute()
  if (blocked) return blocked

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing Supabase environment variables',
        },
        { status: 500 }
      )
    }

    const supabase = createRouteHandlerClient({ cookies })

    const { error } = await supabase.from('profiles').select('count').limit(1)

    if (error) {
      safeErrorLog('Supabase connection test failed:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Supabase connection failed',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase connection successful',
    })
  } catch (error) {
    safeErrorLog('Connection test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Connection test failed',
      },
      { status: 500 }
    )
  }
}