import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Pilcrow,
  Quote,
} from 'lucide-react'
import type { Editor } from '@tiptap/core'

interface BlockType {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  isActive: (editor: Editor) => boolean
  command: (editor: Editor) => void
}

const blockTypes: Array<BlockType> = [
  {
    id: 'paragraph',
    label: 'Text',
    icon: Pilcrow,
    isActive: (editor) =>
      editor.isActive('paragraph') &&
      !editor.isActive('bulletList') &&
      !editor.isActive('orderedList') &&
      !editor.isActive('taskList'),
    command: (editor) => {
      editor.chain().focus().setParagraph().run()
    },
  },
  {
    id: 'heading1',
    label: 'Heading 1',
    icon: Heading1,
    isActive: (editor) => editor.isActive('heading', { level: 1 }),
    command: (editor) => {
      editor.chain().focus().setHeading({ level: 1 }).run()
    },
  },
  {
    id: 'heading2',
    label: 'Heading 2',
    icon: Heading2,
    isActive: (editor) => editor.isActive('heading', { level: 2 }),
    command: (editor) => {
      editor.chain().focus().setHeading({ level: 2 }).run()
    },
  },
  {
    id: 'heading3',
    label: 'Heading 3',
    icon: Heading3,
    isActive: (editor) => editor.isActive('heading', { level: 3 }),
    command: (editor) => {
      editor.chain().focus().setHeading({ level: 3 }).run()
    },
  },
  {
    id: 'bulletList',
    label: 'Bulleted list',
    icon: List,
    isActive: (editor) => editor.isActive('bulletList'),
    command: (editor) => {
      editor.chain().focus().toggleBulletList().run()
    },
  },
  {
    id: 'orderedList',
    label: 'Numbered list',
    icon: ListOrdered,
    isActive: (editor) => editor.isActive('orderedList'),
    command: (editor) => {
      editor.chain().focus().toggleOrderedList().run()
    },
  },
  {
    id: 'taskList',
    label: 'To-do list',
    icon: ListTodo,
    isActive: (editor) => editor.isActive('taskList'),
    command: (editor) => {
      editor.chain().focus().toggleTaskList().run()
    },
  },
  {
    id: 'blockquote',
    label: 'Blockquote',
    icon: Quote,
    isActive: (editor) => editor.isActive('blockquote'),
    command: (editor) => {
      editor.chain().focus().toggleBlockquote().run()
    },
  },
  {
    id: 'codeBlock',
    label: 'Code block',
    icon: Code2,
    isActive: (editor) => editor.isActive('codeBlock'),
    command: (editor) => {
      editor.chain().focus().toggleCodeBlock().run()
    },
  },
]

interface BlockTypeMenuProps {
  editor: Editor
}

export function BlockTypeMenu({ editor }: BlockTypeMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Get current active block type
  const activeBlockType =
    blockTypes.find((type) => type.isActive(editor)) ?? blockTypes[0]
  const ActiveIcon = activeBlockType.icon

  // Stable handleSelect function
  const handleSelect = useCallback(
    (blockType: BlockType) => {
      blockType.command(editor)
      setIsOpen(false)
    },
    [editor],
  )

  const handleToggleOpen = useCallback(() => {
    if (!isOpen) {
      const activeIndex = blockTypes.findIndex((type) => type.isActive(editor))
      setSelectedIndex(activeIndex >= 0 ? activeIndex : 0)
    }
    setIsOpen((prev) => !prev)
  }, [editor, isOpen])

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedIndex((prev) =>
            prev >= blockTypes.length - 1 ? 0 : prev + 1,
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          setSelectedIndex((prev) =>
            prev <= 0 ? blockTypes.length - 1 : prev - 1,
          )
          break
        case 'Enter':
          event.preventDefault()
          handleSelect(blockTypes[selectedIndex])
          break
        case 'Escape':
          event.preventDefault()
          setIsOpen(false)
          break
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, selectedIndex, handleSelect])

  return (
    <div ref={menuRef} className="block-type-menu">
      <button
        ref={buttonRef}
        type="button"
        className="block-type-trigger"
        onClick={handleToggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <ActiveIcon className="h-4 w-4" />
        <span>{activeBlockType.label}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {isOpen && (
        <div
          className="block-type-dropdown"
          role="listbox"
          aria-labelledby="block-type-dropdown-header"
          aria-activedescendant={
            blockTypes[selectedIndex]
              ? `block-type-option-${blockTypes[selectedIndex].id}`
              : undefined
          }
        >
          <div
            id="block-type-dropdown-header"
            className="block-type-dropdown-header"
          >
            Turn into
          </div>
          {blockTypes.map((blockType, index) => {
            const Icon = blockType.icon
            const isActive = blockType.isActive(editor)
            const isSelected = index === selectedIndex

            return (
              <button
                key={blockType.id}
                id={`block-type-option-${blockType.id}`}
                type="button"
                role="option"
                aria-selected={isActive}
                className={`block-type-item ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''}`}
                onClick={() => handleSelect(blockType)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <Icon className="h-4 w-4" />
                <span>{blockType.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
