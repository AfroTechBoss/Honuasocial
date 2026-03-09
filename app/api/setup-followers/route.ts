import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { blockDevOnlyRoute, safeErrorLog } from '@/lib/security'

// POST /api/setup-followers - Add followers_count and following_count columns and triggers
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

    const setupSQL = `
      ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

      CREATE OR REPLACE FUNCTION update_follow_counts()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          UPDATE profiles
          SET followers_count = followers_count + 1
          WHERE id = NEW.following_id;

          UPDATE profiles
          SET following_count = following_count + 1
          WHERE id = NEW.follower_id;

          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          UPDATE profiles
          SET followers_count = followers_count - 1
          WHERE id = OLD.following_id;

          UPDATE profiles
          SET following_count = following_count - 1
          WHERE id = OLD.follower_id;

          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS update_follow_counts_trigger ON follows;
      CREATE TRIGGER update_follow_counts_trigger
        AFTER INSERT OR DELETE ON follows
        FOR EACH ROW
        EXECUTE FUNCTION update_follow_counts();

      UPDATE profiles SET
        followers_count = (
          SELECT COUNT(*) FROM follows WHERE following_id = profiles.id
        ),
        following_count = (
          SELECT COUNT(*) FROM follows WHERE follower_id = profiles.id
        );
    `

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: setupSQL })

      if (error) {
        safeErrorLog('Error setting up followers count:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to setup followers count functionality' },
          { status: 500 }
        )
      }
    } catch (setupError) {
      safeErrorLog('Error during setup:', setupError)
      return NextResponse.json(
        { success: false, error: 'Failed to setup followers count functionality' },
        { status: 500 }
      )
    }

    const { error: testError } = await supabase
      .from('profiles')
      .select('followers_count, following_count')
      .limit(1)

    if (testError) {
      safeErrorLog('Error testing followers count columns:', testError)
      return NextResponse.json({ success: false, error: 'Column creation may have failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Followers count functionality setup completed successfully' })
  } catch (error) {
    safeErrorLog('Setup error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/setup-followers - Check if followers count columns exist
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

    const { error } = await supabase.from('profiles').select('followers_count, following_count').limit(1)

    if (error) {
      return NextResponse.json({ exists: false, error: 'Followers count columns unavailable' })
    }

    return NextResponse.json({ exists: true, message: 'Followers count columns exist' })
  } catch (error) {
    safeErrorLog('Error checking followers setup:', error)
    return NextResponse.json({ exists: false, error: 'Internal server error' })
  }
}