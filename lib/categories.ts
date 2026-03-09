export const GENERAL_CATEGORIES = [
  "Technology",
  "Business",
  "Health & Wellness",
  "Education",
  "Science & Research",
  "Arts & Culture",
  "Sports & Fitness",
  "Travel",
  "Food & Nutrition",
  "Personal Finance",
  "Community & Volunteering",
  "Lifestyle",
  "Entertainment",
  "Environment & Sustainability"
]

/**
 * Categories that qualify a post for green points (eco-friendly content).
 * Without AI detection, we use category selection as eligibility.
 */
export const GREEN_ELIGIBLE_CATEGORIES = [
  "Environment & Sustainability",
  "Community & Volunteering",
]

export function isGreenEligibleCategory(category: string | null | undefined): boolean {
  if (!category?.trim()) return false
  return GREEN_ELIGIBLE_CATEGORIES.includes(category.trim())
}
