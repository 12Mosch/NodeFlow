import { RotateCcw, ThumbsDown, ThumbsUp, Zap } from 'lucide-react'
import type { Rating } from './types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface RatingButtonsProps {
  intervalPreviews: {
    again: string
    hard: string
    good: string
    easy: string
  }
  onRate: (rating: Rating) => void
  disabled?: boolean
  /** Rating that was just triggered via keyboard - causes a flash effect */
  activeRating?: Rating | null
}

export function RatingButtons({
  intervalPreviews,
  onRate,
  disabled = false,
  activeRating,
}: RatingButtonsProps) {
  const buttons: Array<{
    rating: Rating
    label: string
    interval: string
    icon: typeof RotateCcw
    baseClassName: string
    hoverClassName: string
    activeClassName: string
  }> = [
    {
      rating: 1,
      label: 'Forgot',
      interval: intervalPreviews.again,
      icon: RotateCcw,
      baseClassName: 'border-red-500/30 text-red-600 dark:text-red-400',
      hoverClassName:
        'hover:bg-red-500/15 hover:border-red-500/50 hover:shadow-[0_0_12px_rgba(239,68,68,0.15)] dark:hover:shadow-[0_0_12px_rgba(239,68,68,0.25)]',
      activeClassName:
        'bg-red-500/20 border-red-500/60 shadow-[0_0_16px_rgba(239,68,68,0.3)]',
    },
    {
      rating: 2,
      label: 'Hard',
      interval: intervalPreviews.hard,
      icon: ThumbsDown,
      baseClassName:
        'border-orange-500/30 text-orange-600 dark:text-orange-400',
      hoverClassName:
        'hover:bg-orange-500/15 hover:border-orange-500/50 hover:shadow-[0_0_12px_rgba(249,115,22,0.15)] dark:hover:shadow-[0_0_12px_rgba(249,115,22,0.25)]',
      activeClassName:
        'bg-orange-500/20 border-orange-500/60 shadow-[0_0_16px_rgba(249,115,22,0.3)]',
    },
    {
      rating: 3,
      label: 'Good',
      interval: intervalPreviews.good,
      icon: ThumbsUp,
      baseClassName:
        'border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
      hoverClassName:
        'hover:bg-emerald-500/15 hover:border-emerald-500/50 hover:shadow-[0_0_12px_rgba(16,185,129,0.15)] dark:hover:shadow-[0_0_12px_rgba(16,185,129,0.25)]',
      activeClassName:
        'bg-emerald-500/20 border-emerald-500/60 shadow-[0_0_16px_rgba(16,185,129,0.3)]',
    },
    {
      rating: 4,
      label: 'Easy',
      interval: intervalPreviews.easy,
      icon: Zap,
      baseClassName: 'border-sky-500/30 text-sky-600 dark:text-sky-400',
      hoverClassName:
        'hover:bg-sky-500/15 hover:border-sky-500/50 hover:shadow-[0_0_12px_rgba(14,165,233,0.15)] dark:hover:shadow-[0_0_12px_rgba(14,165,233,0.25)]',
      activeClassName:
        'bg-sky-500/20 border-sky-500/60 shadow-[0_0_16px_rgba(14,165,233,0.3)]',
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-3">
      {buttons.map(
        ({
          rating,
          label,
          interval,
          icon: Icon,
          baseClassName,
          hoverClassName,
          activeClassName,
        }) => (
          <Button
            key={rating}
            variant="outline"
            className={cn(
              'flex h-auto flex-col gap-1 rounded-xl py-4 transition-all duration-150',
              baseClassName,
              hoverClassName,
              activeRating === rating && activeClassName,
            )}
            onClick={() => onRate(rating)}
            disabled={disabled}
          >
            <div className="flex items-center gap-1.5">
              <Icon className="h-4 w-4" />
              <span className="font-medium">{label}</span>
            </div>
            <span className="text-xs opacity-70">{interval}</span>
          </Button>
        ),
      )}
    </div>
  )
}
