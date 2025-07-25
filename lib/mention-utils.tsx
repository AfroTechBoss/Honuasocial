import Link from 'next/link'
import React from 'react'

/**
 * Renders content with clickable mentions (@username)
 * @param content - The text content to process
 * @returns JSX elements with mentions as clickable links
 */
export function renderContentWithMentions(content: string): React.ReactNode {
  if (!content) return null

  // Regular expression to match @mentions
  const mentionRegex = /@([a-zA-Z0-9_]+)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    const [fullMatch, username] = match
    const startIndex = match.index

    // Add text before the mention
    if (startIndex > lastIndex) {
      parts.push(content.slice(lastIndex, startIndex))
    }

    // Add the mention as a clickable link
    parts.push(
      <Link
        key={`mention-${startIndex}-${username}`}
        href={`/profile/${username}`}
        className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline font-semibold transition-colors duration-200"
      >
        {fullMatch}
      </Link>
    )

    lastIndex = startIndex + fullMatch.length
  }

  // Add remaining text after the last mention
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts.length > 0 ? parts : content
}

/**
 * Renders content with clickable hashtags
 * @param content - The text content to process
 * @returns JSX elements with hashtags as clickable links
 */
export function renderContentWithHashtags(content: string): React.ReactNode {
  if (!content) return null

  // Regular expression to match #hashtags
  const hashtagRegex = /#([a-zA-Z0-9_]+)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  while ((match = hashtagRegex.exec(content)) !== null) {
    const [fullMatch, hashtag] = match
    const startIndex = match.index

    // Add text before the hashtag
    if (startIndex > lastIndex) {
      parts.push(content.slice(lastIndex, startIndex))
    }

    // Add the hashtag as a clickable link
    parts.push(
      <Link
        key={`hashtag-${startIndex}-${hashtag}`}
        href={`/search?q=${encodeURIComponent(fullMatch)}&type=hashtags`}
        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline font-semibold transition-colors duration-200"
      >
        {fullMatch}
      </Link>
    )

    lastIndex = startIndex + fullMatch.length
  }

  // Add remaining text after the last hashtag
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts.length > 0 ? parts : content
}

/**
 * Renders content with both clickable links and mentions
 * @param content - The text content to process
 * @returns JSX elements with links and mentions as clickable elements
 */
export function renderContentWithLinksAndMentions(content: string): React.ReactNode {
  if (!content) return null

  // Combined regex for URLs, mentions, and hashtags
  const combinedRegex = /(https?:\/\/[^\s]+)|(@[a-zA-Z0-9_]+)|(#[a-zA-Z0-9_]+)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  while ((match = combinedRegex.exec(content)) !== null) {
    const [fullMatch] = match
    const startIndex = match.index

    // Add text before the match
    if (startIndex > lastIndex) {
      parts.push(content.slice(lastIndex, startIndex))
    }

    if (fullMatch.startsWith('http')) {
      // Handle URL
      parts.push(
        <a
          key={`link-${startIndex}`}
          href={fullMatch}
          target="_blank"
          rel="noopener noreferrer"
          className="text-green-600 hover:text-green-700 hover:underline"
        >
          {fullMatch}
        </a>
      )
    } else if (fullMatch.startsWith('@')) {
      // Handle mention
      const username = fullMatch.slice(1) // Remove @ symbol
      parts.push(
        <Link
          key={`mention-${startIndex}-${username}`}
          href={`/profile/${username}`}
          className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline font-semibold transition-colors duration-200"
        >
          {fullMatch}
        </Link>
      )
    } else if (fullMatch.startsWith('#')) {
      // Handle hashtag
      const hashtag = fullMatch.slice(1) // Remove # symbol
      parts.push(
        <Link
          key={`hashtag-${startIndex}-${hashtag}`}
          href={`/search?q=${encodeURIComponent(fullMatch)}&type=hashtags`}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline font-semibold transition-colors duration-200"
        >
          {fullMatch}
        </Link>
      )
    }

    lastIndex = startIndex + fullMatch.length
  }

  // Add remaining text after the last match
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts.length > 0 ? parts : content
}

/**
 * Extracts all mentions from content
 * @param content - The text content to process
 * @returns Array of usernames mentioned (without @ symbol)
 */
export function extractMentions(content: string): string[] {
  if (!content) return []

  const mentionRegex = /@([a-zA-Z0-9_]+)/g
  const mentions: string[] = []
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    const username = match[1]
    if (!mentions.includes(username)) {
      mentions.push(username)
    }
  }

  return mentions
}

/**
 * Extracts all hashtags from content
 * @param content - The text content to process
 * @returns Array of hashtags mentioned (without # symbol)
 */
export function extractHashtags(content: string): string[] {
  if (!content) return []

  const hashtagRegex = /#([a-zA-Z0-9_]+)/g
  const hashtags: string[] = []
  let match

  while ((match = hashtagRegex.exec(content)) !== null) {
    const hashtag = match[1]
    if (!hashtags.includes(hashtag)) {
      hashtags.push(hashtag)
    }
  }

  return hashtags
}