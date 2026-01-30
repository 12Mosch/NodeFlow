import { twMerge } from 'tailwind-merge'
import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'

export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs))
}

export function getInitials(name?: string, email?: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  if (email && email.length > 0) {
    return email[0].toUpperCase()
  }
  return '?'
}

/**
 * Escape special regex characters in a string.
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * CSS class string for search highlight styling.
 */
export const SEARCH_HIGHLIGHT_CLASS =
  'bg-yellow-500/30 font-bold dark:bg-yellow-500/40'

/**
 * Calculate the Levenshtein distance between two strings.
 * This measures the minimum number of single-character edits
 * (insertions, deletions, substitutions) required to change
 * one string into the other.
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: Array<Array<number>> = []

  // Initialize the first row and column
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Find the best matching substring in text for a fuzzy query.
 * Uses a sliding window approach with similarity scoring.
 * Returns the start and end indices of the best match, or null if no good match found.
 */
export function findFuzzyMatchRange(
  text: string,
  query: string,
  threshold = 0.6,
): { start: number; end: number } | null {
  if (!text || !query) return null
  if (query.length === 0) return null

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // For very short queries, use exact substring matching
  if (query.length <= 2) {
    const index = lowerText.indexOf(lowerQuery)
    if (index !== -1) {
      return { start: index, end: index + query.length }
    }
    return null
  }

  // Try exact match first
  const exactIndex = lowerText.indexOf(lowerQuery)
  if (exactIndex !== -1) {
    return { start: exactIndex, end: exactIndex + query.length }
  }

  // Sliding window approach to find best fuzzy match
  // Window sizes range from query.length - 1 to query.length + 2
  const minWindowSize = Math.max(2, query.length - 1)
  const maxWindowSize = Math.min(text.length, query.length + 2)

  let bestMatch: { start: number; end: number; score: number } | null = null

  for (
    let windowSize = minWindowSize;
    windowSize <= maxWindowSize;
    windowSize++
  ) {
    for (let start = 0; start <= text.length - windowSize; start++) {
      const end = start + windowSize
      const substring = lowerText.slice(start, end)

      // Calculate similarity score based on character overlap and Levenshtein distance
      const distance = levenshteinDistance(substring, lowerQuery)
      const maxLen = Math.max(substring.length, lowerQuery.length)
      const similarity = 1 - distance / maxLen

      if (similarity >= threshold) {
        if (!bestMatch || similarity > bestMatch.score) {
          bestMatch = { start, end, score: similarity }
        }
      }
    }
  }

  if (bestMatch) {
    return { start: bestMatch.start, end: bestMatch.end }
  }

  return null
}

/**
 * Find all fuzzy matches in text for a query.
 * Returns an array of [start, end] index pairs.
 */
export function findAllFuzzyMatches(
  text: string,
  query: string,
  threshold = 0.6,
): Array<{ start: number; end: number }> {
  if (!text || !query) return []
  if (query.length === 0) return []

  const matches: Array<{ start: number; end: number }> = []
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // For very short queries, find all exact occurrences
  if (query.length <= 2) {
    let index = lowerText.indexOf(lowerQuery)
    while (index !== -1) {
      matches.push({ start: index, end: index + query.length })
      index = lowerText.indexOf(lowerQuery, index + 1)
    }
    return matches
  }

  // Track which positions have been matched to avoid overlapping matches
  const matchedRanges: Array<{ start: number; end: number }> = []

  // Sliding window approach
  const minWindowSize = Math.max(2, query.length - 1)
  const maxWindowSize = Math.min(text.length, query.length + 2)

  for (
    let windowSize = minWindowSize;
    windowSize <= maxWindowSize;
    windowSize++
  ) {
    for (let start = 0; start <= text.length - windowSize; start++) {
      const end = start + windowSize

      // Skip if this range overlaps with an already matched range
      const overlaps = matchedRanges.some(
        (range) =>
          (start >= range.start && start < range.end) ||
          (end > range.start && end <= range.end) ||
          (start <= range.start && end >= range.end),
      )
      if (overlaps) continue

      const substring = lowerText.slice(start, end)
      const distance = levenshteinDistance(substring, lowerQuery)
      const maxLen = Math.max(substring.length, lowerQuery.length)
      const similarity = 1 - distance / maxLen

      if (similarity >= threshold) {
        matches.push({ start, end })
        matchedRanges.push({ start, end })
      }
    }
  }

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start)

  return matches
}
