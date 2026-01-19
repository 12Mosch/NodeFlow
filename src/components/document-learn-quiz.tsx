import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { convexQuery } from '@convex-dev/react-query'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import { LearnCard } from './learn/learn-card'
import type { Id } from '../../convex/_generated/dataModel'
import type { LearnCard as LearnCardType, Rating } from './learn/types'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface DocumentLearnQuizProps {
  documentId: Id<'documents'>
  onBack: () => void
  onGoHome: () => void
}

export function DocumentLearnQuiz({
  documentId,
  onBack,
  onGoHome,
}: DocumentLearnQuizProps) {
  const {
    data: sessionCards,
    isLoading,
    isError,
    refetch,
  } = useQuery(
    convexQuery(api.cardStates.getDocumentLearnSession, { documentId }),
  )

  const reviewCardMutation = useMutation(api.cardStates.reviewCard)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)
  // Track the index at which we last rated - if it matches currentIndex, we can't rate again
  const [ratedAtIndex, setRatedAtIndex] = useState<number | null>(null)

  // Derived state: can't rate if we already rated at this index
  const ratedCurrentCard = ratedAtIndex === currentIndex

  // Store cards in local state to prevent Convex subscription updates from
  // causing double-advances (subscription removes reviewed card + we increment index)
  const [stableCards, setStableCards] = useState<Array<LearnCardType> | null>(
    null,
  )
  const hasInitializedRef = useRef(false)

  // Initialize stable cards on first load - intentional one-time sync from async data
  // Also handle the case where loading completes with no data (error or empty)
  useEffect(() => {
    if (hasInitializedRef.current) return

    if (sessionCards) {
      hasInitializedRef.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time initialization
      setStableCards(sessionCards as Array<LearnCardType>)
    } else if (!isLoading) {
      // Loading finished but no data (error or undefined) - treat as empty
      hasInitializedRef.current = true

      setStableCards([])
    }
  }, [sessionCards, isLoading])

  const cards = stableCards ?? []
  const currentCard = cards[currentIndex] as LearnCardType | undefined
  const totalCards = cards.length

  const isComplete = currentIndex >= totalCards && totalCards > 0

  // Handle rating submission
  const handleRate = useCallback(
    (rating: Rating) => {
      if (!currentCard || ratedCurrentCard) return

      const cardStateId = currentCard.cardState._id

      // Mark current index as rated (prevents double-rating via rapid clicks)
      setRatedAtIndex(currentIndex)
      setReviewedCount((prev) => prev + 1)
      setIsExpanded(false)

      // Fire mutation without awaiting
      reviewCardMutation({ cardStateId, rating }).catch((error) => {
        console.error('Failed to review card:', error)
        toast.error('Rating may not have been saved. Check your connection.')
      })

      // Advance immediately for all ratings
      if (rating === 1) {
        // For "Again", refetch in background to requeue card at the end
        refetch()
          .then((result) => {
            if (result.data) {
              setStableCards(result.data as Array<LearnCardType>)
            }
          })
          .catch((error) => {
            console.error('Failed to refetch cards:', error)
            toast.error('Failed to refresh cards. Check your connection.')
          })
      }
      setCurrentIndex((prev) => prev + 1)
    },
    // Convex's useMutation returns a function; this rule is aimed at TanStack Query results.
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
    [currentCard, ratedCurrentCard, currentIndex, reviewCardMutation, refetch],
  )

  // Keyboard shortcuts
  useEffect(() => {
    if (isComplete || currentCard === undefined) return

    function handleKeyDown(event: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      switch (event.key) {
        case ' ': // Space to toggle answer
          event.preventDefault()
          setIsExpanded((prev) => !prev)
          break
        case '1': // Again
          if (isExpanded && !ratedCurrentCard) {
            event.preventDefault()
            handleRate(1)
          }
          break
        case '2': // Hard
          if (isExpanded && !ratedCurrentCard) {
            event.preventDefault()
            handleRate(2)
          }
          break
        case '3': // Good
          if (isExpanded && !ratedCurrentCard) {
            event.preventDefault()
            handleRate(3)
          }
          break
        case '4': // Easy
          if (isExpanded && !ratedCurrentCard) {
            event.preventDefault()
            handleRate(4)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isComplete, isExpanded, ratedCurrentCard, handleRate, currentCard])

  // Error state
  if (isError) {
    return (
      <div className="py-12 text-center">
        <AlertCircle className="mx-auto h-16 w-16 text-destructive" />
        <h2 className="mt-4 text-2xl font-bold">Failed to load cards</h2>
        <p className="mt-2 text-muted-foreground">
          Something went wrong while loading your cards.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
          <Button onClick={onGoHome}>Go Home</Button>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading || stableCards === null) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading cards...</p>
      </div>
    )
  }

  // No cards to review
  if (totalCards === 0) {
    return (
      <div className="py-12 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
        <h2 className="mt-4 text-2xl font-bold">All caught up!</h2>
        <p className="mt-2 text-muted-foreground">
          You have no cards due for review right now.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={onBack} variant="outline">
            Go Back
          </Button>
          <Button onClick={onGoHome}>Go Home</Button>
        </div>
      </div>
    )
  }

  // Session complete
  if (isComplete) {
    return (
      <div className="py-12 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
        <h2 className="mt-4 text-2xl font-bold">Session Complete!</h2>
        <p className="mt-2 text-muted-foreground">
          You reviewed {reviewedCount} card{reviewedCount !== 1 ? 's' : ''} in
          this session.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={onBack} variant="outline">
            Start New Session
          </Button>
          <Button onClick={onGoHome}>Go Home</Button>
        </div>
      </div>
    )
  }

  // At this point, currentCard is guaranteed to exist
  if (!currentCard) {
    return null
  }

  const progress = (currentIndex / totalCards) * 100

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="text-sm text-muted-foreground">
          Reviewed: {reviewedCount}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">
            {currentIndex + 1} / {totalCards}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Current card */}
      <LearnCard
        card={currentCard}
        onRate={handleRate}
        isExpanded={isExpanded}
        onExpandedChange={setIsExpanded}
      />

      {/* Keyboard shortcuts hint */}
      <p className="text-center text-xs text-muted-foreground">
        Press{' '}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
          Space
        </kbd>{' '}
        to reveal, then{' '}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
          1
        </kbd>
        -
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
          4
        </kbd>{' '}
        to rate
      </p>
    </div>
  )
}
