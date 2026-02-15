import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentLearnQuiz } from './document-learn-quiz'
import type { LearnCard as LearnCardType } from './learn/types'

type MockQueryResult = {
  data: Array<LearnCardType> | undefined
  isLoading: boolean
  isError: boolean
  refetch: ReturnType<
    typeof vi.fn<() => Promise<{ data: Array<LearnCardType> }>>
  >
}

const mocks = vi.hoisted(() => ({
  queryResult: {
    data: undefined as unknown,
    isLoading: false,
    isError: false,
    refetch: vi.fn<() => Promise<{ data: Array<LearnCardType> }>>(() =>
      Promise.resolve({ data: [] }),
    ),
  } as unknown as MockQueryResult,
  useQueryMock: vi.fn(),
  mutationMock: vi.fn<(_args: unknown) => Promise<unknown>>((_args: unknown) =>
    Promise.resolve({ reviewLogId: 'review_1' }),
  ),
  toastErrorMock: vi.fn(),
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: (...args: Array<unknown>) => mocks.useQueryMock(...args),
  }
})

vi.mock('convex/react', () => ({
  useMutation: () => mocks.mutationMock,
}))

vi.mock('sonner', () => ({
  toast: {
    error: (...args: Array<unknown>) => mocks.toastErrorMock(...args),
  },
}))

vi.mock('./learn/learn-card', () => ({
  LearnCard: ({
    isExpanded,
    onExpandedChange,
  }: {
    isExpanded: boolean
    onExpandedChange?: (expanded: boolean) => void
  }) => (
    <div>
      <div data-testid="expanded-state">
        {isExpanded ? 'expanded' : 'collapsed'}
      </div>
      <button type="button" onClick={() => onExpandedChange?.(!isExpanded)}>
        Toggle card
      </button>
    </div>
  ),
}))

function createCard(index: number): LearnCardType {
  return {
    cardState: {
      _id: `card_state_${index}`,
      stability: 2,
      difficulty: 3,
      due: Date.now(),
      lastReview: Date.now(),
      reps: index,
      lapses: 0,
      state: 'learning',
      scheduledDays: 1,
      elapsedDays: 0,
    },
    block: {
      _id: `block_${index}`,
      cardType: 'qa',
      cardFront: `Question ${index}`,
      cardBack: `Answer ${index}`,
      textContent: `Content ${index}`,
      ancestorPath: [],
    },
    document: {
      _id: 'doc_1',
      title: 'Biology Notes',
    },
    retrievability: 0.5,
    examPriority: false,
    priorityExam: null,
    retrievabilityAtExam: null,
    intervalPreviews: {
      again: '1m',
      hard: '5m',
      good: '10m',
      easy: '1d',
    },
    isLeech: false,
    leechReason: null,
    retention: null,
  } as unknown as LearnCardType
}

function renderQuiz() {
  return render(
    <DocumentLearnQuiz
      documentId={'doc_1' as any}
      onBack={vi.fn()}
      onGoHome={vi.fn()}
    />,
  )
}

describe('DocumentLearnQuiz', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryResult.data = [createCard(1), createCard(2)]
    mocks.queryResult.isLoading = false
    mocks.queryResult.isError = false
    mocks.queryResult.refetch = vi.fn<
      () => Promise<{ data: Array<LearnCardType> }>
    >(() => Promise.resolve({ data: [createCard(1), createCard(2)] }))
    mocks.useQueryMock.mockImplementation(() => mocks.queryResult)
    mocks.mutationMock.mockImplementation((_args: unknown) =>
      Promise.resolve({ reviewLogId: 'review_1' }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('renders loading state', () => {
    mocks.queryResult.isLoading = true
    mocks.queryResult.data = undefined

    renderQuiz()

    expect(screen.getByText('Loading cards...')).toBeTruthy()
  })

  it('renders query error state and retries on action', () => {
    mocks.queryResult.isError = true
    mocks.queryResult.refetch = vi.fn<
      () => Promise<{ data: Array<LearnCardType> }>
    >(() => Promise.resolve({ data: [] }))

    renderQuiz()

    expect(screen.getByText('Failed to load cards')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))
    expect(mocks.queryResult.refetch).toHaveBeenCalledTimes(1)
  })

  it('renders empty session state', () => {
    mocks.queryResult.data = []

    renderQuiz()

    expect(screen.getByText('All caught up!')).toBeTruthy()
  })

  it('renders active session progress and header details', () => {
    renderQuiz()

    expect(screen.getByText('Reviewed: 0')).toBeTruthy()
    expect(screen.getByText('Progress')).toBeTruthy()
    expect(screen.getByText('1 / 2')).toBeTruthy()
    expect(screen.getByTestId('expanded-state').textContent).toBe('collapsed')
  })

  it.each([
    ['1', 1],
    ['2', 2],
    ['3', 3],
    ['4', 4],
  ] as const)(
    'applies rating %s only when answer is expanded',
    async (key, rating) => {
      renderQuiz()

      fireEvent.keyDown(document, { key })
      expect(mocks.mutationMock).not.toHaveBeenCalled()

      fireEvent.keyDown(document, { key: ' ' })
      expect(screen.getByTestId('expanded-state').textContent).toBe('expanded')

      fireEvent.keyDown(document, { key })

      await waitFor(() => {
        expect(mocks.mutationMock).toHaveBeenCalledWith({
          cardStateId: 'card_state_1',
          rating,
        })
      })
    },
  )

  it('ignores rating shortcuts while typing in input/textarea/contentEditable', () => {
    renderQuiz()

    fireEvent.keyDown(document, { key: ' ' })
    expect(screen.getByTestId('expanded-state').textContent).toBe('expanded')

    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    Object.defineProperty(editable, 'isContentEditable', {
      value: true,
    })
    document.body.append(input, textarea, editable)

    try {
      fireEvent.keyDown(input, { key: '1' })
      fireEvent.keyDown(textarea, { key: '2' })
      fireEvent.keyDown(editable, { key: '3' })

      expect(mocks.mutationMock).not.toHaveBeenCalled()
    } finally {
      input.remove()
      textarea.remove()
      editable.remove()
    }
  })

  it('supports undo keyboard shortcut via U', async () => {
    mocks.mutationMock.mockImplementation((args: unknown) => {
      if ('rating' in (args as Record<string, unknown>)) {
        return Promise.resolve({ reviewLogId: 'review_log_1' })
      }
      return Promise.resolve(undefined)
    })

    renderQuiz()

    fireEvent.keyDown(document, { key: ' ' })
    fireEvent.keyDown(document, { key: '2' })

    await waitFor(() => {
      expect(mocks.mutationMock).toHaveBeenCalledWith({
        cardStateId: 'card_state_1',
        rating: 2,
      })
    })

    fireEvent.keyDown(document, { key: 'u' })

    await waitFor(() => {
      expect(mocks.mutationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardStateId: 'card_state_1',
          previousState: expect.any(Object),
          reviewLogId: 'review_log_1',
        }),
      )
    })
  })

  it('supports undo keyboard shortcut via Ctrl+Z', async () => {
    mocks.mutationMock.mockImplementation((args: unknown) => {
      if ('rating' in (args as Record<string, unknown>)) {
        return Promise.resolve({ reviewLogId: 'review_log_2' })
      }
      return Promise.resolve(undefined)
    })

    renderQuiz()

    fireEvent.keyDown(document, { key: ' ' })
    fireEvent.keyDown(document, { key: '3' })

    await waitFor(() => {
      expect(mocks.mutationMock).toHaveBeenCalledWith({
        cardStateId: 'card_state_1',
        rating: 3,
      })
    })

    fireEvent.keyDown(document, { key: 'z', ctrlKey: true })

    await waitFor(() => {
      expect(mocks.mutationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          cardStateId: 'card_state_1',
          previousState: expect.any(Object),
          reviewLogId: 'review_log_2',
        }),
      )
    })
  })

  it('applies undo button visibility semantics after timer', () => {
    vi.useFakeTimers()
    renderQuiz()

    fireEvent.keyDown(document, { key: ' ' })
    fireEvent.keyDown(document, { key: '2' })

    // Undo visibility is set synchronously before the async mutation resolves.
    const undoButton = screen.getByRole('button', { name: 'Undo' })
    expect(undoButton.getAttribute('aria-hidden')).toBe('false')
    expect(undoButton.getAttribute('tabindex')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(undoButton.getAttribute('aria-hidden')).toBe('true')
    expect(undoButton.getAttribute('tabindex')).toBe('-1')
  })

  it('shows warning toast when review mutation fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mocks.mutationMock.mockImplementation((args: unknown) => {
      if ('rating' in (args as Record<string, unknown>)) {
        return Promise.reject(new Error('review failed'))
      }
      return Promise.resolve(undefined)
    })

    renderQuiz()
    fireEvent.keyDown(document, { key: ' ' })
    fireEvent.keyDown(document, { key: '3' })

    await waitFor(() => {
      expect(mocks.toastErrorMock).toHaveBeenCalledWith(
        'Rating may not have been saved. Check your connection.',
      )
    })

    consoleErrorSpy.mockRestore()
  })

  it('shows refresh toast when refetch fails for Again flow', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mocks.queryResult.refetch = vi.fn<
      () => Promise<{ data: Array<LearnCardType> }>
    >(() => Promise.reject(new Error('refresh failed')))

    renderQuiz()
    fireEvent.keyDown(document, { key: ' ' })
    fireEvent.keyDown(document, { key: '1' })

    await waitFor(() => {
      expect(mocks.toastErrorMock).toHaveBeenCalledWith(
        'Failed to refresh cards. Check your connection.',
      )
    })

    consoleErrorSpy.mockRestore()
  })

  it('shows undo toast when undo mutation fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    mocks.mutationMock.mockImplementation((args: unknown) => {
      if ('rating' in (args as Record<string, unknown>)) {
        return Promise.resolve({ reviewLogId: 'review_log_3' })
      }
      return Promise.reject(new Error('undo failed'))
    })

    renderQuiz()
    fireEvent.keyDown(document, { key: ' ' })
    fireEvent.keyDown(document, { key: '4' })

    await waitFor(() => {
      expect(mocks.mutationMock).toHaveBeenCalledWith({
        cardStateId: 'card_state_1',
        rating: 4,
      })
    })

    fireEvent.keyDown(document, { key: 'u' })

    await waitFor(() => {
      expect(mocks.toastErrorMock).toHaveBeenCalledWith(
        'Failed to undo rating. Check your connection.',
      )
    })

    consoleErrorSpy.mockRestore()
  })
})
