import { useEffect, useRef } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { useMutation, useQuery } from 'convex/react'
import { Plus, Table2 } from 'lucide-react'
import { api } from '../../../../convex/_generated/api'
import { applyFilter, compareValues } from './database-view.utils'
import { DatabaseTable } from './database-table'
import { DatabaseToolbar } from './database-toolbar'
import { toColumn, toFilter } from './types'
import type { Column, Filter, Sort } from './types'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { NodeViewProps } from '@tiptap/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function DatabaseView({
  node,
  updateAttributes,
  selected,
  extension,
}: NodeViewProps) {
  // nodeId is the UUID string from the UniqueID extension
  const nodeId = node.attrs.blockId as string | undefined
  const title = node.attrs.title as string
  // Get documentId from the Database extension's options
  const documentId = extension.options.documentId as Id<'documents'> | null

  // Track whether we've started initialization to prevent duplicate calls
  const initializingRef = useRef(false)

  // Convex subscriptions
  const schema = useQuery(
    api.databaseSchemas.getByBlockId,
    nodeId && documentId ? { nodeId, documentId } : 'skip',
  )
  const rows = useQuery(
    api.databaseRows.listByDatabase,
    nodeId && documentId ? { nodeId, documentId } : 'skip',
  )

  // Mutations with optimistic updates for snappy UX
  // Convex mutations are stable, the lint rule is disabled for this file

  const createSchema = useMutation(api.databaseSchemas.create)

  const updateSchema = useMutation(
    api.databaseSchemas.update,
  ).withOptimisticUpdate((localStore, args) => {
    if (!nodeId || !documentId) return
    const currentSchema = localStore.getQuery(
      api.databaseSchemas.getByBlockId,
      {
        nodeId,
        documentId,
      },
    )
    if (!currentSchema) return

    // Apply the updates optimistically
    localStore.setQuery(
      api.databaseSchemas.getByBlockId,
      { nodeId, documentId },
      {
        ...currentSchema,
        ...(args.columns !== undefined && { columns: args.columns }),
        ...(args.filters !== undefined && { filters: args.filters }),
        ...(args.sort !== undefined && { sort: args.sort ?? undefined }),
        updatedAt: Date.now(),
      },
    )
  })

  const deleteColumn = useMutation(
    api.databaseSchemas.deleteColumn,
  ).withOptimisticUpdate((localStore, args) => {
    if (!nodeId || !documentId) return
    const currentSchema = localStore.getQuery(
      api.databaseSchemas.getByBlockId,
      {
        nodeId,
        documentId,
      },
    )
    if (!currentSchema) return

    // Remove column from schema, filters, and sort
    const newColumns = currentSchema.columns.filter(
      (c) => c.id !== args.columnId,
    )
    const newFilters = currentSchema.filters?.filter(
      (f) => f.columnId !== args.columnId,
    )
    const newSort =
      currentSchema.sort?.columnId === args.columnId
        ? undefined
        : currentSchema.sort

    localStore.setQuery(
      api.databaseSchemas.getByBlockId,
      { nodeId, documentId },
      {
        ...currentSchema,
        columns: newColumns,
        filters: newFilters,
        sort: newSort,
        updatedAt: Date.now(),
      },
    )

    // Also remove column data from rows
    const currentRows = localStore.getQuery(api.databaseRows.listByDatabase, {
      nodeId,
      documentId,
    })
    if (currentRows) {
      localStore.setQuery(
        api.databaseRows.listByDatabase,
        { nodeId, documentId },
        currentRows.map((row) => {
          if (row.cells && args.columnId in row.cells) {
            const { [args.columnId]: _, ...remainingCells } =
              row.cells as Record<string, unknown>
            return { ...row, cells: remainingCells }
          }
          return row
        }),
      )
    }
  })

  const createRow = useMutation(api.databaseRows.create).withOptimisticUpdate(
    (localStore, args) => {
      if (!nodeId || !documentId) return
      const currentRows = localStore.getQuery(api.databaseRows.listByDatabase, {
        nodeId,
        documentId,
      })
      if (currentRows === undefined) return

      const now = Date.now()
      const maxPosition =
        currentRows.length > 0
          ? Math.max(...currentRows.map((r) => r.position))
          : -1

      // Add optimistic row with placeholder ID and isOptimistic flag
      // The isOptimistic flag prevents edits until the real ID resolves
      // Cast needed because we're adding client-only isOptimistic field
      const optimisticRow = {
        _id: `optimistic-${now}` as Id<'databaseRows'>,
        _creationTime: now,
        databaseBlockId: 'placeholder' as Id<'blocks'>,
        documentId,
        userId: 'placeholder' as Id<'users'>,
        position: maxPosition + 1,
        cells: args.cells ?? {},
        createdAt: now,
        updatedAt: now,
        isOptimistic: true,
      } as (typeof currentRows)[number]

      localStore.setQuery(
        api.databaseRows.listByDatabase,
        { nodeId, documentId },
        [...currentRows, optimisticRow],
      )
    },
  )

  const updateCell = useMutation(
    api.databaseRows.updateCell,
  ).withOptimisticUpdate((localStore, args) => {
    if (!nodeId || !documentId) return
    const currentRows = localStore.getQuery(api.databaseRows.listByDatabase, {
      nodeId,
      documentId,
    })
    if (currentRows === undefined) return

    // Update the specific row's cell value
    localStore.setQuery(
      api.databaseRows.listByDatabase,
      { nodeId, documentId },
      currentRows.map((row) =>
        row._id === args.rowId
          ? {
              ...row,
              cells: {
                ...(row.cells as Record<string, unknown>),
                [args.columnId]: args.value,
              },
              updatedAt: Date.now(),
            }
          : row,
      ),
    )
  })

  const deleteRow = useMutation(api.databaseRows.delete_).withOptimisticUpdate(
    (localStore, args) => {
      if (!nodeId || !documentId) return
      const currentRows = localStore.getQuery(api.databaseRows.listByDatabase, {
        nodeId,
        documentId,
      })
      if (currentRows === undefined) return

      // Filter out the deleted row
      localStore.setQuery(
        api.databaseRows.listByDatabase,
        { nodeId, documentId },
        currentRows.filter((row) => row._id !== args.rowId),
      )
    },
  )

  // Initialize schema when block is first created
  useEffect(() => {
    if (nodeId && documentId && schema === null && !initializingRef.current) {
      initializingRef.current = true
      createSchema({
        nodeId,
        documentId,
        columns: [
          {
            id: crypto.randomUUID(),
            name: 'Name',
            type: 'text',
          },
        ],
      }).catch((error) => {
        // Reset on failure to allow retry on transient errors
        initializingRef.current = false
        console.error(error)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, documentId, schema])

  // Derive columns, filters, sort from schema
  const schemaId = schema?._id
  const columns: Array<Column> = (schema?.columns ?? []).map(toColumn)
  const filters: Array<Filter> = (schema?.filters ?? []).map(toFilter)
  const sort: Sort | null = schema?.sort ?? null

  // Apply filters and sorting client-side
  const displayRows = (() => {
    if (!rows) return []

    let result = [...rows]

    // Apply filters
    for (const filter of filters) {
      const column = columns.find((c) => c.id === filter.columnId)
      if (!column) continue

      result = result.filter((row) => {
        const cellValue = row.cells?.[filter.columnId]
        return applyFilter(
          cellValue,
          filter.operator,
          filter.value,
          column.type,
        )
      })
    }

    // Apply sorting
    if (sort) {
      const column = columns.find((c) => c.id === sort.columnId)
      if (column) {
        result.sort((a, b) => {
          const aVal = a.cells?.[sort.columnId]
          const bVal = b.cells?.[sort.columnId]
          const comparison = compareValues(aVal, bVal, column.type)
          return sort.direction === 'asc' ? comparison : -comparison
        })
      }
    }

    return result
  })()

  const handleTitleChange = (newTitle: string) => {
    updateAttributes({ title: newTitle })
  }

  const handleAddRow = async () => {
    if (!nodeId || !documentId || !schemaId) return
    try {
      await createRow({
        nodeId,
        documentId,
        cells: {},
      })
    } catch (error) {
      console.error('Failed to add row:', error)
    }
  }

  const handleCellChange = async (
    rowId: Id<'databaseRows'>,
    columnId: string,
    value: unknown,
  ) => {
    // Don't send updates for optimistic rows - they don't exist on the server yet
    // Optimistic rows have IDs starting with 'optimistic-'
    if ((rowId as string).startsWith('optimistic-')) {
      return
    }
    try {
      await updateCell({ rowId, columnId, value })
    } catch (error) {
      console.error('Failed to update cell:', error)
    }
  }

  const handleDeleteRow = async (rowId: Id<'databaseRows'>) => {
    // Don't attempt to delete optimistic rows - they don't exist on the server yet
    if ((rowId as string).startsWith('optimistic-')) {
      return
    }
    try {
      await deleteRow({ rowId })
    } catch (error) {
      console.error('Failed to delete row:', error)
    }
  }

  const handleFiltersChange = async (newFilters: Array<Filter>) => {
    if (!schemaId) return
    try {
      // Convert undefined values to null for Convex validation
      const sanitizedFilters = newFilters.map((f) => ({
        ...f,
        value: f.value ?? null,
      }))
      await updateSchema({
        schemaId,
        filters: sanitizedFilters,
      })
    } catch (error) {
      console.error('Failed to update filters:', error)
    }
  }

  const handleSortChange = async (newSort: Sort | null) => {
    if (!schemaId) return
    try {
      await updateSchema({
        schemaId,
        sort: newSort,
      })
    } catch (error) {
      console.error('Failed to update sort:', error)
    }
  }

  const handleColumnsChange = async (newColumns: Array<Column>) => {
    if (!schemaId) return
    try {
      await updateSchema({
        schemaId,
        columns: newColumns,
      })
    } catch (error) {
      console.error('Failed to update columns:', error)
    }
  }

  const handleDeleteColumn = async (columnId: string) => {
    if (!schemaId) return
    try {
      await deleteColumn({
        schemaId,
        columnId,
      })
    } catch (error) {
      console.error('Failed to delete column:', error)
    }
  }

  // Loading state
  if (!nodeId || !documentId) {
    return (
      <NodeViewWrapper className="database-wrapper">
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <Table2 className="mr-2 h-4 w-4" />
          Initializing database...
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper
      className={`database-wrapper my-4 ${selected ? 'ring-2 ring-primary ring-offset-2' : ''}`}
    >
      <div
        contentEditable={false}
        className="database-container rounded-lg border border-border bg-card"
      >
        {/* Title */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Table2 className="h-4 w-4 text-muted-foreground" />
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="h-7 border-none bg-transparent px-1 text-base font-medium shadow-none focus-visible:ring-0"
            placeholder="Untitled Database"
          />
        </div>

        {/* Toolbar */}
        {schema && (
          <DatabaseToolbar
            columns={columns}
            filters={filters}
            sort={sort}
            onFiltersChange={handleFiltersChange}
            onSortChange={handleSortChange}
          />
        )}

        {/* Table */}
        {schema && (
          <DatabaseTable
            columns={columns}
            rows={displayRows}
            sort={sort}
            onCellChange={handleCellChange}
            onDeleteRow={handleDeleteRow}
            onColumnsChange={handleColumnsChange}
            onDeleteColumn={handleDeleteColumn}
            onSortChange={handleSortChange}
          />
        )}

        {/* Add Row Button */}
        <div className="border-t border-border px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-muted-foreground hover:text-foreground"
            onClick={handleAddRow}
          >
            <Plus className="mr-1 h-3 w-3" />
            New row
          </Button>
        </div>
      </div>
    </NodeViewWrapper>
  )
}
