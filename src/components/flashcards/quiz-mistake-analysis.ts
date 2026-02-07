import type { QuizResult } from './types'

export const TOP_MISTAKE_CONTRIBUTION_THRESHOLD = 0.4

export interface QuizMistakeAnalysis {
  topProblemCards: number
  topMistakeShare: number
}

export function analyzeQuizMistakes(
  results: Array<QuizResult>,
  contributionThreshold = TOP_MISTAKE_CONTRIBUTION_THRESHOLD,
): QuizMistakeAnalysis {
  const missedCount = results.filter((result) => !result.knew).length
  if (missedCount === 0) {
    return { topProblemCards: 0, topMistakeShare: 0 }
  }

  const missesByCard = results.reduce<Map<string, number>>((acc, result) => {
    if (result.knew) return acc

    const cardKey = `${result.card.block._id}:${result.card.direction}`
    acc.set(cardKey, (acc.get(cardKey) ?? 0) + 1)
    return acc
  }, new Map())

  const sortedMistakeContributors = Array.from(missesByCard.values()).sort(
    (a, b) => b - a,
  )

  let runningMistakes = 0
  let topProblemCards = 0
  for (const count of sortedMistakeContributors) {
    if (runningMistakes >= missedCount * contributionThreshold) break
    runningMistakes += count
    topProblemCards += 1
  }

  return {
    topProblemCards,
    topMistakeShare: Math.round((runningMistakes / missedCount) * 100),
  }
}
