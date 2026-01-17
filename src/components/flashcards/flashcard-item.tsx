import { useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { detectListKind, renderClozeText, renderList } from './utils'
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
      wrapperClassName: 'text-xl leading-relaxed whitespace-pre-line',
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
    basic: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    concept:
      'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    descriptor:
      'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    cloze: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  }

  return (
    <Card className="overflow-hidden border-border/50 py-0 shadow-lg ring-1 ring-black/5 transition-all duration-300 ease-out dark:ring-white/5">
      <CardContent className="p-0">
        {/* Header with metadata */}
        <div className="flex items-center justify-between border-b border-border/50 px-8 py-4">
          <span className="max-w-50 truncate text-sm text-muted-foreground">
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
            <Button
              onClick={() => setIsExpanded(true)}
              className="w-full gap-2 py-6 text-base shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              Reveal Answer
              <ChevronDown className="h-5 w-5" />
            </Button>
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

              {/* Answer buttons */}
              {showButtons && (
                <div className="flex gap-4 px-8 pb-8">
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
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
