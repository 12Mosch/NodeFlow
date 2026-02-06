import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import * as Sentry from '@sentry/tanstackstart-react'
import { convexQuery } from '@convex-dev/react-query'
import { ArrowLeft, GraduationCap, Shuffle } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { StudyState } from './types'
import type { Id } from '../../../convex/_generated/dataModel'
import { DocumentSelector, FlashcardQuiz } from '@/components/flashcards'
import {
  AnalyticsCard,
  AnalyticsSection,
  MetricCard,
} from '@/components/analytics'
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

  const selectedDocCount = selectedDocIds.size
  const selectedCardCount = documents
    .filter((doc) => selectedDocIds.has(doc.document._id))
    .reduce((sum, doc) => sum + doc.flashcards.length, 0)

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
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
      <header className="sticky top-0 z-50 -mx-4 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Button>
            </Link>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <div className="flex min-w-0 items-center gap-2">
              <GraduationCap className="h-5 w-5 shrink-0 text-muted-foreground" />
              <h1 className="truncate text-base font-semibold sm:text-lg">
                Random Practice
              </h1>
            </div>
          </div>
          <ModeToggle />
        </div>
      </header>

      <div className="flex-1 py-6 sm:py-8">
        {studyState === 'selecting' && (
          <div className="space-y-10">
            <div className="space-y-2">
              <p className="nf-meta-label text-muted-foreground">Study Mode</p>
              <h2 className="nf-type-display text-4xl text-foreground sm:text-5xl">
                Random Practice
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Mix cards from selected documents in shuffled order for quick,
                low-friction review sessions.
              </p>
            </div>

            <AnalyticsSection
              title="Selection Snapshot"
              description="Build a mixed deck before you begin."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard
                  label="Documents available"
                  value={documents.length}
                  helper="with flashcards"
                />
                <MetricCard
                  label="Documents selected"
                  value={selectedDocCount}
                  helper="in this session"
                />
                <MetricCard
                  label="Cards queued"
                  value={selectedCardCount}
                  helper="across selection"
                />
              </div>
            </AnalyticsSection>

            <AnalyticsSection
              title="Document Queue"
              description="Choose one or more documents to generate a randomized quiz."
            >
              <DocumentSelector
                documents={documents}
                selectedDocIds={selectedDocIds}
                onSelectionChange={setSelectedDocIds}
                onStartStudy={handleStartStudy}
              />
            </AnalyticsSection>

            <AnalyticsCard muted className="px-6">
              <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                <Shuffle className="h-4 w-4" />
                Cards are shuffled once per session. Use in-quiz shuffle to
                randomize the remaining queue again.
              </div>
            </AnalyticsCard>
          </div>
        )}

        {studyState === 'studying' && (
          <div className="space-y-6">
            <AnalyticsCard muted className="px-6">
              <div className="flex flex-wrap items-center justify-between gap-3 py-1">
                <p className="text-sm text-muted-foreground">
                  Reviewing {selectedCardCount} card
                  {selectedCardCount !== 1 ? 's' : ''} from {selectedDocCount}{' '}
                  document{selectedDocCount !== 1 ? 's' : ''}.
                </p>
                <Button variant="outline" size="sm" onClick={handleBack}>
                  Back to Selection
                </Button>
              </div>
            </AnalyticsCard>
            <FlashcardQuiz
              documents={documents}
              selectedDocIds={selectedDocIds}
              onBack={handleBack}
              onGoHome={onGoHome}
            />
          </div>
        )}
      </div>
    </div>
  )
}
