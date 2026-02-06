import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import * as Sentry from '@sentry/tanstackstart-react'
import { Link } from '@tanstack/react-router'
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
import {
  AnalyticsCard,
  AnalyticsSection,
  MetricCard,
} from '@/components/analytics'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'
import { Progress } from '@/components/ui/progress'

interface SpacedRepetitionModeProps {
  studyState: StudyState
  setStudyState: (state: StudyState) => void
  onGoHome: () => void
}

export function SpacedRepetitionMode({
  studyState,
  setStudyState,
  onGoHome,
}: SpacedRepetitionModeProps) {
  const { data: stats } = useSuspenseQuery(
    convexQuery(api.cardStates.getStats, {}),
  )
  const { data: sessionCards } = useSuspenseQuery(
    convexQuery(api.cardStates.getLearnSession, {}),
  )
  const { data: leechStats } = useSuspenseQuery(
    convexQuery(api.cardStates.getLeechStats, {}),
  )

  if (!stats || !sessionCards || !leechStats) return null

  const handleStartLearning = () => {
    Sentry.startSpan(
      { name: 'StudyMode.startLearning', op: 'ui.interaction' },
      () => {
        setStudyState('studying')
      },
    )
  }

  const handleBack = () => {
    setStudyState('overview')
  }

  const dueCards = sessionCards.filter((c) => c.cardState.state !== 'new')
  const newCards = sessionCards.filter((c) => c.cardState.state === 'new')
  const totalDue = dueCards.length + newCards.length
  const readiness =
    totalDue > 0
      ? Math.min(
          100,
          Math.max(0, Math.round((stats.reviewedToday / totalDue) * 100)),
        )
      : 0

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
            </AnalyticsSection>

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
                        {leechStats.totalLeeches} card
                        {leechStats.totalLeeches !== 1 ? 's are' : ' is'}{' '}
                        showing elevated difficulty.
                      </p>
                    </div>
                    <Link to="/study-leeches" className="shrink-0">
                      <Button variant="outline" className="gap-2">
                        <Settings className="h-4 w-4" />
                        Manage Leech Cards
                      </Button>
                    </Link>
                  </div>
                </AnalyticsCard>
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
                            {dueCards.length} review
                            {dueCards.length !== 1 ? 's' : ''},{' '}
                            {newCards.length} new
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
                <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
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
