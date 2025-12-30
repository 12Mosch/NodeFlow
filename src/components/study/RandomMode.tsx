import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import * as Sentry from '@sentry/tanstackstart-react'
import { convexQuery } from '@convex-dev/react-query'
import { ArrowLeft, GraduationCap } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { StudyState } from './types'
import type { Id } from '../../../convex/_generated/dataModel'
import { DocumentSelector, FlashcardQuiz } from '@/components/flashcards'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'

interface RandomModeProps {
  studyState: StudyState
  setStudyState: (state: StudyState) => void
  onGoHome: () => void
}

export function RandomMode({
  studyState,
  setStudyState,
  onGoHome,
}: RandomModeProps) {
  const { data: flashcardData } = useSuspenseQuery(
    convexQuery(api.blocks.listAllFlashcards, {}),
  )

  const [selectedDocIds, setSelectedDocIds] = useState<Set<Id<'documents'>>>(
    new Set(),
  )

  const documents = flashcardData

  const handleStartStudy = () => {
    if (selectedDocIds.size > 0) {
      Sentry.startSpan(
        { name: 'RandomMode.startStudy', op: 'ui.interaction' },
        () => {
          setStudyState('studying')
        },
      )
    }
  }

  const handleBack = () => {
    setStudyState('selecting')
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
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
              <h1 className="font-semibold">Random Practice</h1>
            </div>
          </div>
          <ModeToggle />
        </div>
      </header>

      {/* Content */}
      <div className="p-8">
        {studyState === 'selecting' && (
          <DocumentSelector
            documents={documents}
            selectedDocIds={selectedDocIds}
            onSelectionChange={setSelectedDocIds}
            onStartStudy={handleStartStudy}
          />
        )}

        {studyState === 'studying' && (
          <FlashcardQuiz
            documents={documents}
            selectedDocIds={selectedDocIds}
            onBack={handleBack}
            onGoHome={onGoHome}
          />
        )}
      </div>
    </div>
  )
}
