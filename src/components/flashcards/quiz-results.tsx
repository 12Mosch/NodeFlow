import { Link } from '@tanstack/react-router'
import { Check, Home, RotateCcw, Trophy, X } from 'lucide-react'
import { analyzeQuizMistakes } from './quiz-mistake-analysis'
import { renderClozeText } from './utils'
import type { QuizResult } from './types'
import {
  ActionSuggestionCard,
  AnalyticsCard,
  AnalyticsSection,
  MetricCard,
} from '@/components/analytics'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { pluralize } from '@/lib/pluralize'
import { cn } from '@/lib/utils'

interface QuizResultsProps {
  results: Array<QuizResult>
  onRestart: () => void
  onSelectNew: () => void
  onGoHome: () => void
}

export function QuizResults({
  results,
  onRestart,
  onSelectNew,
  onGoHome,
}: QuizResultsProps) {
  const knewCount = results.filter((r) => r.knew).length
  const totalCount = results.length
  const missedCount = totalCount - knewCount
  const percentage =
    totalCount > 0 ? Math.round((knewCount / totalCount) * 100) : 0
  const { topProblemCards, topMistakeShare } = analyzeQuizMistakes(results)
  const topProblemCardLabel = pluralize(topProblemCards, 'card')
  const recommendation =
    percentage < 65
      ? `Random recall landed at ${percentage}%. Run your next session in Spaced Repetition mode to recover weak cards faster.`
      : percentage < 80
        ? `You're in a mixed zone at ${percentage}% accuracy. Review missed cards immediately, then retest this deck in a shorter batch.`
        : `Strong run at ${percentage}% accuracy. Keep random mode for quick checks, and use Spaced Repetition to lock in long-term retention.`
  const recommendationTone =
    percentage < 65 ? 'warning' : percentage < 80 ? 'default' : 'success'
  const problemCardsTone = percentage >= 80 ? 'default' : 'warning'

  const getMessage = () => {
    if (percentage === 100) return { text: 'Perfect score!', icon: '🎉' }
    if (percentage >= 80) return { text: 'Great job!', icon: '⭐' }
    if (percentage >= 60) return { text: 'Good effort!', icon: '👍' }
    if (percentage >= 40) return { text: 'Keep practicing!', icon: '💪' }
    return { text: 'Room for improvement', icon: '📚' }
  }

  const message = getMessage()

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <AnalyticsSection
        title="Session Results"
        description="Your random practice performance across the selected cards."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            variant="compact"
            label="Accuracy"
            value={`${percentage}%`}
            helper={`${knewCount}/${totalCount} correct`}
          />
          <MetricCard
            variant="compact"
            label="Knew it"
            value={knewCount}
            helper="confident responses"
          />
          <MetricCard
            variant="compact"
            label="Missed"
            value={missedCount}
            helper="needs review"
          />
        </div>
        <ActionSuggestionCard
          tone={recommendationTone}
          action={
            percentage < 65 ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/study" search={{ mode: 'spaced-repetition' }}>
                  Switch to Spaced
                </Link>
              </Button>
            ) : null
          }
        >
          {recommendation}
        </ActionSuggestionCard>
        {missedCount > 0 ? (
          <ActionSuggestionCard tone={problemCardsTone}>
            {topProblemCards} {topProblemCardLabel} caused {topMistakeShare}% of
            your misses. Review those first, then rerun this deck.
          </ActionSuggestionCard>
        ) : null}

        <AnalyticsCard className="px-6">
          <div className="space-y-6 py-1">
            <div className="text-center">
              <div className="mb-3 text-5xl">{message.icon}</div>
              <h2 className="text-2xl font-semibold">{message.text}</h2>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Accuracy</span>
                <span className="font-medium">{percentage}%</span>
              </div>
              <Progress value={percentage} className="h-3" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4">
                <div className="rounded-full bg-emerald-500/20 p-2">
                  <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {knewCount}
                  </p>
                  <p className="text-sm text-muted-foreground">Knew it</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-red-500/25 bg-red-500/10 p-4">
                <div className="rounded-full bg-red-500/20 p-2">
                  <X className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {missedCount}
                  </p>
                  <p className="text-sm text-muted-foreground">Didn't know</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Button onClick={onRestart} className="flex-1 gap-2">
                <RotateCcw className="h-4 w-4" />
                Study Again
              </Button>
              <Button
                onClick={onSelectNew}
                variant="outline"
                className="flex-1 gap-2"
              >
                <Trophy className="h-4 w-4" />
                Select Different Cards
              </Button>
              <Button
                onClick={onGoHome}
                variant="ghost"
                className="flex-1 gap-2"
              >
                <Home className="h-4 w-4" />
                Home
              </Button>
            </div>
          </div>
        </AnalyticsCard>
      </AnalyticsSection>

      {results.length > 0 && (
        <AnalyticsSection
          title="Card Review"
          description="Scan each prompt to identify weak spots before your next session."
        >
          <AnalyticsCard className="px-0">
            <div
              tabIndex={0}
              role="region"
              aria-label="Review results"
              className="max-h-100 divide-y overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {results.map((result, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-start gap-3 px-6 py-4',
                    result.knew ? 'bg-emerald-500/5' : 'bg-red-500/5',
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 shrink-0 rounded-full p-1',
                      result.knew ? 'bg-emerald-500/20' : 'bg-red-500/20',
                    )}
                  >
                    {result.knew ? (
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <X className="h-3 w-3 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-4 text-sm font-medium whitespace-pre-line">
                      {result.card.block.cardType === 'cloze'
                        ? renderClozeText(result.card.block.textContent, {
                            markClassName:
                              'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-0.5 rounded font-medium',
                          })
                        : result.card.direction === 'reverse'
                          ? result.card.block.cardBack
                          : result.card.block.cardFront}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {result.card.documentTitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </AnalyticsCard>
        </AnalyticsSection>
      )}
    </div>
  )
}
