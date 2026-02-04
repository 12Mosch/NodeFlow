import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { convexQuery } from '@convex-dev/react-query'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import { LearnCard } from './learn/learn-card'
import { SessionComplete } from './learn/session-complete'
import { calculateSuccessRate } from './learn/types'
import type { Id } from '../../convex/_generated/dataModel'
import type { LearnCard as LearnCardType, Rating } from './learn/types'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface DocumentLearnQuizProps {
  documentId: Id<'documents'>
  onBack: () => void
  onGoHome: () => void
}

type CardStateSnapshot = Pick<
  LearnCardType['cardState'],
  | 'stability'
  | 'difficulty'
  | 'due'
  | 'lastReview'
  | 'reps'
  | 'lapses'
  | 'state'
  | 'scheduledDays'
  | 'elapsedDays'
>

type UndoSnapshot = {
  cards: Array<LearnCardType>
  currentIndex: number
  reviewedCount: number
  againCount: number
  ratedAtIndex: number | null
  isExpanded: boolean
}

type LastRating = {
  id: number
  cardStateId: LearnCardType['cardState']['_id']
  previousState: CardStateSnapshot
  reviewLogId: Id<'reviewLogs'> | null
  snapshot: UndoSnapshot
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
  const undoReviewMutation = useMutation(api.cardStates.undoReview)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [againCount, setAgainCount] = useState(0)
  // Track the index at which we last rated - if it matches currentIndex, we can't rate again
  const [ratedAtIndex, setRatedAtIndex] = useState<number | null>(null)
  const [lastRating, setLastRating] = useState<LastRating | null>(null)
  const [undoVisible, setUndoVisible] = useState(false)
  const undoFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRatingIdRef = useRef(0)
  const pendingReviewRef = useRef<{
    id: number
    promise: Promise<{ reviewLogId: Id<'reviewLogs'> | null }>
  } | null>(null)
  const refetchTokenRef = useRef(0)

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

  const cards = useMemo(() => stableCards ?? [], [stableCards])
  const currentCard = cards[currentIndex] as LearnCardType | undefined
  const totalCards = cards.length

  const isComplete = currentIndex >= totalCards && totalCards > 0

  const successRate = calculateSuccessRate(reviewedCount, againCount)

  const scheduleUndoFade = useCallback(() => {
    setUndoVisible(true)
    if (undoFadeTimeoutRef.current !== null) {
      clearTimeout(undoFadeTimeoutRef.current)
    }
    undoFadeTimeoutRef.current = setTimeout(() => {
      undoFadeTimeoutRef.current = null
      setUndoVisible(false)
    }, 3000)
  }, [])

  const handleUndo = useCallback(() => {
    if (!lastRating) return

    const ratingToUndo = lastRating

    refetchTokenRef.current += 1
    if (undoFadeTimeoutRef.current !== null) {
      clearTimeout(undoFadeTimeoutRef.current)
      undoFadeTimeoutRef.current = null
    }

    setUndoVisible(false)
    setLastRating(null)
    setStableCards(ratingToUndo.snapshot.cards)
    setCurrentIndex(ratingToUndo.snapshot.currentIndex)
    setReviewedCount(ratingToUndo.snapshot.reviewedCount)
    setAgainCount(ratingToUndo.snapshot.againCount)
    setRatedAtIndex(ratingToUndo.snapshot.ratedAtIndex)
    setIsExpanded(ratingToUndo.snapshot.isExpanded)

    const finishUndo = (reviewLogId?: Id<'reviewLogs'> | null) => {
      undoReviewMutation({
        cardStateId: ratingToUndo.cardStateId,
        previousState: ratingToUndo.previousState,
        reviewLogId: reviewLogId ?? ratingToUndo.reviewLogId ?? undefined,
      }).catch((error) => {
        console.error('Failed to undo review:', error)
        toast.error('Failed to undo rating. Check your connection.')
      })
    }

    const pendingReview = pendingReviewRef.current
    if (pendingReview?.id === ratingToUndo.id) {
      pendingReview.promise
        .then((result) => {
          finishUndo(result.reviewLogId ?? ratingToUndo.reviewLogId)
        })
        .catch(() => {
          finishUndo(ratingToUndo.reviewLogId)
        })
        .finally(() => {
          if (pendingReviewRef.current?.id === ratingToUndo.id) {
            pendingReviewRef.current = null
          }
        })
    } else {
      finishUndo(ratingToUndo.reviewLogId)
    }
  }, [lastRating, undoReviewMutation])

  // Handle rating submission
  const handleRate = useCallback(
    (rating: Rating) => {
      if (!currentCard || ratedCurrentCard) return

      const cardStateId = currentCard.cardState._id
      const ratingId = (lastRatingIdRef.current += 1)
      const snapshot: UndoSnapshot = {
        cards,
        currentIndex,
        reviewedCount,
        againCount,
        ratedAtIndex,
        isExpanded,
      }
      const previousState: CardStateSnapshot = {
        stability: currentCard.cardState.stability,
        difficulty: currentCard.cardState.difficulty,
        due: currentCard.cardState.due,
        lastReview: currentCard.cardState.lastReview,
        reps: currentCard.cardState.reps,
        lapses: currentCard.cardState.lapses,
        state: currentCard.cardState.state,
        scheduledDays: currentCard.cardState.scheduledDays,
        elapsedDays: currentCard.cardState.elapsedDays,
      }

      setLastRating({
        id: ratingId,
        cardStateId,
        previousState,
        reviewLogId: null,
        snapshot,
      })
      scheduleUndoFade()

      // Mark current index as rated (prevents double-rating via rapid clicks)
      setRatedAtIndex(currentIndex)
      setReviewedCount((prev) => prev + 1)
      setIsExpanded(false)

      // Fire mutation without awaiting
      const reviewPromise = reviewCardMutation({ cardStateId, rating })
        .then((result) => {
          const reviewLogId = result.reviewLogId
          setLastRating((prev) =>
            prev?.id === ratingId ? { ...prev, reviewLogId } : prev,
          )
          return { reviewLogId }
        })
        .catch((error) => {
          console.error('Failed to review card:', error)
          toast.error('Rating may not have been saved. Check your connection.')
          return { reviewLogId: null }
        })

      pendingReviewRef.current = { id: ratingId, promise: reviewPromise }

      // Advance immediately for all ratings
      if (rating === 1) {
        setAgainCount((prev) => prev + 1)
        // For "Again", refetch in background to requeue card at the end
        const refetchToken = (refetchTokenRef.current += 1)
        refetch()
          .then((result) => {
            if (refetchTokenRef.current !== refetchToken) return
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
    [
      againCount,
      cards,
      currentCard,
      currentIndex,
      isExpanded,
      ratedAtIndex,
      ratedCurrentCard,
      refetch,
      reviewCardMutation,
      reviewedCount,
      scheduleUndoFade,
    ],
  )

  // Keyboard shortcuts
  useEffect(() => {
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

      const key = event.key.toLowerCase()
      const isUndo =
        (key === 'z' && (event.metaKey || event.ctrlKey)) || key === 'u'
      if (isUndo) {
        if (lastRating) {
          event.preventDefault()
          handleUndo()
        }
        return
      }

      if (isComplete || currentCard === undefined) return

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
  }, [
    currentCard,
    handleRate,
    handleUndo,
    isComplete,
    isExpanded,
    lastRating,
    ratedCurrentCard,
  ])

  useEffect(() => {
    return () => {
      if (undoFadeTimeoutRef.current !== null) {
        clearTimeout(undoFadeTimeoutRef.current)
        undoFadeTimeoutRef.current = null
      }
    }
  }, [])

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
      <SessionComplete
        reviewedCount={reviewedCount}
        successRate={successRate}
        onBack={onBack}
        onGoHome={onGoHome}
      />
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
        <div className="flex items-center gap-3">
          {lastRating && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUndo}
              className={`gap-2 transition-opacity duration-300 ${
                undoVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              <Undo2 className="h-4 w-4" />
              Undo
            </Button>
          )}
          <div className="text-sm text-muted-foreground">
            Reviewed: {reviewedCount}
          </div>
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
        to rate. Undo:{' '}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
          U
        </kbd>{' '}
        or{' '}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
          Ctrl
        </kbd>
        /
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
          Cmd
        </kbd>
        +
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
          Z
        </kbd>
      </p>
    </div>
  )
}
