import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Shuffle, Undo2 } from 'lucide-react'
import { FlashcardItem } from './flashcard-item'
import { QuizResults } from './quiz-results'
import { expandCardsForQuiz } from './quiz-card-expansion'
import type { FlashcardWithDocument, QuizCard, QuizResult } from './types'
import type { Id } from '../../../convex/_generated/dataModel'
import { AnalyticsCard } from '@/components/analytics'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'

interface FlashcardQuizProps {
  documents: Array<FlashcardWithDocument>
  selectedDocIds: Set<Id<'documents'>>
  onBack: () => void
  onGoHome: () => void
}

type UndoSnapshot = {
  shuffledCards: Array<QuizCard>
  currentIndex: number
  results: Array<QuizResult>
  isComplete: boolean
  isExpanded: boolean
}

// Fisher-Yates shuffle
function shuffleArray<T>(array: Array<T>): Array<T> {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function FlashcardQuiz({
  documents,
  selectedDocIds,
  onBack,
  onGoHome,
}: FlashcardQuizProps) {
  // Build the cards list from selected documents
  const allCards = useMemo(
    () => expandCardsForQuiz(documents, selectedDocIds),
    [documents, selectedDocIds],
  )

  const [shuffledCards, setShuffledCards] = useState<Array<QuizCard>>(() =>
    shuffleArray(allCards),
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<Array<QuizResult>>([])
  const [isComplete, setIsComplete] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [lastAnswer, setLastAnswer] = useState<UndoSnapshot | null>(null)
  const [undoVisible, setUndoVisible] = useState(false)
  const undoFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [answeredAtIndex, setAnsweredAtIndex] = useState<number | null>(null)
  const answeredAtIndexRef = useRef<number | null>(null)

  const currentCard = shuffledCards[currentIndex]
  const progress =
    shuffledCards.length > 0
      ? ((currentIndex + (isComplete ? 1 : 0)) / shuffledCards.length) * 100
      : 0
  const answeredCurrentCard = answeredAtIndex === currentIndex
  const canAnswer = isExpanded && !answeredCurrentCard

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

  const handleAnswer = useCallback(
    (knew: boolean) => {
      if (!isExpanded) return
      if (answeredAtIndexRef.current === currentIndex) return

      answeredAtIndexRef.current = currentIndex
      setAnsweredAtIndex(currentIndex)

      const snapshot: UndoSnapshot = {
        shuffledCards,
        currentIndex,
        results,
        isComplete,
        isExpanded,
      }
      setLastAnswer(snapshot)
      scheduleUndoFade()

      const result: QuizResult = {
        card: currentCard,
        knew,
      }
      setResults((prev) => [...prev, result])

      if (currentIndex < shuffledCards.length - 1) {
        setCurrentIndex((prev) => prev + 1)
        setIsExpanded(false) // Reset expanded state for next card
      } else {
        setIsComplete(true)
      }
    },
    [
      currentCard,
      currentIndex,
      isComplete,
      isExpanded,
      results,
      scheduleUndoFade,
      shuffledCards,
    ],
  )

  const handleUndo = useCallback(() => {
    if (!lastAnswer) return

    if (undoFadeTimeoutRef.current !== null) {
      clearTimeout(undoFadeTimeoutRef.current)
      undoFadeTimeoutRef.current = null
    }

    setUndoVisible(false)
    setShuffledCards(lastAnswer.shuffledCards)
    setCurrentIndex(lastAnswer.currentIndex)
    setResults(lastAnswer.results)
    setIsComplete(lastAnswer.isComplete)
    setIsExpanded(lastAnswer.isExpanded)
    setAnsweredAtIndex(null)
    answeredAtIndexRef.current = null
    setLastAnswer(null)
  }, [lastAnswer])

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
        if (lastAnswer) {
          event.preventDefault()
          handleUndo()
        }
        return
      }

      if (isComplete) return

      switch (event.key) {
        case ' ': // Space to toggle answer
          event.preventDefault()
          setIsExpanded((prev) => !prev)
          break
        case '1': // Didn't know
          if (canAnswer) {
            event.preventDefault()
            handleAnswer(false)
          }
          break
        case '2': // Knew it
          if (canAnswer) {
            event.preventDefault()
            handleAnswer(true)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [canAnswer, handleAnswer, handleUndo, isComplete, lastAnswer])

  useEffect(() => {
    return () => {
      if (undoFadeTimeoutRef.current !== null) {
        clearTimeout(undoFadeTimeoutRef.current)
        undoFadeTimeoutRef.current = null
      }
    }
  }, [])

  const handleRestart = useCallback(() => {
    setShuffledCards(shuffleArray(allCards))
    setCurrentIndex(0)
    setResults([])
    setIsComplete(false)
    setIsExpanded(false)
    setAnsweredAtIndex(null)
    answeredAtIndexRef.current = null
    setLastAnswer(null)
    setUndoVisible(false)
    if (undoFadeTimeoutRef.current !== null) {
      clearTimeout(undoFadeTimeoutRef.current)
      undoFadeTimeoutRef.current = null
    }
  }, [allCards])

  const handleShuffle = useCallback(() => {
    // Reshuffle remaining cards
    const remaining = shuffledCards.slice(currentIndex)
    const shuffledRemaining = shuffleArray(remaining)
    setShuffledCards([
      ...shuffledCards.slice(0, currentIndex),
      ...shuffledRemaining,
    ])
  }, [shuffledCards, currentIndex])

  if (shuffledCards.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl py-8">
        <AnalyticsCard className="px-6">
          <div className="py-10 text-center">
            <p className="mb-4 text-muted-foreground">No cards to study.</p>
            <Button onClick={onBack}>Go Back</Button>
          </div>
        </AnalyticsCard>
      </div>
    )
  }

  if (isComplete) {
    return (
      <QuizResults
        results={results}
        onRestart={handleRestart}
        onSelectNew={onBack}
        onGoHome={onGoHome}
      />
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {currentIndex + 1} / {shuffledCards.length}
            </span>
            {lastAnswer && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                aria-hidden={!undoVisible}
                tabIndex={undoVisible ? undefined : -1}
                className={cn(
                  'gap-2 transition-opacity duration-300',
                  undoVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
                )}
              >
                <Undo2 className="h-4 w-4" />
                Undo
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShuffle}
              className="gap-2"
              title="Shuffle remaining cards"
            >
              <Shuffle className="h-4 w-4" />
              Shuffle
            </Button>
          </div>
        </div>

        <Progress value={progress} className="h-2" />
      </div>

      <FlashcardItem
        card={currentCard}
        onAnswer={handleAnswer}
        isExpanded={isExpanded}
        onExpandedChange={setIsExpanded}
      />

      <p className="text-center text-xs text-muted-foreground">
        <Kbd>Space</Kbd> {isExpanded ? 'hide answer' : 'reveal answer'}
        {canAnswer && (
          <>
            , <Kbd>1</Kbd> or <Kbd>2</Kbd> answer
          </>
        )}
        {lastAnswer && (
          <>
            , <Kbd>U</Kbd> undo (<Kbd>Ctrl</Kbd>/<Kbd>Cmd</Kbd>+<Kbd>Z</Kbd>)
          </>
        )}
        .
      </p>
    </div>
  )
}
