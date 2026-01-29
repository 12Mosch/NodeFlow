import { useState } from 'react'
import { Filter, Plus, SortAsc, X } from 'lucide-react'
import type {
  Column,
  FilterOperator,
  Filter as FilterType,
  Sort,
} from './types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DatabaseToolbarProps {
  columns: Array<Column>
  filters: Array<FilterType>
  sort: Sort | null
  onFiltersChange: (filters: Array<FilterType>) => void
  onSortChange: (sort: Sort | null) => void
}

const FILTER_OPERATORS: Record<
  string,
  Array<{ value: FilterOperator; label: string }>
> = {
  text: [
    { value: 'equals', label: 'equals' },
    { value: 'notEquals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
    { value: 'notContains', label: 'does not contain' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'isNotEmpty', label: 'is not empty' },
  ],
  number: [
    { value: 'equals', label: '=' },
    { value: 'notEquals', label: '≠' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'isNotEmpty', label: 'is not empty' },
  ],
  select: [
    { value: 'equals', label: 'is' },
    { value: 'notEquals', label: 'is not' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'isNotEmpty', label: 'is not empty' },
  ],
  date: [
    { value: 'equals', label: 'is' },
    { value: 'notEquals', label: 'is not' },
    { value: 'gt', label: 'is after' },
    { value: 'lt', label: 'is before' },
    { value: 'isEmpty', label: 'is empty' },
    { value: 'isNotEmpty', label: 'is not empty' },
  ],
}

export function DatabaseToolbar({
  columns,
  filters,
  sort,
  onFiltersChange,
  onSortChange,
}: DatabaseToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false)

  const getDefaultOperatorForType = (columnType: string): FilterOperator => {
    switch (columnType) {
      case 'text':
        return 'contains'
      case 'number':
        return 'equals'
      case 'select':
        return 'equals'
      case 'date':
        return 'equals'
      default:
        return 'equals'
    }
  }

  const handleAddFilter = () => {
    if (columns.length === 0) return
    const column = columns[0]
    const newFilter: FilterType = {
      columnId: column.id,
      operator: getDefaultOperatorForType(column.type),
      value: '',
    }
    onFiltersChange([...filters, newFilter])
  }

  const handleUpdateFilter = (index: number, updates: Partial<FilterType>) => {
    const newFilters = [...filters]
    const currentFilter = newFilters[index]
    let finalUpdates = { ...updates }

    // If column is changing, check if operator needs to be reset
    if (updates.columnId && updates.columnId !== currentFilter.columnId) {
      const currentColumn = getColumnById(currentFilter.columnId)
      const newColumn = getColumnById(updates.columnId)

      if (newColumn && currentColumn?.type !== newColumn.type) {
        const newOperators = FILTER_OPERATORS[newColumn.type]
        const currentOperatorValid = newOperators.some(
          (op) => op.value === currentFilter.operator,
        )

        if (!currentOperatorValid) {
          // Reset to first operator of new type
          finalUpdates = {
            ...finalUpdates,
            operator: newOperators[0].value,
            value: '',
          }
        }
      }
    }

    newFilters[index] = { ...currentFilter, ...finalUpdates }
    onFiltersChange(newFilters)
  }

  const handleRemoveFilter = (index: number) => {
    onFiltersChange(filters.filter((_, i) => i !== index))
  }

  const handleClearFilters = () => {
    onFiltersChange([])
  }

  const handleClearSort = () => {
    onSortChange(null)
  }

  const getColumnById = (id: string) => columns.find((c) => c.id === id)

  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
      {/* Filter Button */}
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 gap-1.5 ${filters.length > 0 ? 'text-primary' : ''}`}
            />
          }
        >
          <Filter className="h-3.5 w-3.5" />
          Filter
          {filters.length > 0 && (
            <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs">
              {filters.length}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-96 p-3" align="start">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Filters</span>
              {filters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={handleClearFilters}
                >
                  Clear all
                </Button>
              )}
            </div>

            {filters.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No filters applied.
              </p>
            ) : (
              <div className="space-y-2">
                {filters.map((filter, index) => {
                  const column = getColumnById(filter.columnId)
                  const operators = column
                    ? FILTER_OPERATORS[column.type]
                    : FILTER_OPERATORS.text
                  const needsValue = !['isEmpty', 'isNotEmpty'].includes(
                    filter.operator,
                  )

                  return (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded-md border border-border p-2"
                    >
                      {/* Column selector */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 min-w-20 justify-start"
                            />
                          }
                        >
                          {column?.name ?? 'Select'}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {columns.map((col) => (
                            <DropdownMenuItem
                              key={col.id}
                              onClick={() =>
                                handleUpdateFilter(index, { columnId: col.id })
                              }
                            >
                              {col.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Operator selector */}
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 min-w-24 justify-start"
                            />
                          }
                        >
                          {operators.find((o) => o.value === filter.operator)
                            ?.label ?? filter.operator}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {operators.map((op) => (
                            <DropdownMenuItem
                              key={op.value}
                              onClick={() =>
                                handleUpdateFilter(index, {
                                  operator: op.value,
                                })
                              }
                            >
                              {op.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Value input */}
                      {needsValue && (
                        <Input
                          value={String(filter.value ?? '')}
                          onChange={(e) =>
                            handleUpdateFilter(index, { value: e.target.value })
                          }
                          placeholder="Value..."
                          className="h-7 flex-1"
                        />
                      )}

                      {/* Remove filter */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleRemoveFilter(index)}
                        aria-label="Remove filter"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full gap-1"
              onClick={handleAddFilter}
            >
              <Plus className="h-3 w-3" />
              Add filter
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Sort indicator */}
      {sort && (
        <div className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm">
          <SortAsc className="h-3.5 w-3.5" />
          <span>
            {getColumnById(sort.columnId)?.name} ({sort.direction})
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={handleClearSort}
            aria-label="Clear sort"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Active filters pills */}
      {filters.length > 0 && (
        <div className="flex items-center gap-1">
          {filters.slice(0, 2).map((filter, index) => {
            const column = getColumnById(filter.columnId)
            return (
              <div
                key={index}
                className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
              >
                <span>{column?.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4"
                  onClick={() => handleRemoveFilter(index)}
                  aria-label={`Remove ${column?.name} filter`}
                >
                  <X className="h-2.5 w-2.5" />
                </Button>
              </div>
            )
          })}
          {filters.length > 2 && (
            <span className="text-xs text-muted-foreground">
              +{filters.length - 2} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}
