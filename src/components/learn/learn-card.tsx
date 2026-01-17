import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { RatingButtons } from './rating-buttons'
import type { LearnCard as LearnCardType, Rating } from './types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface LearnCardProps {
  card: LearnCardType
  onRate: (rating: Rating) => void
  isExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  /** Rating that was just triggered via keyboard - causes a flash effect */
  activeRating?: Rating | null
}

export function LearnCard({
  card,
  onRate,
  isExpanded: controlledExpanded,
  onExpandedChange,
  activeRating,
}: LearnCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const isExpanded =
    controlledExpanded !== undefined ? controlledExpanded : internalExpanded
  const setIsExpanded =
    onExpandedChange !== undefined ? onExpandedChange : setInternalExpanded

  const { block, document: doc, cardState, intervalPreviews } = card
  const direction = cardState.direction

  const isCloze = block.cardType === 'cloze'

  type ListKind = 'ul' | 'ol'

  const detectListKind = (text: string): ListKind | null => {
    const firstLine = text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0)
    if (!firstLine) return null
    if (firstLine.startsWith('• ')) return 'ul'
    if (/^\d+\.\s+/.test(firstLine)) return 'ol'
    return null
  }

  const renderList = (kind: ListKind, text: string) => {
    const rawLines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)

    if (rawLines.length === 0) return null

    if (kind === 'ul') {
      const items = rawLines.map((l) => l.replace(/^•\s+/, ''))
      return (
        <ul className="list-disc space-y-1.5 pl-6 text-xl leading-relaxed">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )
    }

    // ordered list
    const firstNumMatch = rawLines[0]?.match(/^(\d+)\.\s+/)
    const start = firstNumMatch ? Number(firstNumMatch[1]) : 1
    const items = rawLines.map((l) => l.replace(/^\d+\.\s+/, ''))
    return (
      <ol
        className="list-decimal space-y-1.5 pl-6 text-xl leading-relaxed"
        start={start}
      >
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
    )
  }

  // Render cloze text with highlighted answers
  const renderClozeAnswer = () => {
    if (!isCloze) return null

    // Replace {{text}} with highlighted spans
    const parts = block.textContent.split(/(\{\{[^}]+\}\})/)
    return (
      <p className="text-xl leading-relaxed whitespace-pre-line">
        {parts.map((part, i) => {
          if (part.startsWith('{{') && part.endsWith('}}')) {
            const answer = part.slice(2, -2)
            return (
              <mark
                key={i}
                className="rounded bg-emerald-500/20 px-1 py-0.5 font-medium text-emerald-700 dark:text-emerald-300"
              >
                {answer}
              </mark>
            )
          }
          return part
        })}
      </p>
    )
  }

  // Get the front and back content based on direction
  const getFrontBack = () => {
    if (isCloze) {
      // For cloze, front shows text with blanks
      const textWithBlanks =
        block.textContent.replace(/\{\{([^}]+)\}\}/g, '______') || ''
      return {
        front: textWithBlanks,
        back: '', // We'll render cloze back separately with highlighting
      }
    }

    // For other types, swap front/back based on direction
    if (direction === 'reverse') {
      return {
        front: block.cardBack || '',
        back: block.cardFront || '',
      }
    }

    return {
      front: block.cardFront || '',
      back: block.cardBack || '',
    }
  }

  const { front, back } = getFrontBack()
  const questionListKind = detectListKind(front)
  const answerListKind = detectListKind(back)

  const cardTypeLabels = {
    basic: 'Basic',
    concept: 'Concept',
    descriptor: 'Descriptor',
    cloze: 'Cloze',
  }

  const cardTypeColors = {
    basic: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    concept:
      'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    descriptor:
      'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    cloze: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  }

  const stateLabels = {
    new: 'New',
    learning: 'Learning',
    review: 'Review',
    relearning: 'Relearning',
  }

  const stateColors = {
    new: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    learning:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    review:
      'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    relearning:
      'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  }

  return (
    <Card className="overflow-hidden border-border/50 py-0 shadow-lg ring-1 ring-black/5 transition-all duration-300 ease-out dark:ring-white/5">
      <CardContent className="p-0">
        {/* Header with metadata */}
        <div className="flex items-center justify-between border-b border-border/50 px-8 py-4">
          <span className="max-w-50 truncate text-sm text-muted-foreground">
            {doc?.title || 'Untitled'}
          </span>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn('text-xs', stateColors[cardState.state])}
            >
              {stateLabels[cardState.state]}
            </Badge>
            {block.cardType && (
              <Badge
                variant="outline"
                className={cn('text-xs', cardTypeColors[block.cardType])}
              >
                {cardTypeLabels[block.cardType]}
              </Badge>
            )}
            {direction === 'reverse' && (
              <Badge variant="outline" className="text-xs">
                Reverse
              </Badge>
            )}
          </div>
        </div>

        {/* Front of card - question area */}
        <button
          onClick={() => !isExpanded && setIsExpanded(true)}
          disabled={isExpanded}
          className={cn(
            'flex w-full flex-col items-center justify-center p-8 text-center transition-all duration-300',
            !isExpanded && 'min-h-48 cursor-pointer hover:bg-muted/30',
            isExpanded && 'min-h-32',
          )}
        >
          {/* Question - larger when answer is hidden for emphasis */}
          {questionListKind ? (
            <div
              className={cn(
                'leading-snug font-semibold transition-all duration-300',
                isExpanded ? 'text-xl' : 'text-3xl',
              )}
            >
              {renderList(questionListKind, front)}
            </div>
          ) : (
            <p
              className={cn(
                'leading-snug font-semibold whitespace-pre-line transition-all duration-300',
                isExpanded ? 'text-xl' : 'text-3xl',
              )}
            >
              {front}
            </p>
          )}
        </button>

        {/* Reveal button - only shown when collapsed */}
        {!isExpanded && (
          <div className="px-8 pb-8">
            <button
              onClick={() => setIsExpanded(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-4 font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-[0.98]"
            >
              <span>Reveal Answer</span>
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Back of card - collapsible */}
        <div
          id="flashcard-answer"
          className={cn(
            'grid transition-all duration-300 ease-out',
            isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="border-t border-dashed border-border/50 bg-muted/30">
              {/* Answer content */}
              <div
                className={cn(
                  'flex min-h-32 flex-col p-8',
                  // Center short answers, left-align long ones with extra margins
                  back.length > 120 || answerListKind || isCloze
                    ? 'items-start justify-center px-12'
                    : 'items-center justify-center text-center',
                )}
              >
                {isCloze ? (
                  renderClozeAnswer()
                ) : answerListKind ? (
                  renderList(answerListKind, back)
                ) : (
                  <p className="text-xl leading-relaxed whitespace-pre-line">
                    {back}
                  </p>
                )}
              </div>

              {/* Rating buttons */}
              <div className="px-8 pb-8">
                <RatingButtons
                  intervalPreviews={intervalPreviews}
                  onRate={onRate}
                  activeRating={activeRating}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
