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
