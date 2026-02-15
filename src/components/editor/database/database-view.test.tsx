import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseView } from './database-view'
import type { NodeViewProps } from '@tiptap/react'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  schemaData: undefined as unknown,
  rowsData: undefined as unknown,
  toolbarProps: undefined as unknown,
  tableProps: undefined as unknown,
  createSchemaMock: vi.fn((_args?: unknown) => Promise.resolve(undefined)),
  updateSchemaMock: vi.fn((_args?: unknown) => Promise.resolve(undefined)),
  deleteColumnMock: vi.fn((_args?: unknown) => Promise.resolve(undefined)),
  createRowMock: vi.fn((_args?: unknown) => Promise.resolve(undefined)),
  updateCellMock: vi.fn((_args?: unknown) => Promise.resolve(undefined)),
  deleteRowMock: vi.fn((_args?: unknown) => Promise.resolve(undefined)),
}))

vi.mock('@tiptap/react', () => ({
  NodeViewWrapper: ({
    children,
    className,
  }: {
    children: ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
}))

vi.mock('convex/react', async () => {
  const { getFunctionName } = await import('convex/server')

  return {
    useQuery: (queryRef: unknown, args: unknown) => {
      if (args === 'skip') {
        return undefined
      }

      const queryName = getFunctionName(
        queryRef as Parameters<typeof getFunctionName>[0],
      )
      if (queryName === 'databaseSchemas:getByBlockId') {
        return mocks.schemaData
      }
      if (queryName === 'databaseRows:listByDatabase') {
        return mocks.rowsData
      }

      throw new Error(`Unexpected query in DatabaseView test: ${queryName}`)
    },
    useMutation: (mutationRef: unknown) => {
      const mutationName = getFunctionName(
        mutationRef as Parameters<typeof getFunctionName>[0],
      )
      let target: (args: unknown) => Promise<unknown>

      if (mutationName === 'databaseSchemas:create') {
        target = (args) => mocks.createSchemaMock(args)
      } else if (mutationName === 'databaseSchemas:update') {
        target = (args) => mocks.updateSchemaMock(args)
      } else if (mutationName === 'databaseSchemas:deleteColumn') {
        target = (args) => mocks.deleteColumnMock(args)
      } else if (mutationName === 'databaseRows:create') {
        target = (args) => mocks.createRowMock(args)
      } else if (mutationName === 'databaseRows:updateCell') {
        target = (args) => mocks.updateCellMock(args)
      } else if (mutationName === 'databaseRows:delete_') {
        target = (args) => mocks.deleteRowMock(args)
      } else {
        throw new Error(
          `Unexpected mutation in DatabaseView test: ${mutationName}`,
        )
      }

      const callable = vi.fn((args: unknown) => target(args))
      const withOptimisticUpdate = vi.fn(() => callable)

      return Object.assign(callable, {
        withOptimisticUpdate,
      })
    },
  }
})

vi.mock('./database-toolbar', () => ({
  DatabaseToolbar: (props: unknown) => {
    mocks.toolbarProps = props
    return <div data-testid="database-toolbar" />
  },
}))

vi.mock('./database-table', () => ({
  DatabaseTable: (props: unknown) => {
    mocks.tableProps = props
    const typedProps = props as {
      rows: Array<unknown>
      columns: Array<unknown>
      onCellChange: (rowId: string, columnId: string, value: unknown) => void
      onDeleteRow: (rowId: string) => void
    }

    return (
      <div
        data-testid="database-table"
        data-row-count={typedProps.rows.length}
        data-column-count={typedProps.columns.length}
      >
        <button
          type="button"
          onClick={() =>
            typedProps.onCellChange('optimistic-1', 'col_1', 'Updated')
          }
        >
          Update optimistic row
        </button>
        <button
          type="button"
          onClick={() => typedProps.onDeleteRow('optimistic-1')}
        >
          Delete optimistic row
        </button>
        <button
          type="button"
          onClick={() => typedProps.onCellChange('row_1', 'col_1', 'Updated')}
        >
          Update persisted row
        </button>
        <button type="button" onClick={() => typedProps.onDeleteRow('row_1')}>
          Delete persisted row
        </button>
      </div>
    )
  },
}))

function createNodeViewProps(
  overrides?: Partial<NodeViewProps>,
): NodeViewProps {
  return {
    editor: {} as NodeViewProps['editor'],
    node: {
      attrs: {
        blockId: 'block_1',
        title: 'My Database',
      },
    } as unknown as NodeViewProps['node'],
    decorations: [],
    selected: false,
    extension: {
      options: {
        documentId: 'doc_1',
      },
    } as NodeViewProps['extension'],
    getPos: vi.fn(),
    updateAttributes: vi.fn(),
    deleteNode: vi.fn(),
    view: {} as NodeViewProps['view'],
    innerDecorations: {} as NodeViewProps['innerDecorations'],
    HTMLAttributes: {},
    ...overrides,
  } as unknown as NodeViewProps
}

describe('DatabaseView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.schemaData = {
      _id: 'schema_1',
      columns: [{ id: 'col_1', name: 'Name', type: 'text' }],
      filters: [],
      sort: null,
    }
    mocks.rowsData = [
      {
        _id: 'row_1',
        position: 0,
        cells: { col_1: 'Alpha' },
      },
    ]
    mocks.toolbarProps = undefined
    mocks.tableProps = undefined
    mocks.createSchemaMock.mockResolvedValue(undefined)
    mocks.updateSchemaMock.mockResolvedValue(undefined)
    mocks.deleteColumnMock.mockResolvedValue(undefined)
    mocks.createRowMock.mockResolvedValue(undefined)
    mocks.updateCellMock.mockResolvedValue(undefined)
    mocks.deleteRowMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it('shows initialization state when nodeId/documentId is missing', () => {
    const props = createNodeViewProps({
      node: {
        attrs: {
          title: 'My Database',
        },
      } as unknown as NodeViewProps['node'],
      extension: {
        options: {
          documentId: null,
        },
      } as NodeViewProps['extension'],
    })

    render(<DatabaseView {...props} />)

    expect(screen.getByText('Initializing database...')).toBeTruthy()
  })

  it('initializes schema once when schema query returns null', async () => {
    mocks.schemaData = null
    mocks.rowsData = []

    const props = createNodeViewProps()
    const { rerender } = render(<DatabaseView {...props} />)

    await waitFor(() => {
      expect(mocks.createSchemaMock).toHaveBeenCalledTimes(1)
    })
    expect(mocks.createSchemaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nodeId: 'block_1',
        documentId: 'doc_1',
        columns: [
          expect.objectContaining({
            name: 'Name',
            type: 'text',
          }),
        ],
      }),
    )

    rerender(<DatabaseView {...props} />)
    expect(mocks.createSchemaMock).toHaveBeenCalledTimes(1)
  })

  it('retries schema initialization after createSchema rejection on next effect pass', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    mocks.schemaData = null
    mocks.rowsData = []
    mocks.createSchemaMock
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(undefined)

    const props = createNodeViewProps()
    const { rerender } = render(<DatabaseView {...props} />)

    await waitFor(() => {
      expect(mocks.createSchemaMock).toHaveBeenCalledTimes(1)
    })

    mocks.schemaData = undefined
    rerender(<DatabaseView {...props} />)

    mocks.schemaData = null
    rerender(<DatabaseView {...props} />)

    await waitFor(() => {
      expect(mocks.createSchemaMock).toHaveBeenCalledTimes(2)
    })

    consoleErrorSpy.mockRestore()
  })

  it('wires toolbar/table props and creates rows when add-row is pressed', async () => {
    render(<DatabaseView {...createNodeViewProps()} />)

    expect(screen.getByTestId('database-toolbar')).toBeTruthy()
    expect(screen.getByTestId('database-table').dataset.columnCount).toBe('1')
    expect(screen.getByTestId('database-table').dataset.rowCount).toBe('1')
    expect(mocks.toolbarProps).toBeTruthy()
    expect(mocks.tableProps).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'New row' }))

    await waitFor(() => {
      expect(mocks.createRowMock).toHaveBeenCalledWith({
        nodeId: 'block_1',
        documentId: 'doc_1',
        cells: {},
      })
    })
  })

  it('blocks update/delete mutations for optimistic row ids', async () => {
    render(<DatabaseView {...createNodeViewProps()} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Update optimistic row' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete optimistic row' }),
    )

    expect(mocks.updateCellMock).not.toHaveBeenCalled()
    expect(mocks.deleteRowMock).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', { name: 'Update persisted row' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Delete persisted row' }),
    )

    await waitFor(() => {
      expect(mocks.updateCellMock).toHaveBeenCalledWith({
        rowId: 'row_1',
        columnId: 'col_1',
        value: 'Updated',
      })
      expect(mocks.deleteRowMock).toHaveBeenCalledWith({
        rowId: 'row_1',
      })
    })
  })

  it('keeps missing document context in guarded non-editable initialization state', () => {
    const props = createNodeViewProps({
      extension: {
        options: {
          documentId: null,
        },
      } as NodeViewProps['extension'],
    })

    render(<DatabaseView {...props} />)

    expect(screen.getByText('Initializing database...')).toBeTruthy()
    expect(mocks.createSchemaMock).not.toHaveBeenCalled()
    expect(mocks.createRowMock).not.toHaveBeenCalled()
    expect(mocks.updateCellMock).not.toHaveBeenCalled()
    expect(mocks.deleteRowMock).not.toHaveBeenCalled()
  })
})
