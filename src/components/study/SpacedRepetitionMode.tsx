import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { Link } from '@tanstack/react-router'
import { usePostHog } from '@posthog/react'
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Brain,
  CheckCircle2,
  Settings,
} from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { StudyState } from './types'
import { LearnQuiz } from '@/components/learn'
import { ExamOverviewMetrics } from '@/components/study/ExamOverviewMetrics'
import {
  ActionSuggestionCard,
  AnalyticsCard,
  AnalyticsSection,
  MetricCard,
} from '@/components/analytics'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { Progress } from '@/components/ui/progress'
import { pluralize } from '@/lib/pluralize'

interface SpacedRepetitionModeProps {
  studyState: StudyState
  setStudyState: (state: StudyState) => void
  onGoHome: () => void
}

function hasCapture(value: unknown): value is {
  capture: (event: string, properties?: Record<string, unknown>) => void
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    'capture' in value &&
    typeof value.capture === 'function'
  )
}

export function SpacedRepetitionMode({
  studyState,
  setStudyState,
  onGoHome,
}: SpacedRepetitionModeProps) {
  const posthog = usePostHog()
  const { data: stats } = useSuspenseQuery(
    convexQuery(api.cardStates.getStats, {}),
  )
  const { data: sessionCards } = useSuspenseQuery(
    convexQuery(api.cardStates.getLearnSession, {}),
  )
  const { data: leechStats } = useSuspenseQuery(
    convexQuery(api.cardStates.getLeechStats, {}),
  )
  const { data: examTotals } = useSuspenseQuery(
    convexQuery(api.exams.getStudyOverviewTotals, {}),
  )
  if (!stats || !sessionCards || !leechStats) return null
  const dueCards = sessionCards.filter((c) => c.cardState.state !== 'new')
  const newCards = sessionCards.filter((c) => c.cardState.state === 'new')
  const examPriorityCards = sessionCards.filter((c) => c.examPriority).length
  const totalDue = dueCards.length + newCards.length
  const handleStartLearning = () => {
    if (hasCapture(posthog as unknown)) {
      posthog.capture('study_start_learning_clicked', {
        mode: 'spaced-repetition',
        due_count: dueCards.length,
        new_count: newCards.length,
        total_due: totalDue,
      })
    }
    setStudyState('studying')
  }
  const handleBack = () => {
    setStudyState('overview')
  }
  const leechCardLabel = pluralize(leechStats.totalLeeches, 'card')
  const leechQueueLabel = pluralize(leechStats.totalLeeches, 'leech card')
  const leechVerb = pluralize(leechStats.totalLeeches, 'is', 'are')
  const reviewLabel = pluralize(dueCards.length, 'review')
  const examPriorityLabel = pluralize(examPriorityCards, 'card')
  const examPriorityVerb = pluralize(examPriorityCards, 'needs', 'need')
  const readiness =
    totalDue > 0
      ? Math.min(
          100,
          Math.max(0, Math.round((stats.reviewedToday / totalDue) * 100)),
        )
      : 0
  const sessionSuggestion =
    stats.retentionRate === null
      ? 'No reviews yet, retention is unknown. Start with due cards and calibrate before scaling up new cards.'
      : stats.retentionRate < 75
        ? `Today's retention is ${stats.retentionRate}%. Prioritize due cards first and reduce new cards until retention recovers.`
        : stats.dueNow > Math.max(20, stats.newCards * 2)
          ? `Due load is building (${stats.dueNow} due now). Clear reviews before introducing more new cards.`
          : "You're in a healthy range. Keep honest ratings and finish today's due cards to maintain momentum."
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
      <header className="sticky top-0 z-50 -mx-4 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="gap-2">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Link>
            </Button>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <div className="flex min-w-0 items-center gap-2">
              <Brain className="h-5 w-5 shrink-0 text-muted-foreground" />
              <h1 className="truncate text-base font-semibold sm:text-lg">
                Spaced Repetition
              </h1>
            </div>
          </div>
          <ModeToggle />
        </div>
      </header>

      <div className="flex-1 py-6 sm:py-8">
        {studyState === 'overview' && (
          <div className="space-y-10">
            <div className="space-y-2">
              <p className="nf-meta-label text-muted-foreground">Study Mode</p>
              <h2 className="nf-type-display text-4xl text-foreground sm:text-5xl">
                Spaced Repetition
              </h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Review cards at optimized intervals with FSRS to improve
                long-term recall.
              </p>
            </div>

            <AnalyticsSection
              title="Session Snapshot"
              description="Due cards, new introductions, and today's retention in one view."
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Due now"
                  value={stats.dueNow}
                  helper="cards need review"
                />
                <MetricCard
                  label="New cards"
                  value={stats.newCards}
                  helper="cards to introduce"
                />
                <MetricCard
                  label="Reviewed today"
                  value={stats.reviewedToday}
                  helper="completed reviews"
                />
                <MetricCard
                  label="Retention"
                  value={
                    stats.retentionRate !== null
                      ? `${stats.retentionRate}%`
                      : '—'
                  }
                  helper="today's accuracy"
                />
              </div>
              <ActionSuggestionCard>{sessionSuggestion}</ActionSuggestionCard>
            </AnalyticsSection>

            <ExamOverviewMetrics
              activeExamCount={examTotals.activeExamCount}
              nextExamAt={examTotals.nextExamAt}
              nextExamTitle={examTotals.nextExamTitle}
              examPriorityCards={examPriorityCards}
            />

            {leechStats.totalLeeches > 0 && (
              <AnalyticsSection
                title="Leech Alert"
                description="Cards with repeated lapses can be isolated for focused cleanup."
              >
                <AnalyticsCard className="px-6">
                  <div className="flex flex-col gap-4 py-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="nf-meta-label text-amber-600 dark:text-amber-400">
                          Attention
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {leechStats.totalLeeches} {leechCardLabel} {leechVerb}{' '}
                        showing elevated difficulty.
                      </p>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      className="shrink-0 gap-2"
                    >
                      <Link to="/study-leeches">
                        <Settings className="h-4 w-4" />
                        Manage Leech Cards
                      </Link>
                    </Button>
                  </div>
                </AnalyticsCard>
                <ActionSuggestionCard tone="warning">
                  {leechStats.totalLeeches} {leechQueueLabel} {leechVerb}{' '}
                  generating repeated misses. Rewrite the hardest ones before
                  adding new material.
                </ActionSuggestionCard>
              </AnalyticsSection>
            )}

            <AnalyticsSection
              title="Today's Session"
              description="Launch the queue when you're ready, or return to documents."
            >
              <AnalyticsCard className="px-6">
                <div className="space-y-4 py-1">
                  {totalDue > 0 ? (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">
                            {dueCards.length} {reviewLabel}, {newCards.length}{' '}
                            new
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {totalDue} total cards in this session.
                          </p>
                        </div>
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                      </div>

                      <div className="space-y-2">
                        <div className="nf-meta-label flex justify-between text-muted-foreground">
                          <span>Queue readiness</span>
                          <span>{readiness}%</span>
                        </div>
                        <Progress value={readiness} className="h-2" />
                      </div>

                      <Button
                        size="lg"
                        className="w-full gap-2 sm:w-auto"
                        onClick={handleStartLearning}
                      >
                        <Brain className="h-5 w-5" />
                        Start Learning
                      </Button>
                      <ActionSuggestionCard tone="success">
                        {examPriorityCards > 0
                          ? `${examPriorityCards} exam-priority ${examPriorityLabel} ${examPriorityVerb} reinforcement before their nearest exam.`
                          : leechStats.totalLeeches > 0
                            ? 'Run this queue now, then check leech cards at the end of session for a focused 5-minute cleanup.'
                            : 'Run this queue now to keep your momentum while the queue is clean.'}
                      </ActionSuggestionCard>
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
                      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                      <h3 className="mt-4 text-lg font-semibold">
                        All caught up
                      </h3>
                      <p className="mt-1 text-muted-foreground">
                        No cards are due right now. Return later or add more
                        flashcards.
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={onGoHome}
                      >
                        Go to Documents
                      </Button>
                    </div>
                  )}
                </div>
              </AnalyticsCard>
            </AnalyticsSection>

            <AnalyticsCard muted className="px-6">
              <div className="space-y-2 py-1">
                <p className="nf-meta-label text-muted-foreground">
                  FSRS refresher
                </p>
                <p className="text-sm text-muted-foreground">
                  Rate each card honestly (Again, Hard, Good, Easy). FSRS uses
                  those ratings to schedule your next optimal review time.
                </p>
              </div>
            </AnalyticsCard>
          </div>
        )}

        {studyState === 'studying' && (
          <div className="space-y-6">
            <AnalyticsCard muted className="px-6">
              <div className="flex flex-wrap items-center justify-between gap-3 py-1">
                <p className="text-sm text-muted-foreground">
                  Session in progress. Ratings update your schedule immediately.
                </p>
                <Button variant="outline" size="sm" onClick={handleBack}>
                  Back to Overview
                </Button>
              </div>
            </AnalyticsCard>
            <LearnQuiz onBack={handleBack} onGoHome={onGoHome} />
          </div>
        )}
      </div>
    </div>
  )
}
