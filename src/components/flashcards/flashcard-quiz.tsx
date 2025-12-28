import { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, Shuffle } from 'lucide-react'
import { FlashcardItem } from './flashcard-item'
import { QuizResults } from './quiz-results'
import type { FlashcardWithDocument, QuizCard, QuizResult } from './types'
import type { Id } from '../../../convex/_generated/dataModel'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'

interface FlashcardQuizProps {
  documents: Array<FlashcardWithDocument>
  selectedDocIds: Set<Id<'documents'>>
  onBack: () => void
  onGoHome: () => void
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
  const allCards = useMemo(() => {
    const cards: Array<QuizCard> = []

    for (const docData of documents) {
      if (!selectedDocIds.has(docData.document._id)) continue

      for (const block of docData.flashcards) {
        // Add forward direction
        if (
          block.cardDirection === 'forward' ||
          block.cardDirection === 'bidirectional'
        ) {
          cards.push({
            block,
            documentTitle: docData.document.title || 'Untitled',
            direction: 'forward',
          })
        }

        // Add reverse direction for bidirectional cards
        if (block.cardDirection === 'bidirectional') {
          cards.push({
            block,
            documentTitle: docData.document.title || 'Untitled',
            direction: 'reverse',
          })
        }

        // Reverse-only cards
        if (block.cardDirection === 'reverse') {
          cards.push({
            block,
            documentTitle: docData.document.title || 'Untitled',
            direction: 'reverse',
          })
        }

        // Cloze cards (no direction concept)
        if (block.cardType === 'cloze') {
          cards.push({
            block,
            documentTitle: docData.document.title || 'Untitled',
            direction: 'forward',
          })
        }
      }
    }

    return cards
  }, [documents, selectedDocIds])

  const [shuffledCards, setShuffledCards] = useState<Array<QuizCard>>(() =>
    shuffleArray(allCards),
  )
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState<Array<QuizResult>>([])
  const [isComplete, setIsComplete] = useState(false)

  const currentCard = shuffledCards[currentIndex]
  const progress =
    shuffledCards.length > 0
      ? ((currentIndex + (isComplete ? 1 : 0)) / shuffledCards.length) * 100
      : 0

  const handleAnswer = useCallback(
    (knew: boolean) => {
      const result: QuizResult = {
        card: currentCard,
        knew,
      }
      setResults((prev) => [...prev, result])

      if (currentIndex < shuffledCards.length - 1) {
        setCurrentIndex((prev) => prev + 1)
      } else {
        setIsComplete(true)
      }
    },
    [currentCard, currentIndex, shuffledCards.length],
  )

  const handleRestart = useCallback(() => {
    setShuffledCards(shuffleArray(allCards))
    setCurrentIndex(0)
    setResults([])
    setIsComplete(false)
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
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No cards to study.</p>
        <Button onClick={onBack}>Go Back</Button>
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
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

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">
            {currentIndex + 1} / {shuffledCards.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Current card */}
      <FlashcardItem card={currentCard} onAnswer={handleAnswer} />

      {/* Keyboard shortcuts hint */}
      <p className="text-xs text-center text-muted-foreground">
        Click &quot;Show answer&quot; to reveal, then mark if you knew it
      </p>
    </div>
  )
}
