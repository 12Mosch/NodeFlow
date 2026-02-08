import { describe, expect, it } from 'vitest'
import { analyzeQuizMistakes } from './quiz-mistake-analysis'
import type { QuizResult } from './types'

function buildResult(
  cardId: string,
  direction: 'forward' | 'reverse',
  knew: boolean,
): QuizResult {
  return {
    knew,
    card: {
      direction,
      documentTitle: 'Doc',
      block: { _id: cardId } as QuizResult['card']['block'],
    } as QuizResult['card'],
  } as QuizResult
}

describe('quiz-mistake-analysis', () => {
  it('returns zeros when there are no misses', () => {
    const results = [
      buildResult('a', 'forward', true),
      buildResult('b', 'reverse', true),
    ]

    const analysis = analyzeQuizMistakes(results)

    expect(analysis).toEqual({
      topProblemCards: 0,
      topMistakeShare: 0,
    })
  })

  it('calculates top contributors with the default threshold', () => {
    const results = [
      buildResult('a', 'forward', false),
      buildResult('a', 'forward', false),
      buildResult('a', 'forward', false),
      buildResult('b', 'forward', false),
      buildResult('c', 'forward', false),
      buildResult('d', 'reverse', true),
    ]

    const analysis = analyzeQuizMistakes(results)

    expect(analysis).toEqual({
      topProblemCards: 1,
      topMistakeShare: 60,
    })
  })

  it('treats forward and reverse directions as separate card keys', () => {
    const results = [
      buildResult('a', 'forward', false),
      buildResult('a', 'reverse', false),
      buildResult('b', 'forward', false),
    ]

    const analysis = analyzeQuizMistakes(results)

    expect(analysis).toEqual({
      topProblemCards: 2,
      topMistakeShare: 67,
    })
  })
})
