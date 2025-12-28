import { Check, Home, RotateCcw, Trophy, X } from 'lucide-react'
import { renderClozeText } from './utils'
import type { QuizResult } from './types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
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
  const percentage =
    totalCount > 0 ? Math.round((knewCount / totalCount) * 100) : 0

  const getMessage = () => {
    if (percentage === 100) return { text: 'Perfect score!', icon: '🎉' }
    if (percentage >= 80) return { text: 'Great job!', icon: '⭐' }
    if (percentage >= 60) return { text: 'Good effort!', icon: '👍' }
    if (percentage >= 40) return { text: 'Keep practicing!', icon: '💪' }
    return { text: 'Room for improvement', icon: '📚' }
  }

  const message = getMessage()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Main results card */}
      <Card>
        <CardHeader className="text-center pb-2">
          <div className="text-6xl mb-4">{message.icon}</div>
          <CardTitle className="text-2xl">{message.text}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Score display */}
          <div className="text-center">
            <div className="text-5xl font-bold mb-2">
              <span className="text-emerald-500">{knewCount}</span>
              <span className="text-muted-foreground">/</span>
              <span>{totalCount}</span>
            </div>
            <p className="text-muted-foreground">cards correct</p>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Accuracy</span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <Progress value={percentage} className="h-3" />
          </div>

          {/* Stats breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="p-2 rounded-full bg-emerald-500/20">
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {knewCount}
                </p>
                <p className="text-sm text-muted-foreground">Knew it</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="p-2 rounded-full bg-red-500/20">
                <X className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {totalCount - knewCount}
                </p>
                <p className="text-sm text-muted-foreground">Didn't know</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
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
            <Button onClick={onGoHome} variant="ghost" className="flex-1 gap-2">
              <Home className="h-4 w-4" />
              Home
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card-by-card results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[400px] overflow-y-auto">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-start gap-3 p-4',
                    result.knew ? 'bg-emerald-500/5' : 'bg-red-500/5',
                  )}
                >
                  <div
                    className={cn(
                      'p-1 rounded-full shrink-0 mt-0.5',
                      result.knew ? 'bg-emerald-500/20' : 'bg-red-500/20',
                    )}
                  >
                    {result.knew ? (
                      <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <X className="h-3 w-3 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-4 whitespace-pre-line">
                      {result.card.block.cardType === 'cloze'
                        ? renderClozeText(result.card.block.textContent, {
                            markClassName:
                              'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-0.5 rounded font-medium',
                          })
                        : result.card.direction === 'reverse'
                          ? result.card.block.cardBack
                          : result.card.block.cardFront}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {result.card.documentTitle}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
