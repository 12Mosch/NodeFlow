import { useState } from 'react'
import { Calendar } from 'lucide-react'
import type { CellValue, Column } from './types'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface DatabaseCellProps {
  column: Column
  value: CellValue
  onChange: (value: CellValue) => void
}

export function DatabaseCell({ column, value, onChange }: DatabaseCellProps) {
  switch (column.type) {
    case 'text':
      return <TextCell value={value} onChange={onChange} />
    case 'number':
      return <NumberCell value={value} onChange={onChange} />
    case 'select':
      return (
        <SelectCell
          value={value}
          options={column.options}
          onChange={onChange}
        />
      )
    case 'date':
      return <DateCell value={value} onChange={onChange} />
    default:
      return <TextCell value={value} onChange={onChange} />
  }
}

// Text Cell
function TextCell({
  value,
  onChange,
}: {
  value: CellValue
  onChange: (value: CellValue) => void
}) {
  const [editing, setEditing] = useState(false)
  const [localValue, setLocalValue] = useState(String(value ?? ''))

  const handleBlur = () => {
    onChange(localValue)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div
        className="min-h-6 cursor-text px-1 py-0.5 text-sm"
        onClick={() => {
          setLocalValue(String(value ?? ''))
          setEditing(true)
        }}
      >
        {value ?? <span className="text-muted-foreground">Empty</span>}
      </div>
    )
  }

  return (
    <Input
      autoFocus
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleBlur()
        }
        if (e.key === 'Escape') {
          setEditing(false)
        }
      }}
      className="h-6 border-none bg-transparent px-1 py-0 text-sm shadow-none focus-visible:ring-0"
    />
  )
}

// Number Cell
function NumberCell({
  value,
  onChange,
}: {
  value: CellValue
  onChange: (value: CellValue) => void
}) {
  const [editing, setEditing] = useState(false)
  const [localValue, setLocalValue] = useState(String(value ?? ''))

  const handleBlur = () => {
    if (localValue === '') {
      onChange(null)
    } else {
      const num = Number(localValue)
      onChange(isNaN(num) ? null : num)
    }
    setEditing(false)
  }

  if (!editing) {
    return (
      <div
        className="min-h-6 cursor-text px-1 py-0.5 text-sm"
        onClick={() => {
          setLocalValue(String(value ?? ''))
          setEditing(true)
        }}
      >
        {value ?? <span className="text-muted-foreground">Empty</span>}
      </div>
    )
  }

  return (
    <Input
      autoFocus
      type="number"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleBlur()
        }
        if (e.key === 'Escape') {
          setEditing(false)
        }
      }}
      className="h-6 border-none bg-transparent px-1 py-0 text-sm shadow-none focus-visible:ring-0"
    />
  )
}

// Select Cell
function SelectCell({
  value,
  options,
  onChange,
}: {
  value: CellValue
  options: Array<{ id: string; label: string; color?: string }>
  onChange: (value: CellValue) => void
}) {
  const selectedOption = options.find((o) => o.id === value)

  // Default colors for options
  const getOptionColor = (option: { color?: string }, index: number) => {
    if (option.color) return option.color
    const colors = [
      'hsl(var(--primary))',
      'hsl(142 76% 36%)',
      'hsl(38 92% 50%)',
      'hsl(0 84% 60%)',
      'hsl(262 83% 58%)',
      'hsl(199 89% 48%)',
    ]
    return colors[index % colors.length]
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-6 w-full justify-start px-1 py-0 text-sm font-normal hover:bg-transparent"
          />
        }
      >
        {selectedOption ? (
          <Badge
            className="font-normal"
            style={{
              backgroundColor: getOptionColor(
                selectedOption,
                options.indexOf(selectedOption),
              ),
            }}
          >
            {selectedOption.label}
          </Badge>
        ) : (
          <span className="text-muted-foreground">Select...</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {options.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No options. Edit column to add options.
          </div>
        ) : (
          options.map((option, index) => (
            <DropdownMenuItem
              key={option.id}
              onClick={() => onChange(option.id)}
            >
              <Badge
                className="font-normal"
                style={{ backgroundColor: getOptionColor(option, index) }}
              >
                {option.label}
              </Badge>
            </DropdownMenuItem>
          ))
        )}
        {value && (
          <DropdownMenuItem onClick={() => onChange(null)}>
            <span className="text-muted-foreground">Clear</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Date Cell
function DateCell({
  value,
  onChange,
}: {
  value: CellValue
  onChange: (value: CellValue) => void
}) {
  const [editing, setEditing] = useState(false)

  // Format date for display
  const formatDate = (dateStr: CellValue) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) {
      return String(dateStr)
    }
    return date.toLocaleDateString()
  }

  // Format date for input
  const formatDateForInput = (dateStr: CellValue) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) {
      return ''
    }
    return date.toISOString().split('T')[0]
  }

  if (!editing) {
    return (
      <div
        className="flex min-h-6 cursor-pointer items-center gap-1 px-1 py-0.5 text-sm"
        onClick={() => setEditing(true)}
      >
        {value ? (
          formatDate(value)
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            Pick a date
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="px-1 py-0.5">
      <Input
        autoFocus
        type="date"
        value={formatDateForInput(value)}
        onChange={(e) => {
          if (e.target.value) {
            onChange(e.target.value)
          } else {
            onChange(null)
          }
        }}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setEditing(false)
          }
        }}
        className="h-6 border-none bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
      />
    </div>
  )
}
