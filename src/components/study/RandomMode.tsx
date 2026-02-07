import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import * as Sentry from '@sentry/tanstackstart-react'
import { convexQuery } from '@convex-dev/react-query'
import { ArrowLeft, GraduationCap, Shuffle } from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { StudyState } from './types'
import type { Id } from '../../../convex/_generated/dataModel'
import {
  DocumentSelector,
  FlashcardQuiz,
  computeExpandedCardCount,
} from '@/components/flashcards'
import {
  ActionSuggestionCard,
  AnalyticsCard,
  AnalyticsSection,
  MetricCard,
} from '@/components/analytics'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { pluralize } from '@/lib/pluralize'

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
  const selectedCardCount = useMemo(
    () => computeExpandedCardCount(documents, selectedDocIds),
    [documents, selectedDocIds],
  )
  const selectedCardLabel = pluralize(selectedCardCount, 'card')
  const selectedDocumentLabel = pluralize(selectedDocCount, 'document')
  const selectionSuggestion = useMemo(() => {
    if (selectedDocCount === 0) {
      return 'Select at least one document, then run a short 5-minute random round to warm up.'
    }
    if (selectedDocCount > 0 && selectedCardCount === 0) {
      return 'Your selected documents do not contain flashcards yet. Pick different documents or add cards before starting.'
    }
    if (selectedCardCount > 80) {
      return 'Large random queues can hide weak cards. Split this into smaller sets, or switch to Spaced Repetition for better long-term scheduling.'
    }
    if (selectedCardCount <= 12) {
      return 'This is a fast checkpoint set. Run it now, then immediately rewrite any cards you miss.'
    }
    return 'Start this mixed deck now. If your accuracy drops below 70% in results, switch to Spaced Repetition for targeted recovery.'
  }, [selectedCardCount, selectedDocCount])

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
              <ActionSuggestionCard>{selectionSuggestion}</ActionSuggestionCard>
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
                  Reviewing {selectedCardCount} {selectedCardLabel} from{' '}
                  {selectedDocCount} {selectedDocumentLabel}.
                </p>
                <Button variant="outline" size="sm" onClick={handleBack}>
                  Back to Selection
                </Button>
              </div>
            </AnalyticsCard>
            <ActionSuggestionCard tone="success">
              Keep random sessions short. After this run, move missed cards into
              a spaced repetition session to lock in retention.
            </ActionSuggestionCard>
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
