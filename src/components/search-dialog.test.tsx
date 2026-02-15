import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SearchDialog } from './search-dialog'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  navigateMock: vi.fn(),
  closeMock: vi.fn(),
  setSearchQueryMock: vi.fn(),
  convexQueryMock: vi.fn(
    (_queryRef: unknown, args: unknown): { queryKey: Array<unknown> } => ({
      queryKey: ['convexQuery', 'search:search', args],
    }),
  ),
  searchState: {
    isOpen: true,
  },
  queryResult: {
    data: undefined as unknown,
    isLoading: false,
  },
}))

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')

  return {
    ...actual,
    useQuery: (...args: Array<unknown>) => mocks.useQueryMock(...args),
  }
})

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')

  return {
    ...actual,
    useNavigate: () => mocks.navigateMock,
  }
})

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (queryRef: unknown, args: unknown) =>
    mocks.convexQueryMock(queryRef, args),
}))

vi.mock('../extensions/search-highlight', () => ({
  setSearchQuery: (...args: Array<unknown>) =>
    mocks.setSearchQueryMock(...args),
}))

vi.mock('./search-provider', () => ({
  useSearch: () => ({
    isOpen: mocks.searchState.isOpen,
    close: mocks.closeMock,
  }),
}))

vi.mock('./ui/command', () => ({
  CommandDialog: ({
    open,
    onOpenChange,
    title,
    description,
    children,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description: string
    children: ReactNode
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <p>{description}</p>
        <button type="button" onClick={() => onOpenChange(false)}>
          Close dialog
        </button>
        {children}
      </div>
    ) : null,
  CommandInput: ({
    placeholder,
    value,
    onValueChange,
  }: {
    placeholder?: string
    value?: string
    onValueChange?: (value: string) => void
  }) => (
    <input
      aria-label="Search documents"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    />
  ),
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  CommandGroup: ({
    heading,
    children,
  }: {
    heading?: string
    children: ReactNode
  }) => (
    <section>
      {heading && <h3>{heading}</h3>}
      {children}
    </section>
  ),
  CommandItem: ({
    value,
    onSelect,
    children,
  }: {
    value?: string
    onSelect?: (value: string) => void
    children: ReactNode
  }) => (
    <button type="button" onClick={() => onSelect?.(value ?? '')}>
      {children}
    </button>
  ),
}))

function renderDialog() {
  return render(<SearchDialog />)
}

function getSearchInput(): HTMLInputElement {
  const input = screen.getByRole('textbox', { name: 'Search documents' })
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Expected search textbox to be an input element')
  }
  return input
}

describe('SearchDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.searchState.isOpen = true
    mocks.queryResult = {
      data: {
        documents: [],
        blocks: [],
      },
      isLoading: false,
    }
    mocks.useQueryMock.mockImplementation(() => mocks.queryResult)
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('skips active search query when closed and clears highlight state', () => {
    mocks.searchState.isOpen = false

    renderDialog()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.useQueryMock).toHaveBeenCalledTimes(1)

    const queryOptions = mocks.useQueryMock.mock.calls[0][0] as {
      queryKey?: Array<unknown>
    }
    expect(queryOptions.queryKey?.[2]).toBe('skip')
    expect(mocks.setSearchQueryMock).toHaveBeenCalledWith('')
  })

  it('renders loading copy for recent docs when query is empty', () => {
    mocks.queryResult = { data: undefined, isLoading: true }

    renderDialog()

    expect(screen.getByText('Loading recent documents...')).toBeTruthy()
  })

  it('renders empty state when no results are available', () => {
    renderDialog()

    expect(screen.getByText('No results found.')).toBeTruthy()
  })

  it('renders document and content groups for populated results', () => {
    vi.useFakeTimers()
    mocks.queryResult = {
      data: {
        documents: [{ _id: 'doc_1', title: 'Biology Notes' }],
        blocks: [
          {
            _id: 'block_1',
            documentId: 'doc_1',
            documentTitle: 'Biology Notes',
            textContent: 'Cell membranes regulate transport.',
            type: 'paragraph',
          },
        ],
      },
      isLoading: false,
    }

    renderDialog()

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search documents' }),
      {
        target: { value: 'cell' },
      },
    )
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByText('Documents')).toBeTruthy()
    expect(screen.getByText('Content')).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: /Biology Notes/ }).length,
    ).toBe(2)
    expect(screen.getByText(/membranes regulate transport/)).toBeTruthy()
  })

  it('closes and navigates with expected route params and search payload on selection', () => {
    vi.useFakeTimers()
    mocks.queryResult = {
      data: {
        documents: [{ _id: 'doc_1', title: 'Biology Notes' }],
        blocks: [],
      },
      isLoading: false,
    }

    renderDialog()

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search documents' }),
      {
        target: { value: 'bio' },
      },
    )
    act(() => {
      vi.advanceTimersByTime(300)
    })

    fireEvent.click(screen.getByRole('button', { name: /Biology Notes/ }))

    expect(mocks.closeMock).toHaveBeenCalledTimes(1)
    expect(mocks.navigateMock).toHaveBeenCalledWith({
      to: '/doc/$docId',
      params: { docId: 'doc_1' },
      search: { q: 'bio' },
    })
  })

  it('resets local query state when dialog closes through onOpenChange(false)', () => {
    renderDialog()

    const input = getSearchInput()
    fireEvent.change(input, { target: { value: 'biology' } })
    expect(input.value).toBe('biology')

    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))

    expect(mocks.closeMock).toHaveBeenCalledTimes(1)
    expect(getSearchInput().value).toBe('')
  })

  it('exposes accessible dialog title/description and input labeling', () => {
    renderDialog()

    const dialog = screen.getByRole('dialog', { name: 'Search' })
    expect(
      within(dialog).getByText('Search documents and content'),
    ).toBeTruthy()
    expect(
      within(dialog).getByRole('textbox', { name: 'Search documents' }),
    ).toBeTruthy()
  })

  it('guards against invalid query payload shape and degrades to empty state', () => {
    mocks.queryResult = {
      data: {
        documents: [{ malformed: true }],
        blocks: 'invalid',
      },
      isLoading: false,
    }

    expect(() => {
      renderDialog()
    }).not.toThrow()
    expect(screen.getByText('No results found.')).toBeTruthy()
  })
})
