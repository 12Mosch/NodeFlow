import { useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { renderClozeText } from './utils'
import type { QuizCard } from './types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface FlashcardItemProps {
  card: QuizCard
  onAnswer: (knew: boolean) => void
  showButtons?: boolean
  isExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
}

export function FlashcardItem({
  card,
  onAnswer,
  showButtons = true,
  isExpanded: controlledExpanded,
  onExpandedChange,
}: FlashcardItemProps) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const isExpanded =
    controlledExpanded !== undefined ? controlledExpanded : internalExpanded
  const setIsExpanded =
    onExpandedChange !== undefined ? onExpandedChange : setInternalExpanded

  const { block, documentTitle, direction } = card

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
        <ul className="list-disc space-y-1 pl-6 text-lg leading-relaxed">
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
        className="list-decimal space-y-1 pl-6 text-lg leading-relaxed"
        start={start}
      >
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ol>
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

  // Render cloze text with highlighted answers
  const renderClozeAnswer = () => {
    if (!isCloze) return null

    return renderClozeText(block.textContent, {
      wrapperClassName: 'text-lg leading-relaxed whitespace-pre-line',
      markClassName:
        'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1 py-0.5 rounded font-medium',
    })
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
    basic: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    concept:
      'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    descriptor:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    cloze:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  }

  return (
    <Card className="overflow-hidden transition-all duration-300 ease-out">
      <CardContent className="p-0">
        {/* Front of card - always visible */}
        <div className="p-6">
          {/* Header with metadata */}
          <div className="mb-4 flex items-center justify-between">
            <span className="max-w-[200px] truncate text-sm text-muted-foreground">
              {documentTitle}
            </span>
            <div className="flex items-center gap-2">
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

          {/* Question */}
          {questionListKind ? (
            <div className="text-lg leading-relaxed font-medium">
              {renderList(questionListKind, front)}
            </div>
          ) : (
            <p className="text-lg leading-relaxed font-medium whitespace-pre-line">
              {front}
            </p>
          )}
        </div>

        {/* Accordion trigger */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-controls="flashcard-answer"
          className="flex w-full items-center justify-center gap-2 border-t bg-muted/50 px-6 py-3 transition-colors hover:bg-muted"
        >
          <span className="text-sm text-muted-foreground">
            {isExpanded ? 'Hide answer' : 'Show answer'}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              isExpanded && 'rotate-180',
            )}
          />
        </button>

        {/* Back of card - collapsible */}
        <div
          id="flashcard-answer"
          className={cn(
            'grid transition-all duration-300 ease-out',
            isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="overflow-hidden">
            <div className="border-t bg-muted/30 p-6 pt-4">
              {isCloze ? (
                renderClozeAnswer()
              ) : answerListKind ? (
                renderList(answerListKind, back)
              ) : (
                <p className="text-lg leading-relaxed whitespace-pre-line">
                  {back}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Answer buttons */}
        {showButtons && isExpanded && (
          <div className="flex gap-3 bg-muted/30 p-6 pt-0">
            <Button
              variant="outline"
              className="flex-1 gap-2 border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400"
              onClick={() => onAnswer(false)}
            >
              <X className="h-4 w-4" />
              Didn&apos;t know
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400"
              onClick={() => onAnswer(true)}
            >
              <Check className="h-4 w-4" />
              Knew it
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
