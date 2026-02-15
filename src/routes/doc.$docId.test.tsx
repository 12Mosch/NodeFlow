import { createElement } from 'react'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route } from './doc.$docId'
import type { ReactNode } from 'react'
import {
  blocksFixture,
  documentFixture,
  flashcardsFixture,
} from '@/test/fixtures/documents'
import { renderWithQuery } from '@/test/render-with-query'

const mocks = vi.hoisted(() => {
  const navigateMock = vi.fn()

  return {
    suspenseQueryMock: vi.fn(),
    queryMock: vi.fn(),
    isRestoringMock: vi.fn(),
    mutationMock: vi.fn(() => Promise.resolve(undefined)),
    navigateMock,
  }
})

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')

  return {
    ...actual,
    useSuspenseQuery: (...args: Array<unknown>) =>
      mocks.suspenseQueryMock(...args),
    useQuery: (...args: Array<unknown>) => mocks.queryMock(...args),
    useIsRestoring: () => mocks.isRestoringMock(),
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
    useNavigate: () => mocks.navigateMock,
    useRouter: () => routerMock,
  }
})

vi.mock('convex/react', () => ({
  useMutation: (_mutationRef: unknown) => mocks.mutationMock,
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock('@/components/tiptap-editor', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    TiptapEditor: () => reactCreateElement('div', {}, 'editor-stub'),
  }
})

vi.mock('@/components/document-learn-quiz', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    DocumentLearnQuiz: () => reactCreateElement('div', {}, 'learn-quiz-stub'),
  }
})

vi.mock('@/components/flashcards', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    FlashcardQuiz: () => reactCreateElement('div', {}, 'flashcard-quiz-stub'),
  }
})

vi.mock('@/components/share-dialog', () => ({
  ShareDialog: () => null,
}))

vi.mock('@/components/study-mode-dialog', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    StudyModeDialog: ({
      open,
      onSelectMode,
    }: {
      open: boolean
      onSelectMode: (mode: 'random' | 'spaced-repetition') => void
    }) =>
      open
        ? reactCreateElement('div', {}, [
            reactCreateElement('p', { key: 'title' }, 'Choose study mode'),
            reactCreateElement(
              'button',
              {
                key: 'random',
                onClick: () => onSelectMode('random'),
                type: 'button',
              },
              'Random mode',
            ),
            reactCreateElement(
              'button',
              {
                key: 'spaced',
                onClick: () => onSelectMode('spaced-repetition'),
                type: 'button',
              },
              'Spaced mode',
            ),
          ])
        : null,
  }
})

vi.mock('@/components/sidebar', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    DocumentSidebar: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
  }
})

vi.mock('@/components/ui/sidebar', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    SidebarInset: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
    SidebarTrigger: () =>
      reactCreateElement('button', { type: 'button' }, 'Sidebar'),
  }
})

vi.mock('@/components/mode-toggle', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    ModeToggle: () => reactCreateElement('span', {}, 'mode-toggle'),
  }
})

vi.mock('@/components/search-provider', () => ({
  useSearch: () => ({
    open: vi.fn(),
  }),
}))

vi.mock('@/hooks/use-presence', () => ({
  usePresence: () => ({
    collaborators: [],
    updateCursor: vi.fn(),
  }),
}))

vi.mock('@/components/presence/collaborator-avatars', () => ({
  CollaboratorAvatars: () => null,
}))

vi.mock('@/components/exams/document-exam-indicator', () => ({
  DocumentExamIndicatorView: () => null,
}))
const DocumentRouteComponent = Route.options.component as NonNullable<
  typeof Route.options.component
>

function getConvexQueryName(queryOptions: unknown) {
  if (typeof queryOptions !== 'object' || queryOptions === null) {
    return null
  }

  const queryKey = (queryOptions as { queryKey?: unknown }).queryKey
  if (!Array.isArray(queryKey) || typeof queryKey[1] !== 'string') {
    return null
  }

  return queryKey[1]
}

function mockDocRouteState({
  docId,
  document,
  flashcards,
}: {
  docId: string
  document: unknown
  flashcards: Array<unknown>
}) {
  vi.spyOn(Route, 'useParams').mockReturnValue({ docId })
  vi.spyOn(Route, 'useSearch').mockReturnValue({})

  mocks.isRestoringMock.mockReturnValue(false)
  mocks.suspenseQueryMock.mockReturnValue({ data: document })
  mocks.queryMock.mockImplementation((queryOptions: unknown) => {
    const queryName = getConvexQueryName(queryOptions)

    if (queryName === 'blocks:listFlashcards') return { data: flashcards }
    if (queryName === 'blocks:listByDocument') return { data: blocksFixture }
    if (queryName === 'exams:getDocumentHeaderIndicator') return { data: null }

    throw new Error(`Unexpected query in doc test: ${String(queryName)}`)
  })
}

describe('doc.$docId route smoke', () => {
  beforeEach(async () => {
    const { resetRouterMocks } = await import('@/test/mocks/router')
    resetRouterMocks()
    vi.clearAllMocks()
    mocks.mutationMock.mockResolvedValue(undefined)
  })
  afterEach(() => {
    cleanup()
  })

  it('renders the valid document view without runtime errors', () => {
    mockDocRouteState({
      docId: 'doc1',
      document: documentFixture,
      flashcards: flashcardsFixture,
    })

    expect(() => {
      renderWithQuery(createElement(DocumentRouteComponent))
    }).not.toThrow()

    expect(screen.getByText('Biology Notes')).toBeTruthy()
    expect(screen.getByText('Study')).toBeTruthy()
    expect(screen.getByText('editor-stub')).toBeTruthy()
  })

  it('opens study mode and transitions to quiz on core action', () => {
    mockDocRouteState({
      docId: 'doc1',
      document: documentFixture,
      flashcards: flashcardsFixture,
    })

    renderWithQuery(createElement(DocumentRouteComponent))

    fireEvent.click(screen.getByRole('button', { name: /Study/ }))
    expect(screen.getByText('Choose study mode')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Random mode' }))
    expect(screen.getByText('flashcard-quiz-stub')).toBeTruthy()
  })

  it('renders malformed id state for invalid route params', () => {
    vi.spyOn(Route, 'useParams').mockReturnValue({ docId: 'not/valid' })
    vi.spyOn(Route, 'useSearch').mockReturnValue({})

    renderWithQuery(createElement(DocumentRouteComponent))

    expect(screen.getByText('Malformed ID')).toBeTruthy()
    expect(
      screen.getByText('The ID "not/valid" is not a valid format.'),
    ).toBeTruthy()
  })

  it('renders suspense fallback state while document data is loading', () => {
    vi.spyOn(Route, 'useParams').mockReturnValue({ docId: 'doc1' })
    vi.spyOn(Route, 'useSearch').mockReturnValue({})
    mocks.suspenseQueryMock.mockImplementation(() => {
      throw new Promise(() => undefined)
    })

    renderWithQuery(createElement(DocumentRouteComponent))

    expect(screen.getByText('Loading document...')).toBeTruthy()
  })

  it('renders not-found state when document query is empty', () => {
    mockDocRouteState({
      docId: 'doc1',
      document: null,
      flashcards: [],
    })

    renderWithQuery(createElement(DocumentRouteComponent))

    expect(screen.getByText('Document not found')).toBeTruthy()
    expect(
      screen.getByText(
        "This document doesn't exist or you don't have access to it.",
      ),
    ).toBeTruthy()
  })

  it('initializes card states in spaced-repetition mode', () => {
    mockDocRouteState({
      docId: 'doc1',
      document: documentFixture,
      flashcards: flashcardsFixture,
    })

    renderWithQuery(createElement(DocumentRouteComponent))

    fireEvent.click(screen.getByRole('button', { name: /Study/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Spaced mode' }))

    expect(mocks.mutationMock).toHaveBeenCalledWith({ documentId: 'doc1' })
  })
})
