import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || (!serviceKey && !anonKey)) {
      return NextResponse.json(
        { success: false, error: 'Missing Supabase configuration' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey || anonKey!)

    const { error } = await supabase.from('profiles').select('id').limit(1)
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      pingedAt: new Date().toISOString()
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'Unexpected error' },
      { status: 500 }
    )
  }
}
