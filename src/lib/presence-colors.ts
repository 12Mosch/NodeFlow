/**
 * Presence color utilities for collaborative editing.
 * Provides a palette of distinct, accessible colors for user cursors and avatars.
 */

// 15 distinct colors optimized for visibility on both light and dark backgrounds
export const PRESENCE_COLORS = [
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#673AB7', // Deep Purple
  '#3F51B5', // Indigo
  '#2196F3', // Blue
  '#03A9F4', // Light Blue
  '#00BCD4', // Cyan
  '#009688', // Teal
  '#4CAF50', // Green
  '#8BC34A', // Light Green
  '#FF9800', // Orange
  '#FF5722', // Deep Orange
  '#795548', // Brown
  '#607D8B', // Blue Grey
  '#F44336', // Red
] as const

export type PresenceColor = (typeof PRESENCE_COLORS)[number]

/**
 * Simple hash function for strings.
 * Uses djb2 algorithm for consistent, well-distributed hashes.
 */
function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i)
    hash = hash >>> 0 // Convert to unsigned 32-bit integer
  }
  return hash
}

/**
 * Get a deterministic color for a user based on their ID or session ID.
 * Returns the same color for the same input, ensuring consistency.
 */
export function getPresenceColor(id: string): PresenceColor {
  const hash = hashString(id)
  const index = hash % PRESENCE_COLORS.length
  return PRESENCE_COLORS[index]
}

/**
 * Get a random color from the palette.
 * Used for generating initial colors for new users.
 */
export function getRandomPresenceColor(): PresenceColor {
  const index = Math.floor(Math.random() * PRESENCE_COLORS.length)
  return PRESENCE_COLORS[index]
}

/**
 * Get CSS variables for a presence color.
 * Returns an object suitable for use with style prop.
 */
export function getPresenceColorStyles(color: string): {
  '--presence-color': string
  '--presence-color-light': string
} {
  return {
    '--presence-color': color,
    '--presence-color-light': `${color}33`, // 20% opacity
  }
}
