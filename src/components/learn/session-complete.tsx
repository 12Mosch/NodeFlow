import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { pluralize } from '@/lib/pluralize'

// Confetti configuration
const HIGH_SUCCESS_THRESHOLD = 80
const HIGH_SUCCESS_PARTICLE_COUNT = 120
const LOW_SUCCESS_PARTICLE_COUNT = 60
const CONFETTI_SPREAD = 70
const CONFETTI_START_VELOCITY = 30

// Message tier thresholds
const PERFECT_THRESHOLD = 100
const GREAT_THRESHOLD = 80
const GOOD_THRESHOLD = 60
const KEEP_GOING_THRESHOLD = 40

type CelebrationTier = {
  emoji: string
  message: string
  min: number
  exact?: boolean
}

const CELEBRATION_TIERS: Array<CelebrationTier> = [
  {
    min: PERFECT_THRESHOLD,
    exact: true,
    emoji: '🎉',
    message: 'Perfect session!',
  },
  { min: GREAT_THRESHOLD, emoji: '⭐', message: 'Great work!' },
  { min: GOOD_THRESHOLD, emoji: '👍', message: 'Good effort!' },
  { min: KEEP_GOING_THRESHOLD, emoji: '💪', message: 'Keep it up!' },
  { min: Number.NEGATIVE_INFINITY, emoji: '📚', message: 'Keep practicing!' },
]

interface SessionCompleteProps {
  reviewedCount: number
  successRate: number
  onBack: () => void
  onGoHome: () => void
}

function getCelebration(successRate: number) {
  for (const tier of CELEBRATION_TIERS) {
    if (tier.exact ? successRate === tier.min : successRate >= tier.min) {
      return tier
    }
  }

  return CELEBRATION_TIERS[CELEBRATION_TIERS.length - 1]
}

export function SessionComplete({
  reviewedCount,
  successRate,
  onBack,
  onGoHome,
}: SessionCompleteProps) {
  const reviewedCardLabel = pluralize(reviewedCount, 'card')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (prefersReducedMotion) return

    void (async () => {
      const confettiModule = await import('canvas-confetti')
      const confetti =
        'default' in confettiModule ? confettiModule.default : confettiModule

      confetti({
        particleCount:
          successRate >= HIGH_SUCCESS_THRESHOLD
            ? HIGH_SUCCESS_PARTICLE_COUNT
            : LOW_SUCCESS_PARTICLE_COUNT,
        spread: CONFETTI_SPREAD,
        startVelocity: CONFETTI_START_VELOCITY,
      })
    })()
  }, [successRate])

  const { emoji: celebrationEmoji, message: celebrationMessage } =
    getCelebration(successRate)

  return (
    <div className="py-12 text-center">
      <span className="text-5xl">{celebrationEmoji}</span>
      <h2 className="mt-4 text-2xl font-bold">{celebrationMessage}</h2>
      <p className="mt-2 text-muted-foreground">
        You reviewed {reviewedCount} {reviewedCardLabel} in this session.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button onClick={onBack} variant="outline">
          Start New Session
        </Button>
        <Button onClick={onGoHome}>Go Home</Button>
      </div>
    </div>
  )
}
