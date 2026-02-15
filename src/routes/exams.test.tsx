import { createElement } from 'react'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Route } from './exams'
import type { ReactNode } from 'react'
import { buildDocumentListResult } from '@/test/fixtures/documents'
import { examsFixture } from '@/test/fixtures/exams'
import { renderWithQuery } from '@/test/render-with-query'

const mocks = vi.hoisted(() => {
  return {
    selectedExamDate: new Date(2026, 1, 20),
    suspenseQueryMock: vi.fn(),
    useDocumentListMock: vi.fn(),
    optimisticMutationCallMock: vi.fn((_args: unknown) =>
      Promise.resolve(undefined),
    ),
  }
})

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')

  return {
    ...actual,
    useSuspenseQuery: (...args: Array<unknown>) =>
      mocks.suspenseQueryMock(...args),
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

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock('@/hooks/use-document-list', () => ({
  useDocumentList: (...args: Array<unknown>) =>
    mocks.useDocumentListMock(...args),
}))

vi.mock('@/components/mode-toggle', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    ModeToggle: () => reactCreateElement('span', {}, 'mode-toggle'),
  }
})

vi.mock('@/components/ui/dialog', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? reactCreateElement('div', {}, children) : null,
    DialogContent: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
    DialogFooter: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
    DialogHeader: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
    DialogTitle: ({ children }: { children: ReactNode }) =>
      reactCreateElement('h2', {}, children),
  }
})

vi.mock('@/components/ui/tabs', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    Tabs: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
    TabsList: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
    TabsTrigger: ({ children }: { children: ReactNode }) =>
      reactCreateElement('button', { type: 'button' }, children),
    TabsContent: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
  }
})

vi.mock('@/components/ui/dropdown-menu', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    DropdownMenu: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
    DropdownMenuTrigger: ({ children }: { children: ReactNode }) =>
      reactCreateElement('button', { type: 'button' }, children),
    DropdownMenuContent: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
    DropdownMenuItem: ({ children }: { children: ReactNode }) =>
      reactCreateElement('button', { type: 'button' }, children),
  }
})

vi.mock('@/components/ui/alert-dialog', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    AlertDialog: ({
      open,
      children,
    }: {
      open: boolean
      children: ReactNode
    }) => (open ? reactCreateElement('div', {}, children) : null),
    AlertDialogContent: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
    AlertDialogHeader: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
    AlertDialogTitle: ({ children }: { children: ReactNode }) =>
      reactCreateElement('h3', {}, children),
    AlertDialogDescription: ({ children }: { children: ReactNode }) =>
      reactCreateElement('p', {}, children),
    AlertDialogFooter: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
    AlertDialogCancel: ({ children }: { children: ReactNode }) =>
      reactCreateElement('button', { type: 'button' }, children),
    AlertDialogAction: ({
      children,
      onClick,
    }: {
      children: ReactNode
      onClick?: () => void
    }) => reactCreateElement('button', { type: 'button', onClick }, children),
  }
})

vi.mock('@/components/ui/popover', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    Popover: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
    PopoverTrigger: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
    PopoverContent: ({ children }: { children: ReactNode }) =>
      reactCreateElement('div', {}, children),
  }
})

vi.mock('@/components/ui/calendar', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    Calendar: ({ onSelect }: { onSelect: (date: Date) => void }) =>
      reactCreateElement(
        'button',
        {
          type: 'button',
          onClick: () => onSelect(mocks.selectedExamDate),
        },
        'Select test date',
      ),
  }
})

vi.mock('@/components/ui/checkbox', async () => {
  const { createElement: reactCreateElement } = await import('react')
  return {
    Checkbox: ({
      checked,
      onCheckedChange,
    }: {
      checked: boolean
      onCheckedChange: () => void
    }) =>
      reactCreateElement('input', {
        type: 'checkbox',
        checked,
        onChange: () => onCheckedChange(),
      }),
  }
})

vi.mock('convex/react', () => ({
  useMutation: (_mutationRef: unknown) => {
    const callable = vi.fn((args: unknown) =>
      mocks.optimisticMutationCallMock(args),
    )
    const withOptimisticUpdate = vi.fn(() => callable)
    return Object.assign(callable, {
      withOptimisticUpdate,
    })
  },
}))

const ExamsRouteComponent = Route.options.component as NonNullable<
  typeof Route.options.component
>

describe('exams route smoke', () => {
  beforeEach(async () => {
    const { resetRouterMocks } = await import('@/test/mocks/router')
    resetRouterMocks()
    vi.clearAllMocks()
    mocks.suspenseQueryMock.mockReturnValue({ data: examsFixture })
    mocks.useDocumentListMock.mockReturnValue(
      buildDocumentListResult({ state: 'success' }),
    )
  })
  afterEach(() => {
    cleanup()
  })

  it('renders exams page shell without runtime errors', () => {
    expect(() => {
      renderWithQuery(createElement(ExamsRouteComponent))
    }).not.toThrow()

    expect(screen.getByText('Exams')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New Exam' })).toBeTruthy()
    expect(screen.getByText('Active (1)')).toBeTruthy()
    expect(screen.getByText('Past (0)')).toBeTruthy()
    expect(screen.getByText('Archived (0)')).toBeTruthy()
  })

  it('creates a new exam with normalized payload from dialog action', async () => {
    renderWithQuery(createElement(ExamsRouteComponent))

    fireEvent.click(screen.getAllByRole('button', { name: 'New Exam' })[0])
    expect(screen.getByText('Create exam')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: '  Final Review  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Select test date' }))
    fireEvent.change(screen.getByLabelText('Exam time'), {
      target: { value: '09:45' },
    })

    fireEvent.click(screen.getByLabelText('Biology Notes'))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    const expectedExamAt = new Date(2026, 1, 20, 9, 45, 0, 0).getTime()

    await waitFor(() => {
      expect(mocks.optimisticMutationCallMock).toHaveBeenCalledWith({
        title: 'Final Review',
        examAt: expectedExamAt,
        notes: '',
        documentIds: ['doc_1'],
      })
    })
  })

  it('renders linked-documents loading state in exam dialog', () => {
    mocks.useDocumentListMock.mockReturnValue(
      buildDocumentListResult({ state: 'loading' }),
    )

    renderWithQuery(createElement(ExamsRouteComponent))

    fireEvent.click(screen.getAllByRole('button', { name: 'New Exam' })[0])

    expect(screen.getByText('Loading documents...')).toBeTruthy()
  })

  it('renders linked-documents error state in exam dialog', () => {
    mocks.useDocumentListMock.mockReturnValue(
      buildDocumentListResult({ state: 'error' }),
    )

    renderWithQuery(createElement(ExamsRouteComponent))

    fireEvent.click(screen.getAllByRole('button', { name: 'New Exam' })[0])

    expect(screen.getByText('Failed to load documents.')).toBeTruthy()
  })

  it('renders linked-documents empty state in exam dialog', () => {
    mocks.useDocumentListMock.mockReturnValue(
      buildDocumentListResult({ state: 'empty' }),
    )

    renderWithQuery(createElement(ExamsRouteComponent))

    fireEvent.click(screen.getAllByRole('button', { name: 'New Exam' })[0])

    expect(screen.getByText('No documents available yet.')).toBeTruthy()
  })
})
