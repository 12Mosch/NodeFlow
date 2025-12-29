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
}

export function RatingButtons({
  intervalPreviews,
  onRate,
  disabled = false,
}: RatingButtonsProps) {
  const buttons: Array<{
    rating: Rating
    label: string
    interval: string
    icon: typeof RotateCcw
    className: string
    keyHint: string
  }> = [
    {
      rating: 1,
      label: 'Again',
      interval: intervalPreviews.again,
      icon: RotateCcw,
      className:
        'border-red-500/30 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400',
      keyHint: '1',
    },
    {
      rating: 2,
      label: 'Hard',
      interval: intervalPreviews.hard,
      icon: ThumbsDown,
      className:
        'border-orange-500/30 text-orange-600 hover:bg-orange-500/10 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-400',
      keyHint: '2',
    },
    {
      rating: 3,
      label: 'Good',
      interval: intervalPreviews.good,
      icon: ThumbsUp,
      className:
        'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-400',
      keyHint: '3',
    },
    {
      rating: 4,
      label: 'Easy',
      interval: intervalPreviews.easy,
      icon: Zap,
      className:
        'border-blue-500/30 text-blue-600 hover:bg-blue-500/10 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-400',
      keyHint: '4',
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-2">
      {buttons.map(
        ({ rating, label, interval, icon: Icon, className, keyHint }) => (
          <Button
            key={rating}
            variant="outline"
            className={cn('flex h-auto flex-col gap-1 py-3', className)}
            onClick={() => onRate(rating)}
            disabled={disabled}
          >
            <div className="flex items-center gap-1.5">
              <Icon className="h-4 w-4" />
              <span className="font-medium">{label}</span>
            </div>
            <span className="text-xs opacity-70">{interval}</span>
            <kbd className="mt-1 rounded border border-current/20 bg-current/5 px-1.5 py-0.5 text-[10px] font-semibold opacity-50">
              {keyHint}
            </kbd>
          </Button>
        ),
      )}
    </div>
  )
}
