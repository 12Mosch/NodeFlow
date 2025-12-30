import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import * as Sentry from '@sentry/tanstackstart-react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  Flame,
  Sparkles,
} from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import type { StudyState } from './types'
import { LearnQuiz } from '@/components/learn'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
              <Brain className="h-5 w-5 text-muted-foreground" />
              <h1 className="font-semibold">Spaced Repetition</h1>
            </div>
          </div>
          <ModeToggle />
        </div>
      </header>

      {/* Content */}
      <div className="p-8">
        {studyState === 'overview' && (
          <div className="space-y-8">
            {/* Hero section */}
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                Study with FSRS
              </h2>
              <p className="mt-2 text-muted-foreground">
                Review cards at optimal intervals for maximum retention
              </p>
            </div>

            {/* Stats cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Due Now</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.dueNow}</div>
                  <p className="text-xs text-muted-foreground">
                    cards need review
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    New Cards
                  </CardTitle>
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.newCards}</div>
                  <p className="text-xs text-muted-foreground">
                    cards to introduce
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Reviewed Today
                  </CardTitle>
                  <Flame className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.reviewedToday}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    cards reviewed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    Retention Rate
                  </CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.retentionRate !== null
                      ? `${stats.retentionRate}%`
                      : '—'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    today's accuracy
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Session preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Today's Session
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {totalDue > 0 ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>
                          {dueCards.length} review{dueCards.length !== 1 && 's'}
                          , {newCards.length} new
                        </span>
                        <span className="font-medium">{totalDue} total</span>
                      </div>
                      <Progress value={0} className="h-2" />
                    </div>

                    <Button
                      size="lg"
                      className="w-full gap-2"
                      onClick={handleStartLearning}
                    >
                      <Brain className="h-5 w-5" />
                      Start Learning
                    </Button>
                  </>
                ) : (
                  <div className="py-8 text-center">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                    <h3 className="mt-4 text-lg font-semibold">
                      All caught up!
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      No cards due for review. Check back later or add more
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
              </CardContent>
            </Card>

            {/* Quick tip */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <h4 className="font-medium">How FSRS Works</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                The Free Spaced Repetition Scheduler (FSRS) uses advanced memory
                modeling to predict when you're about to forget each card. Rate
                cards honestly—Again, Hard, Good, or Easy—to optimize your
                review intervals.
              </p>
            </div>
          </div>
        )}

        {studyState === 'studying' && (
          <LearnQuiz onBack={handleBack} onGoHome={onGoHome} />
        )}
      </div>
    </div>
  )
}
