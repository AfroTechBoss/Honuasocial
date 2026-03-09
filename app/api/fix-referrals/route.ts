import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Function to track referrals
const trackReferral = async (newUserId: string, referralCode: string) => {
  try {
    // Find the inviter by username or user ID
    let inviterId = null
    
    // Try to find by username first
    const { data: inviterByUsername } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', referralCode)
      .single()
    
    if (inviterByUsername) {
      inviterId = inviterByUsername.id
    } else {
      // Try to find by user ID (first 8 characters)
      const { data: inviterById } = await supabase
        .from('profiles')
        .select('id')
        .ilike('id', `${referralCode}%`)
        .limit(1)
      
      if (inviterById && inviterById.length > 0) {
        inviterId = inviterById[0].id
      }
    }
    
    if (inviterId) {
      // Check if referral already exists
      const { data: existingReferral } = await supabase
        .from('referrals')
        .select('id')
        .eq('inviter_id', inviterId)
        .eq('invited_user_id', newUserId)
        .single()
      
      if (existingReferral) {
        return { success: true, message: 'Referral already exists', skipped: true }
      }
      
      // Create referral record
      const { error: referralError } = await supabase.from('referrals').insert({
        inviter_id: inviterId,
        invited_user_id: newUserId,
        referral_code: referralCode,
        status: 'completed',
        points_awarded: 10,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      })
      
      if (referralError) {
        console.error('Error creating referral record:', referralError)
        return { success: false, error: referralError.message }
      }
      
      return { success: true, message: 'Referral tracked successfully' }
    } else {
      return { success: false, error: 'Inviter not found' }
    }
  } catch (error) {
    console.error('Error tracking referral:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// POST /api/fix-referrals - Fix missing referral tracking for existing users
export async function POST(request: NextRequest) {
  try {
    // Get all users who have referral_code in their metadata but no referral record
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      return NextResponse.json(
        { error: 'Failed to fetch users', details: usersError.message },
        { status: 500 }
      )
    }
    
    const results = []
    let processed = 0
    let created = 0
    let skipped = 0
    let errors = 0
    
    for (const user of users.users) {
      const referralCode = user.user_metadata?.referral_code
      
      if (referralCode && user.id) {
        processed++
        const result = await trackReferral(user.id, referralCode)
        
        if (result.success) {
          if (result.skipped) {
            skipped++
          } else {
            created++
          }
        } else {
          errors++
        }
        
        results.push({
          userId: user.id,
          email: user.email,
          referralCode,
          result
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      summary: {
        totalUsers: users.users.length,
        usersWithReferralCodes: processed,
        referralsCreated: created,
        referralsSkipped: skipped,
        errors
      },
      details: results
    })
    
  } catch (error) {
    console.error('Error fixing referrals:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET /api/fix-referrals - Check referral status
export async function GET(request: NextRequest) {
  try {
    // Get count of users with referral codes in metadata
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      return NextResponse.json(
        { error: 'Failed to fetch users', details: usersError.message },
        { status: 500 }
      )
    }
    
    const usersWithReferralCodes = users.users.filter(user => user.user_metadata?.referral_code)
    
    // Get count of existing referrals
    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select('id')
    
    const referralCount = referrals?.length || 0
    
    return NextResponse.json({
      totalUsers: users.users.length,
      usersWithReferralCodes: usersWithReferralCodes.length,
      existingReferrals: referralCount,
      potentialMissingReferrals: Math.max(0, usersWithReferralCodes.length - referralCount),
      usersWithCodes: usersWithReferralCodes.map(user => ({
        id: user.id,
        email: user.email,
        referralCode: user.user_metadata?.referral_code,
        createdAt: user.created_at
      }))
    })
    
  } catch (error) {
    console.error('Error checking referrals:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}