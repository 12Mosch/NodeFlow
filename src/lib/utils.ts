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
