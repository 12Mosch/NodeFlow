import { ArrowLeftRight, Braces, FileText, Lightbulb } from 'lucide-react'
import type { ComponentType } from 'react'
import type { FlashcardBaseData } from './types'

type FlashcardType = NonNullable<FlashcardBaseData['cardType']>

export const CARD_TYPE_LABELS = {
  basic: 'Basic',
  concept: 'Concept',
  descriptor: 'Descriptor',
  cloze: 'Cloze',
} as const

export const CARD_TYPE_ICONS: Record<
  FlashcardType,
  ComponentType<{ className?: string }>
> = {
  basic: ArrowLeftRight,
  concept: Lightbulb,
  descriptor: FileText,
  cloze: Braces,
}

export const CARD_TYPE_COLORS = {
  basic: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  concept:
    'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  descriptor:
    'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  cloze: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
} as const

export const STATE_LABELS = {
  new: 'New',
  learning: 'Learning',
  review: 'Review',
  relearning: 'Relearning',
} as const

export const STATE_COLORS = {
  new: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  learning:
    'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  review:
    'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  relearning:
    'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
} as const

export const LEECH_COLOR =
  'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
