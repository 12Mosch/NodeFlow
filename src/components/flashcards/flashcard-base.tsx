import { useState } from 'react'
import { AlertTriangle, Ban, ChevronDown, Pencil } from 'lucide-react'
import { CARD_TYPE_COLORS, CARD_TYPE_LABELS, LEECH_COLOR } from './constants'
import { detectListKind, renderClozeText, renderList } from './utils'
import { RenderLatexText } from './latex-renderer'
import type { ReactNode } from 'react'
import type { FlashcardBaseData } from './types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

const LONG_ANSWER_THRESHOLD = 120

interface FlashcardBaseProps {
  card: FlashcardBaseData
  isExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  renderHeaderBadges?: () => ReactNode
  renderActions?: () => ReactNode
  isLeech?: boolean
  leechReason?: string | null
  onEditCard?: () => void
  onSuspendCard?: () => void
}

export function FlashcardBase({
  card,
  isExpanded: controlledExpanded,
  onExpandedChange,
  renderHeaderBadges,
  renderActions,
  isLeech,
  leechReason,
  onEditCard,
  onSuspendCard,
}: FlashcardBaseProps) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const isExpanded =
    controlledExpanded !== undefined ? controlledExpanded : internalExpanded
  const setIsExpanded =
    onExpandedChange !== undefined ? onExpandedChange : setInternalExpanded

  const {
    documentTitle,
    direction,
    cardType,
    cardFront,
    cardBack,
    textContent,
  } = card

  const isCloze = cardType === 'cloze'

  // Get the front and back content based on direction
  const getFrontBack = () => {
    if (isCloze) {
      // For cloze, front shows text with blanks
      const textWithBlanks =
        textContent.replace(/\{\{([^}]+)\}\}/g, '______') || ''
      return {
        front: textWithBlanks,
        back: '', // We'll render cloze back separately with highlighting
      }
    }

    // For other types, swap front/back based on direction
    if (direction === 'reverse') {
      return {
        front: cardBack || '',
        back: cardFront || '',
      }
    }

    return {
      front: cardFront || '',
      back: cardBack || '',
    }
  }

  // Render cloze text with highlighted answers
  const renderClozeAnswer = () => {
    if (!isCloze) return null

    return renderClozeText(textContent, {
      wrapperClassName: 'text-xl leading-relaxed whitespace-pre-line',
      markClassName:
        'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1 py-0.5 rounded font-medium',
    })
  }

  const { front, back } = getFrontBack()
  const questionListKind = detectListKind(front)
  const answerListKind = detectListKind(back)
  const actionsContent = renderActions?.()

  return (
    <Card className="overflow-hidden border-border/50 py-0 shadow-lg ring-1 ring-black/5 transition-all duration-300 ease-out dark:ring-white/5">
      <CardContent className="p-0">
        {/* Header with metadata */}
        <div className="flex items-center justify-between border-b border-border/50 px-8 py-4">
          <span className="max-w-50 truncate text-sm text-muted-foreground">
            {documentTitle}
          </span>
          <div className="flex items-center gap-2">
            {renderHeaderBadges?.()}
            {isLeech && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge
                    variant="outline"
                    className={cn('text-xs', LEECH_COLOR)}
                  >
                    <AlertTriangle className="mr-1 h-3 w-3" />
                    Leech
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="max-w-xs">
                    <p className="font-medium">
                      This card has been difficult. Consider rewriting it.
                    </p>
                    <p className="mt-1 text-xs">{leechReason}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
            {cardType && (
              <Badge
                variant="outline"
                className={cn('text-xs', CARD_TYPE_COLORS[cardType])}
              >
                {CARD_TYPE_LABELS[cardType]}
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
          type="button"
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
              <RenderLatexText text={front} />
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
                  back.length > LONG_ANSWER_THRESHOLD ||
                    answerListKind ||
                    isCloze
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
                    <RenderLatexText text={back} />
                  </p>
                )}
              </div>

              {/* Action buttons */}
              {actionsContent && (
                <div className="px-8 pb-8">
                  {actionsContent}
                  {/* Leech management actions */}
                  {isLeech && (onEditCard || onSuspendCard) && (
                    <div className="mt-2 space-y-2 border-t border-border/50 pt-2">
                      <p className="text-xs text-muted-foreground">
                        Try breaking this into smaller, more focused cards.
                      </p>
                      {onEditCard && (
                        <Button
                          onClick={onEditCard}
                          variant="outline"
                          className="w-full gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit Card in Document
                        </Button>
                      )}

                      {onSuspendCard && (
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={<Button variant="outline" />}
                            className="w-full gap-2"
                          >
                            <Ban className="h-4 w-4" />
                            Suspend Card
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Suspend this card?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This card will be hidden from reviews until you
                                unsuspend it. You can manage suspended cards
                                from the study overview.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={onSuspendCard}>
                                Suspend
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
