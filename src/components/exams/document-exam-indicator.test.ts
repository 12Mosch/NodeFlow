import { createElement } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DAY_MS } from '../../lib/exams'
import { DocumentExamIndicatorView } from './document-exam-indicator'

const fixedNow = new Date('2026-02-12T12:00:00.000Z').getTime()

describe('DocumentExamIndicatorView', () => {
  it('renders nothing when indicator is null', () => {
    const { container } = render(
      createElement(DocumentExamIndicatorView, {
        variant: 'home',
        now: fixedNow,
        indicator: null,
      }),
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when active exam count is zero', () => {
    const { container } = render(
      createElement(DocumentExamIndicatorView, {
        variant: 'home',
        now: fixedNow,
        indicator: {
          activeExamCount: 0,
          nextExamAt: fixedNow + DAY_MS,
          nextExamTitle: 'Ignored',
        },
      }),
    )

    expect(container.innerHTML).toBe('')
  })

  it('renders badge and countdown text for home list indicators', () => {
    const { container } = render(
      createElement(DocumentExamIndicatorView, {
        variant: 'home',
        now: fixedNow,
        indicator: {
          activeExamCount: 2,
          nextExamAt: fixedNow + 2 * DAY_MS,
          nextExamTitle: 'Biology Midterm',
        },
      }),
    )

    expect(container.textContent).toContain('2 exams')
    expect(container.textContent).toContain('Biology Midterm')
    expect(container.textContent).toContain('2 days')
  })

  it('renders compact sidebar indicator', () => {
    const { container } = render(
      createElement(DocumentExamIndicatorView, {
        variant: 'sidebar',
        now: fixedNow,
        indicator: {
          activeExamCount: 1,
          nextExamAt: fixedNow + DAY_MS,
          nextExamTitle: 'Physics Quiz',
        },
      }),
    )

    expect(container.textContent).toContain('1')
    expect(container.textContent).toContain('1 day')
  })

  it('renders next exam timing details in header variant', () => {
    const { container } = render(
      createElement(DocumentExamIndicatorView, {
        variant: 'header',
        now: fixedNow,
        indicator: {
          activeExamCount: 1,
          nextExamAt: fixedNow,
          nextExamTitle: 'Calculus Final',
        },
      }),
    )

    expect(container.textContent).toContain('1 exam')
    expect(container.textContent).toContain('Calculus Final')
    expect(container.textContent).toContain('Today')
  })
})
