import type { Doc } from '../../../../convex/_generated/dataModel'

export interface SelectOption {
  id: string
  label: string
  color?: string
}

export interface BaseColumn {
  id: string
  name: string
  width?: number
}

export interface TextColumn extends BaseColumn {
  type: 'text'
}

export interface NumberColumn extends BaseColumn {
  type: 'number'
}

export interface SelectColumn extends BaseColumn {
  type: 'select'
  options: Array<SelectOption>
}

export interface DateColumn extends BaseColumn {
  type: 'date'
}

export type Column = TextColumn | NumberColumn | SelectColumn | DateColumn

export type ColumnType = Column['type']

// Type for columns as stored in Convex (options always optional at DB level)
export interface RawColumn {
  id: string
  name: string
  type: string
  options?: Array<{ id: string; label: string; color?: string }>
  width?: number
}

// Convert raw columns from Convex to strict discriminated union
export function toColumn(raw: RawColumn): Column {
  const base = { id: raw.id, name: raw.name, width: raw.width }
  switch (raw.type) {
    case 'text':
      return { ...base, type: 'text' }
    case 'number':
      return { ...base, type: 'number' }
    case 'date':
      return { ...base, type: 'date' }
    case 'select':
      return { ...base, type: 'select', options: raw.options ?? [] }
    default:
      console.warn(
        `Unknown column type "${raw.type}" for column "${raw.name}" (id: ${raw.id}). Defaulting to text.`,
      )
      return { ...base, type: 'text' }
  }
}

// Create a new column with proper defaults for each type
export function createColumn(
  type: ColumnType,
  base: Omit<BaseColumn, 'type'>,
): Column {
  switch (type) {
    case 'text':
      return { ...base, type: 'text' }
    case 'number':
      return { ...base, type: 'number' }
    case 'date':
      return { ...base, type: 'date' }
    case 'select':
      return { ...base, type: 'select', options: [] }
  }
}

// Change column type, preserving base properties
export function changeColumnType(column: Column, newType: ColumnType): Column {
  if (column.type === newType) return column
  const base = { id: column.id, name: column.name, width: column.width }
  return createColumn(newType, base)
}

// Rename a column while preserving its discriminated union type
export function renameColumn(column: Column, newName: string): Column {
  return { ...column, name: newName }
}

// Filter operators by column type
export type TextFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'isEmpty'
  | 'isNotEmpty'

export type NumberFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'isEmpty'
  | 'isNotEmpty'

export type SelectFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'isEmpty'
  | 'isNotEmpty'

export type DateFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'gt'
  | 'lt'
  | 'isEmpty'
  | 'isNotEmpty'

export type FilterOperator =
  | TextFilterOperator
  | NumberFilterOperator
  | SelectFilterOperator
  | DateFilterOperator

export interface Filter {
  columnId: string
  operator: FilterOperator
  value: CellValue
}

// Type for filters as stored in Convex (looser types)
export interface RawFilter {
  columnId: string
  operator: string
  value: unknown
}

const VALID_OPERATORS = new Set<FilterOperator>([
  'equals',
  'notEquals',
  'contains',
  'notContains',
  'isEmpty',
  'isNotEmpty',
  'gt',
  'lt',
  'gte',
  'lte',
])

// Convert raw filter from Convex to strict typed filter
export function toFilter(raw: RawFilter): Filter {
  const isValidOperator = VALID_OPERATORS.has(raw.operator as FilterOperator)
  if (!isValidOperator) {
    console.warn(
      `Unknown filter operator "${raw.operator}" for column "${raw.columnId}". Defaulting to equals.`,
    )
  }
  return {
    columnId: raw.columnId,
    operator: isValidOperator ? (raw.operator as FilterOperator) : 'equals',
    value: raw.value as CellValue,
  }
}

export interface Sort {
  columnId: string
  direction: 'asc' | 'desc'
}

export type DatabaseSchema = Doc<'databaseSchemas'>
export type DatabaseRow = Doc<'databaseRows'> & {
  /** True when this row is an optimistic placeholder pending server confirmation */
  isOptimistic?: boolean
}

// Cell value types
export type CellValue = string | number | null | undefined
