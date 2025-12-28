import { Suspense, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { ArrowLeft, GraduationCap } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { QuizState } from '@/components/flashcards'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { DocumentSelector, FlashcardQuiz } from '@/components/flashcards'

export const Route = createFileRoute('/study')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.blocks.listAllFlashcards, {}),
    )
  },
  component: StudyPage,
})

function StudyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense
        fallback={
          <div className="p-8 text-muted-foreground">Loading flashcards...</div>
        }
      >
        <StudyContent />
      </Suspense>
    </div>
  )
}

function StudyContent() {
  const { data: flashcardData } = useSuspenseQuery(
    convexQuery(api.blocks.listAllFlashcards, {}),
  )

  const navigate = useNavigate()
  const [quizState, setQuizState] = useState<QuizState>('selecting')
  const [selectedDocIds, setSelectedDocIds] = useState<Set<Id<'documents'>>>(
    new Set(),
  )

  const documents = flashcardData

  const handleStartStudy = () => {
    if (selectedDocIds.size > 0) {
      setQuizState('studying')
    }
  }

  const handleBack = () => {
    setQuizState('selecting')
  }

  const handleGoHome = () => {
    navigate({ to: '/' })
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Button>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-muted-foreground" />
              <h1 className="font-semibold">Study Flashcards</h1>
            </div>
          </div>
          <ModeToggle />
        </div>
      </header>

      {/* Content */}
      <div className="p-8">
        {quizState === 'selecting' && (
          <DocumentSelector
            documents={documents}
            selectedDocIds={selectedDocIds}
            onSelectionChange={setSelectedDocIds}
            onStartStudy={handleStartStudy}
          />
        )}

        {quizState === 'studying' && (
          <FlashcardQuiz
            documents={documents}
            selectedDocIds={selectedDocIds}
            onBack={handleBack}
            onGoHome={handleGoHome}
          />
        )}
      </div>
    </div>
  )
}
