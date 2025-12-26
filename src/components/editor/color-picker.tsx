import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface ColorOption {
  name: string
  value: string
}

const HIGHLIGHT_COLORS: Array<ColorOption> = [
  { name: 'None', value: '' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Purple', value: '#ddd6fe' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Red', value: '#fecaca' },
  { name: 'Orange', value: '#fed7aa' },
  { name: 'Gray', value: '#e5e7eb' },
]

const TEXT_COLORS: Array<ColorOption> = [
  { name: 'Default', value: '' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Yellow', value: '#ca8a04' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#9333ea' },
  { name: 'Pink', value: '#db2777' },
]

interface ColorPickerProps {
  type: 'highlight' | 'text'
  currentColor: string | null
  onSelectColor: (color: string | null) => void
  icon: React.ReactNode
}

export function ColorPicker({
  type,
  currentColor,
  onSelectColor,
  icon,
}: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const colors = type === 'highlight' ? HIGHLIGHT_COLORS : TEXT_COLORS

  const handleSelectColor = (color: string | null) => {
    onSelectColor(color)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`bubble-menu-button color-picker-trigger ${currentColor ? 'is-active' : ''}`}
          title={type === 'highlight' ? 'Highlight' : 'Text color'}
        >
          <span className="color-picker-icon">
            {icon}
            {currentColor && (
              <span
                className="color-indicator"
                style={{
                  backgroundColor:
                    type === 'highlight' ? currentColor : 'transparent',
                  borderBottomColor:
                    type === 'text' ? currentColor : 'transparent',
                }}
              />
            )}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="color-picker-popover"
        align="start"
        sideOffset={8}
      >
        <div className="color-picker-header">
          {type === 'highlight' ? 'Highlight' : 'Text color'}
        </div>
        <div className="color-picker-grid">
          {colors.map((color) => {
            const isNone = !color.value
            const isSelected = isNone
              ? !currentColor
              : currentColor === color.value

            return (
              <button
                key={color.name}
                type="button"
                className={`color-swatch ${isSelected ? 'is-selected' : ''} ${isNone ? 'is-none' : ''}`}
                style={{
                  backgroundColor:
                    type === 'highlight' && color.value
                      ? color.value
                      : 'var(--popover)',
                  color:
                    type === 'text'
                      ? color.value || 'var(--foreground)'
                      : undefined,
                }}
                onClick={() => handleSelectColor(color.value || null)}
                title={color.name}
              >
                {type === 'text' && (
                  <span className="text-swatch-letter">A</span>
                )}
                {type === 'highlight' && isNone && (
                  <X className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
            )
          })}
        </div>
        {currentColor && (
          <button
            type="button"
            className="color-picker-remove"
            onClick={() => handleSelectColor(null)}
          >
            <X className="h-3 w-3" />
            Remove {type === 'highlight' ? 'highlight' : 'color'}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
