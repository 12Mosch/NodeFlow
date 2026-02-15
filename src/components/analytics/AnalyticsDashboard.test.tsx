import { createElement } from 'react'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalyticsDashboard } from './AnalyticsDashboard'
import {
  analyticsDashboardFixture,
  analyticsEmptyDashboardFixture,
  difficultyBucketCardsFixture,
  emptyDifficultyBucketCardsFixture,
} from '@/test/fixtures/analytics'
import { renderWithQuery } from '@/test/render-with-query'

const suspenseQueryMock = vi.hoisted(() => vi.fn())
const queryMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')

  return {
    ...actual,
    useSuspenseQuery: (...args: Array<unknown>) => suspenseQueryMock(...args),
    useQuery: (...args: Array<unknown>) => queryMock(...args),
  }
})

vi.mock('@tanstack/react-router', async () => {
  const [actual, { LinkMock, routerMock }] = await Promise.all([
    vi.importActual('@tanstack/react-router'),
    import('@/test/mocks/router'),
  ])

  return {
    ...actual,
    Link: LinkMock,
    useRouter: () => routerMock,
  }
})

vi.mock('@/components/mode-toggle', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    ModeToggle: () => reactCreateElement('span', {}, 'mode-toggle'),
  }
})

describe('AnalyticsDashboard smoke', () => {
  beforeEach(async () => {
    const { resetRouterMocks } = await import('@/test/mocks/router')
    resetRouterMocks()
    vi.clearAllMocks()
    suspenseQueryMock.mockReturnValue({ data: analyticsDashboardFixture })
    queryMock.mockReturnValue({
      data: difficultyBucketCardsFixture,
      isPending: false,
    })
  })
  afterEach(() => {
    cleanup()
  })

  it('renders dashboard sections without runtime errors', () => {
    expect(() => {
      renderWithQuery(createElement(AnalyticsDashboard))
    }).not.toThrow()

    expect(screen.getByText('Learning Analytics')).toBeTruthy()
    expect(screen.getByText('Retention Snapshot')).toBeTruthy()
    expect(screen.getByText('Review Quality Drivers')).toBeTruthy()
    expect(screen.getByText('Workload Outlook')).toBeTruthy()
  })

  it('switches difficulty detail panel when a bucket is clicked', () => {
    renderWithQuery(createElement(AnalyticsDashboard))

    expect(
      screen.getByText(
        'Click a difficulty slice to inspect cards in that bucket.',
      ),
    ).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: '3-4 difficulty bucket' }),
    )

    expect(screen.getByText(/Difficulty 3-4/)).toBeTruthy()
    expect(
      screen.queryByText(
        'Click a difficulty slice to inspect cards in that bucket.',
      ),
    ).toBeNull()
  })

  it('renders retention, workload, and forecast empty messages for zero datasets', () => {
    suspenseQueryMock.mockReturnValue({
      data: analyticsEmptyDashboardFixture,
    })
    queryMock.mockReturnValue({ data: undefined, isPending: false })

    renderWithQuery(createElement(AnalyticsDashboard))

    expect(
      screen.getByText(
        'No review data yet. Complete a few reviews to unlock retention curves.',
      ),
    ).toBeTruthy()
    expect(screen.getByText('No hourly patterns yet.')).toBeTruthy()
    expect(screen.getByText('No upcoming reviews scheduled yet.')).toBeTruthy()
  })

  it('renders difficulty pending skeleton when bucket results are pending', () => {
    queryMock.mockReturnValue({ data: undefined, isPending: true })

    const { container } = renderWithQuery(createElement(AnalyticsDashboard))

    fireEvent.click(
      screen.getByRole('button', { name: '3-4 difficulty bucket' }),
    )

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
      0,
    )
  })

  it('renders no-result message for selected difficulty bucket', () => {
    queryMock.mockReturnValue({
      data: emptyDifficultyBucketCardsFixture,
      isPending: false,
    })

    renderWithQuery(createElement(AnalyticsDashboard))

    fireEvent.click(
      screen.getByRole('button', { name: '3-4 difficulty bucket' }),
    )

    expect(
      screen.getByText('No active cards found in difficulty 3-4.'),
    ).toBeTruthy()
  })
})
