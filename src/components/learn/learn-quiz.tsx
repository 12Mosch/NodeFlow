import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { convexQuery } from '@convex-dev/react-query'
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../convex/_generated/api'
import { LearnCard } from './learn-card'
import type { LearnCard as LearnCardType, Rating } from './types'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface LearnQuizProps {
  onBack: () => void
  onGoHome: () => void
}

export function LearnQuiz({ onBack, onGoHome }: LearnQuizProps) {
  const {
    data: sessionCards,
    isLoading,
    refetch,
  } = useQuery(convexQuery(api.cardStates.getLearnSession, {}))

  const reviewCardMutation = useMutation(api.cardStates.reviewCard)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [isReviewing, setIsReviewing] = useState(false)
  const [activeRating, setActiveRating] = useState<Rating | null>(null)
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cards = (sessionCards ?? []) as Array<LearnCardType>
  const currentCard = cards[currentIndex] as LearnCardType | undefined
  const totalCards = cards.length

  const isComplete = currentIndex >= totalCards && totalCards > 0

  // Handle rating submission
  const handleRate = useCallback(
    async (rating: Rating) => {
      if (!currentCard || isReviewing) return

      setIsReviewing(true)
      try {
        try {
          await reviewCardMutation({
            cardStateId: currentCard.cardState._id,
            rating,
          })
        } catch (error) {
          console.error('Failed to review card:', error)
          toast.error('Failed to save your rating. Please try again.')
          return
        }

        setReviewedCount((prev) => prev + 1)
        setIsExpanded(false)

        // If rating is "Again", the card will be re-queued
        // We need to refetch to get updated card list
        if (rating === 1) {
          // Await refetch to ensure UI updates with fresh data before allowing next interaction
          // This prevents race conditions where the UI might show stale data if user interacts quickly
          const result = await refetch()
          if (result.error) {
            console.error('Failed to refetch cards:', result.error)
            toast.error('Failed to refresh cards. Please try again.')
            return
          }
          // Stay on current index since new cards were fetched
        } else {
          // Move to next card
          setCurrentIndex((prev) => prev + 1)
        }
      } finally {
        setIsReviewing(false)
      }
    },
    // Convex's useMutation returns a function; this rule is aimed at TanStack Query results.
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
    [currentCard, isReviewing, reviewCardMutation, refetch],
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

      // Helper to flash button and then rate
      const flashAndRate = (rating: Rating) => {
        // Clear any pending flash timeout to prevent stale ratings from firing
        if (flashTimeoutRef.current !== null) {
          clearTimeout(flashTimeoutRef.current)
          flashTimeoutRef.current = null
        }
        // Reset before applying new flash to ensure clean state
        setActiveRating(null)
        setActiveRating(rating)
        // Show flash for 200ms before triggering action (loading overlay would hide it)
        flashTimeoutRef.current = setTimeout(() => {
          flashTimeoutRef.current = null
          setActiveRating(null)
          handleRate(rating)
        }, 200)
      }

      switch (event.key) {
        case ' ': // Space to toggle answer
          event.preventDefault()
          setIsExpanded((prev) => !prev)
          break
        case '1': // Again
          if (isExpanded && !isReviewing) {
            event.preventDefault()
            flashAndRate(1)
          }
          break
        case '2': // Hard
          if (isExpanded && !isReviewing) {
            event.preventDefault()
            flashAndRate(2)
          }
          break
        case '3': // Good
          if (isExpanded && !isReviewing) {
            event.preventDefault()
            flashAndRate(3)
          }
          break
        case '4': // Easy
          if (isExpanded && !isReviewing) {
            event.preventDefault()
            flashAndRate(4)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Clear any pending flash timeout on cleanup
      if (flashTimeoutRef.current !== null) {
        clearTimeout(flashTimeoutRef.current)
        flashTimeoutRef.current = null
      }
    }
  }, [isComplete, isExpanded, isReviewing, handleRate, currentCard])

  // Loading state
  if (isLoading) {
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
    <div className="space-y-6">
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
        activeRating={activeRating}
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

      {/* Loading overlay while reviewing */}
      {isReviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}
    </div>
  )
}
