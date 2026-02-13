import { createElement } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DAY_MS } from '../../lib/exams'
import { ExamOverviewMetrics } from './ExamOverviewMetrics'

const fixedNow = new Date('2026-02-12T12:00:00.000Z').getTime()

describe('ExamOverviewMetrics', () => {
  it('renders active count, next exam label, and exam-priority count', () => {
    const { container } = render(
      createElement(ExamOverviewMetrics, {
        activeExamCount: 3,
        nextExamAt: fixedNow + 2 * DAY_MS,
        nextExamTitle: 'Organic Chemistry',
        examPriorityCards: 7,
        now: fixedNow,
      }),
    )

    expect(container.textContent).toContain('Active exams')
    expect(container.textContent).toContain('3')
    expect(container.textContent).toContain('Next exam')
    expect(container.textContent).toContain('2 days')
    expect(container.textContent).toContain('Organic Chemistry')
    expect(container.textContent).toContain('Exam-priority cards')
    expect(container.textContent).toContain('7')
  })
})
