import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'
import type { Editor } from '@tiptap/core'
import type { SlashCommand } from '@/extensions/slash-commands'

export interface SlashMenuRef {
  onKeyDown: (event: KeyboardEvent) => boolean
}

interface SlashMenuProps {
  editor: Editor
  items: Array<SlashCommand>
  command: (item: SlashCommand) => void
}

export const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index]
        command(item)
      },
      [command, items],
    )

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1))
          return true
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1))
          return true
        }

        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }

        return false
      },
    }))

    if (items.length === 0) {
      return (
        <div className="slash-menu">
          <div className="slash-menu-empty">No results</div>
        </div>
      )
    }

    // Group items by category
    const categories = [
      { key: 'text', label: 'Text' },
      { key: 'headings', label: 'Headings' },
      { key: 'lists', label: 'Lists' },
      { key: 'other', label: 'Other' },
    ] as const

    // Track global index for selection
    let globalIndex = -1

    return (
      <div className="slash-menu">
        {categories.map((category) => {
          const categoryItems = items.filter(
            (item) => item.category === category.key,
          )
          if (categoryItems.length === 0) return null

          return (
            <div key={category.key} className="slash-menu-category">
              <div className="slash-menu-category-label">{category.label}</div>
              {categoryItems.map((item) => {
                globalIndex++
                const currentIndex = globalIndex
                const Icon = item.icon

                return (
                  <button
                    key={item.title}
                    type="button"
                    className={`slash-menu-item ${
                      currentIndex === selectedIndex ? 'is-selected' : ''
                    }`}
                    onClick={() => selectItem(currentIndex)}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                  >
                    <div className="slash-menu-item-icon">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="slash-menu-item-content">
                      <div className="slash-menu-item-title">{item.title}</div>
                      <div className="slash-menu-item-description">
                        {item.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    )
  },
)

SlashMenu.displayName = 'SlashMenu'
