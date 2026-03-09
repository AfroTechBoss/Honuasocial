/**
 * Green points for posts – no AI; eligibility by category + credibility by media.
 * Points: base 1 for post, engagement (like 0.1, comment 0.3, share 0.5) × credibility.
 */

import { isGreenEligibleCategory } from './categories'
import type { SupabaseClient } from '@supabase/supabase-js'

const BASE_POINTS = 1
const POINTS_PER_LIKE = 0.1
const POINTS_PER_COMMENT = 0.3
const POINTS_PER_SHARE = 0.5

/** Credibility multiplier: text 1x, photo 1.5x, video 2x (no AI; we use media presence only). */
export function getCredibilityMultiplier(mediaUrls: string[] | null | undefined): number {
  if (!mediaUrls?.length) return 1
  const hasVideo = mediaUrls.some(
    (url) => /\.(mp4|webm|mov|avi)(\?|$)/i.test(url) || /video/i.test(url)
  )
  return hasVideo ? 2 : 1.5
}

export function computePostPoints(params: {
  sustainability_category: string | null | undefined
  media_urls?: string[] | null
  likes_count?: number | null
  comments_count?: number | null
  reposts_count?: number | null
}): { eligible: boolean; points: number; credibility: number } {
  const eligible = isGreenEligibleCategory(params.sustainability_category)
  if (!eligible) return { eligible: false, points: 0, credibility: 0 }

  const likes = Number(params.likes_count) || 0
  const comments = Number(params.comments_count) || 0
  const reposts = Number(params.reposts_count) || 0

  const credibility = getCredibilityMultiplier(params.media_urls)
  const engagement =
    likes * POINTS_PER_LIKE +
    comments * POINTS_PER_COMMENT +
    reposts * POINTS_PER_SHARE
  const points = BASE_POINTS + engagement * credibility
  const rounded = Math.round(points * 10) / 10
  return { eligible: true, points: Number.isFinite(rounded) ? rounded : 0, credibility }
}

const SOURCE_CREATE = 'green_post_create'
const SOURCE_LIKE = 'green_post_like'
const SOURCE_COMMENT = 'green_post_comment'
const SOURCE_SHARE = 'green_post_share'

const MAX_GREEN_POSTS_PER_DAY = 5

type ActionType = 'create' | 'like' | 'comment' | 'share'

export async function awardPostPoints(
  supabase: SupabaseClient,
  payload: {
    postId: string
    authorUserId: string
    actionType: ActionType
    sustainability_category?: string | null
    media_urls?: string[] | null
  }
): Promise<{ awarded: boolean; points?: number; error?: string }> {
  const { postId, authorUserId, actionType, sustainability_category, media_urls } = payload

  if (!isGreenEligibleCategory(sustainability_category)) {
    return { awarded: false }
  }

  const credibility = getCredibilityMultiplier(media_urls)

  let points: number
  let source: string
  let description: string

  switch (actionType) {
    case 'create':
      points = Math.round(BASE_POINTS * credibility * 10) / 10
      source = SOURCE_CREATE
      description = `Green post (+${points} pts)`
      break
    case 'like':
      points = Math.round(POINTS_PER_LIKE * credibility * 10) / 10
      source = SOURCE_LIKE
      description = `Engagement: like on your green post (+${points} pts)`
      break
    case 'comment':
      points = Math.round(POINTS_PER_COMMENT * credibility * 10) / 10
      source = SOURCE_COMMENT
      description = `Engagement: comment on your green post (+${points} pts)`
      break
    case 'share':
      points = Math.round(POINTS_PER_SHARE * credibility * 10) / 10
      source = SOURCE_SHARE
      description = `Engagement: share of your green post (+${points} pts)`
      break
    default:
      return { awarded: false }
  }

  if (points <= 0) return { awarded: false }

  // For 'create', only award once per post and respect daily cap
  if (actionType === 'create') {
    const { data: existing } = await supabase
      .from('green_points_transactions')
      .select('id')
      .eq('user_id', authorUserId)
      .eq('source', SOURCE_CREATE)
      .eq('reference_id', postId)
      .limit(1)
      .maybeSingle()

    if (existing) return { awarded: false }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { data: todayCreates } = await supabase
      .from('green_points_transactions')
      .select('id')
      .eq('user_id', authorUserId)
      .eq('source', SOURCE_CREATE)
      .gte('created_at', today.toISOString())

    if ((todayCreates?.length ?? 0) >= MAX_GREEN_POSTS_PER_DAY) {
      return { awarded: false }
    }
  }

  // DB stores integer points; round so engagement can still add (e.g. 0.5 * 2 = 1)
  const pointsToAward = Math.round(points)
  if (pointsToAward <= 0) return { awarded: false }

  const { error } = await supabase.rpc('add_green_points', {
    user_id: authorUserId,
    points: pointsToAward,
    transaction_type: 'earned',
    source,
    reference_id: postId,
    reference_type: 'post',
    description,
    metadata: { actionType, credibility },
  })

  if (error) {
    console.error('awardPostPoints error:', error)
    return { awarded: false, error: error.message }
  }

  return { awarded: true, points: pointsToAward }
}
