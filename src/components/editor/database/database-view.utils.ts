/**
 * Safely parse a date value, returning null for invalid dates.
 */
export function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = new Date(value as string)
  return Number.isNaN(date.getTime()) ? null : date
}

export function applyFilter(
  value: unknown,
  operator: string,
  filterValue: unknown,
  columnType: string,
): boolean {
  if (operator === 'isEmpty') {
    return value === null || value === undefined || value === ''
  }
  if (operator === 'isNotEmpty') {
    return value !== null && value !== undefined && value !== ''
  }

  if (value === null || value === undefined) return false

  switch (operator) {
    case 'equals':
      return value === filterValue
    case 'notEquals':
      return value !== filterValue
    case 'contains':
      return String(value)
        .toLowerCase()
        .includes(String(filterValue).toLowerCase())
    case 'notContains':
      return !String(value)
        .toLowerCase()
        .includes(String(filterValue).toLowerCase())
    case 'gt':
      if (columnType === 'number') return Number(value) > Number(filterValue)
      if (columnType === 'date') {
        const dateVal = parseDate(value)
        const filterDateVal = parseDate(filterValue)
        if (!dateVal || !filterDateVal) return false
        return dateVal > filterDateVal
      }
      return String(value) > String(filterValue)
    case 'lt':
      if (columnType === 'number') return Number(value) < Number(filterValue)
      if (columnType === 'date') {
        const dateVal = parseDate(value)
        const filterDateVal = parseDate(filterValue)
        if (!dateVal || !filterDateVal) return false
        return dateVal < filterDateVal
      }
      return String(value) < String(filterValue)
    case 'gte':
      if (columnType === 'number') return Number(value) >= Number(filterValue)
      if (columnType === 'date') {
        const dateVal = parseDate(value)
        const filterDateVal = parseDate(filterValue)
        if (!dateVal || !filterDateVal) return false
        return dateVal >= filterDateVal
      }
      return String(value) >= String(filterValue)
    case 'lte':
      if (columnType === 'number') return Number(value) <= Number(filterValue)
      if (columnType === 'date') {
        const dateVal = parseDate(value)
        const filterDateVal = parseDate(filterValue)
        if (!dateVal || !filterDateVal) return false
        return dateVal <= filterDateVal
      }
      return String(value) <= String(filterValue)
    default:
      return true
  }
}

export function compareValues(
  a: unknown,
  b: unknown,
  columnType: string,
): number {
  if (a === b) return 0
  // Nullish values sort first; invalid date strings are handled separately below.
  if (a === null || a === undefined) return -1
  if (b === null || b === undefined) return 1

  switch (columnType) {
    case 'number':
      return Number(a) - Number(b)
    case 'date': {
      const dateA = parseDate(a)
      const dateB = parseDate(b)
      // Sort invalid dates to the end.
      if (!dateA && !dateB) return 0
      if (!dateA) return 1
      if (!dateB) return -1
      return dateA.getTime() - dateB.getTime()
    }
    default:
      return String(a).localeCompare(String(b))
  }
}
