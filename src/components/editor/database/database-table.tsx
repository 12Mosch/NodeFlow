import { useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronDown,
  Hash,
  List,
  MoreHorizontal,
  Plus,
  Trash2,
  Type,
} from 'lucide-react'
import { DatabaseCell } from './database-cell'
import { changeColumnType, createColumn, renameColumn } from './types'
import type { Column, ColumnType, DatabaseRow, Sort } from './types'
import type { Id } from '../../../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DatabaseTableProps {
  columns: Array<Column>
  rows: Array<DatabaseRow>
  sort?: Sort | null
  onCellChange: (
    rowId: Id<'databaseRows'>,
    columnId: string,
    value: unknown,
  ) => void
  onDeleteRow: (rowId: Id<'databaseRows'>) => void
  onColumnsChange: (columns: Array<Column>) => void
  onDeleteColumn?: (columnId: string) => void
  onSortChange?: (sort: Sort | null) => void
}

const COLUMN_TYPE_ICONS = {
  text: Type,
  number: Hash,
  select: List,
  date: Calendar,
}

const COLUMN_TYPES = [
  { type: 'text' as const, label: 'Text', icon: Type },
  { type: 'number' as const, label: 'Number', icon: Hash },
  { type: 'select' as const, label: 'Select', icon: List },
  { type: 'date' as const, label: 'Date', icon: Calendar },
]

export function DatabaseTable({
  columns,
  rows,
  sort,
  onCellChange,
  onDeleteRow,
  onColumnsChange,
  onDeleteColumn,
  onSortChange,
}: DatabaseTableProps) {
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editingColumnName, setEditingColumnName] = useState('')
  const commitRef = useRef<'committed' | 'canceled' | null>(null)

  const handleAddColumn = () => {
    const newColumn = createColumn('text', {
      id: crypto.randomUUID(),
      name: 'New Column',
    })
    onColumnsChange([...columns, newColumn])
  }

  const handleDeleteColumn = (columnId: string) => {
    if (onDeleteColumn) {
      // Use dedicated delete mutation which also cleans up orphaned cell data
      onDeleteColumn(columnId)
    } else {
      // Fallback to column array update (cell data remains orphaned)
      onColumnsChange(columns.filter((c) => c.id !== columnId))
    }
  }

  const handleRenameColumn = (columnId: string, newName: string) => {
    onColumnsChange(
      columns.map((c) => (c.id === columnId ? renameColumn(c, newName) : c)),
    )
  }

  const handleChangeColumnType = (columnId: string, newType: ColumnType) => {
    onColumnsChange(
      columns.map((c) =>
        c.id === columnId ? changeColumnType(c, newType) : c,
      ),
    )
  }

  const handleSort = (columnId: string) => {
    if (!onSortChange) return

    if (sort?.columnId === columnId) {
      if (sort.direction === 'asc') {
        onSortChange({ columnId, direction: 'desc' })
      } else {
        onSortChange(null)
      }
    } else {
      onSortChange({ columnId, direction: 'asc' })
    }
  }

  const startEditingColumn = (column: Column) => {
    setEditingColumnId(column.id)
    setEditingColumnName(column.name)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            {/* Drag handle column */}
            <th className="w-8 px-1 py-2" />

            {columns.map((column) => {
              const Icon = COLUMN_TYPE_ICONS[column.type]

              return (
                <th
                  key={column.id}
                  className="min-w-30 border-r border-border px-2 py-1.5 text-left font-normal"
                  style={column.width ? { width: column.width } : undefined}
                >
                  <div className="flex items-center gap-1">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />

                    {editingColumnId === column.id ? (
                      <input
                        autoFocus
                        aria-label={`Edit column name: ${column.name}`}
                        className="flex-1 bg-transparent px-1 text-sm font-medium outline-none"
                        value={editingColumnName}
                        onChange={(e) => setEditingColumnName(e.target.value)}
                        onBlur={() => {
                          if (commitRef.current === null) {
                            handleRenameColumn(column.id, editingColumnName)
                          }
                          commitRef.current = null
                          setEditingColumnId(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            commitRef.current = 'committed'
                            handleRenameColumn(column.id, editingColumnName)
                            setEditingColumnId(null)
                          }
                          if (e.key === 'Escape') {
                            commitRef.current = 'canceled'
                            setEditingColumnId(null)
                          }
                        }}
                      />
                    ) : (
                      <span
                        className="flex-1 cursor-pointer truncate px-1 text-sm font-medium"
                        onClick={() => startEditingColumn(column)}
                      >
                        {column.name}
                      </span>
                    )}

                    {sort?.columnId === column.id && (
                      <button
                        type="button"
                        onClick={() => handleSort(column.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {sort.direction === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )}
                      </button>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onClick={() => startEditingColumn(column)}
                        >
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          Property type
                        </div>
                        {COLUMN_TYPES.map((type) => (
                          <DropdownMenuItem
                            key={type.type}
                            onClick={() =>
                              handleChangeColumnType(column.id, type.type)
                            }
                          >
                            <type.icon className="mr-2 h-4 w-4" />
                            {type.label}
                            {column.type === type.type && (
                              <span className="ml-auto text-xs">✓</span>
                            )}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleSort(column.id)}>
                          {sort?.columnId === column.id ? (
                            sort.direction === 'asc' ? (
                              <>
                                <ArrowDown className="mr-2 h-4 w-4" />
                                Sort descending
                              </>
                            ) : (
                              <>Clear sort</>
                            )
                          ) : (
                            <>
                              <ArrowUp className="mr-2 h-4 w-4" />
                              Sort ascending
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDeleteColumn(column.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete column
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </th>
              )
            })}

            {/* Add column button */}
            <th className="w-10 px-1 py-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleAddColumn}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row._id}
              className="group border-b border-border hover:bg-muted/50"
            >
              {/* Row actions */}
              <td className="px-1 py-0.5">
                <div className="flex items-center opacity-0 group-hover:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => onDeleteRow(row._id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete row
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </td>

              {columns.map((column) => (
                <td
                  key={column.id}
                  className="border-r border-border px-2 py-0.5"
                >
                  <DatabaseCell
                    column={column}
                    value={row.cells?.[column.id]}
                    onChange={(value) =>
                      onCellChange(row._id, column.id, value)
                    }
                  />
                </td>
              ))}

              {/* Empty cell for add column */}
              <td className="px-1 py-0.5" />
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + 2}
                className="px-4 py-8 text-center text-muted-foreground"
              >
                No rows yet. Click "New row" to add one.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
