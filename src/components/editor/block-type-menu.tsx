import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Layers,
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

// Map for robust lookup by id instead of fragile array indices
const blockTypeById = new Map(blockTypes.map((bt) => [bt.id, bt]))

// Special block type for multiple selections
const multipleBlockType: BlockType = {
  id: 'multiple',
  label: 'Multiple',
  icon: Layers,
  isActive: () => false,
  command: () => {}, // No-op, selecting from dropdown will convert all
}

interface BlockTypeMenuProps {
  editor: Editor
}

// Map of node type names to block type IDs
const nodeTypeToBlockId: Record<
  string,
  string | ((attrs: Record<string, unknown>) => string)
> = {
  codeBlock: 'codeBlock',
  blockquote: 'blockquote',
  taskList: 'taskList',
  orderedList: 'orderedList',
  bulletList: 'bulletList',
  heading: (attrs) => `heading${attrs.level ?? 1}`,
  paragraph: 'paragraph',
}

// Block-level node types we care about (in priority order)
const blockNodeTypes = new Set([
  'codeBlock',
  'blockquote',
  'taskList',
  'orderedList',
  'bulletList',
  'heading',
  'paragraph',
])

// List types that wrap paragraphs
const listTypes = ['bulletList', 'orderedList', 'taskList'] as const

// Block types that return their type name directly
const directBlockTypes = ['blockquote', 'codeBlock'] as const

function getBlockTypeFromPos(
  state: Editor['state'],
  pos: number,
): string | null {
  const $pos = state.doc.resolve(pos)

  // Walk up from the current position to find the relevant block type
  // Check from deepest to shallowest
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth)
    const typeName = node.type.name

    // Check for list types first (they wrap paragraphs)
    if (listTypes.includes(typeName as (typeof listTypes)[number])) {
      return typeName
    }

    // Check for heading (needs level attribute)
    if (typeName === 'heading') {
      return `heading${node.attrs.level ?? 1}`
    }

    // Check for other block types that return their name directly
    if (
      directBlockTypes.includes(typeName as (typeof directBlockTypes)[number])
    ) {
      return typeName
    }
  }

  // Default to paragraph
  return 'paragraph'
}

function getActiveBlockType(editor: Editor): BlockType {
  const { state } = editor
  const { from, to } = state.selection

  // For single position (cursor), just get the block type at that position
  if (from === to) {
    const typeId = getBlockTypeFromPos(state, from)
    const found = blockTypes.find((bt) => bt.id === typeId)
    return found ?? blockTypes[0]
  }

  // For range selection, collect block types at multiple positions
  const blockTypeIds = new Set<string>()

  // Get block type at start
  const startType = getBlockTypeFromPos(state, from)
  if (startType) blockTypeIds.add(startType)

  // Get block type at end
  const endType = getBlockTypeFromPos(state, to)
  if (endType) blockTypeIds.add(endType)

  // Also check positions in between for selections spanning multiple blocks
  // Walk through top-level blocks that intersect with the selection
  state.doc.nodesBetween(from, to, (node, _pos) => {
    if (!blockNodeTypes.has(node.type.name)) {
      return true // Continue to children
    }

    const mapping = nodeTypeToBlockId[node.type.name]
    if (mapping) {
      const typeId =
        typeof mapping === 'function'
          ? mapping(node.attrs as Record<string, unknown>)
          : mapping
      // Don't add paragraph if we're inside a list (list takes precedence)
      if (
        typeId === 'paragraph' &&
        listTypes.some((t) => blockTypeIds.has(t))
      ) {
        return false // Don't descend into this paragraph
      }
      blockTypeIds.add(typeId)
    }

    // Don't descend into block nodes (we found the type)
    return false
  })

  // If multiple different block types found, return multiple indicator
  if (blockTypeIds.size > 1) {
    return multipleBlockType
  }

  // Return the single block type found
  if (blockTypeIds.size === 1) {
    const typeId = Array.from(blockTypeIds)[0]
    const found = blockTypes.find((bt) => bt.id === typeId)
    if (found) return found
  }

  // Fallback to isActive checks for edge cases
  if (editor.isActive('codeBlock'))
    return blockTypeById.get('codeBlock') ?? blockTypes[0]
  if (editor.isActive('blockquote'))
    return blockTypeById.get('blockquote') ?? blockTypes[0]
  if (editor.isActive('taskList'))
    return blockTypeById.get('taskList') ?? blockTypes[0]
  if (editor.isActive('orderedList'))
    return blockTypeById.get('orderedList') ?? blockTypes[0]
  if (editor.isActive('bulletList'))
    return blockTypeById.get('bulletList') ?? blockTypes[0]
  if (editor.isActive('heading', { level: 3 }))
    return blockTypeById.get('heading3') ?? blockTypes[0]
  if (editor.isActive('heading', { level: 2 }))
    return blockTypeById.get('heading2') ?? blockTypes[0]
  if (editor.isActive('heading', { level: 1 }))
    return blockTypeById.get('heading1') ?? blockTypes[0]
  return blockTypes[0] // paragraph/text
}

export function BlockTypeMenu({ editor }: BlockTypeMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [activeBlockType, setActiveBlockType] = useState<BlockType>(
    blockTypes[0],
  )
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Update active block type when selection or content changes
  useEffect(() => {
    const handleUpdate = () => {
      setActiveBlockType(getActiveBlockType(editor))
    }
    handleUpdate()
    editor.on('selectionUpdate', handleUpdate)
    editor.on('transaction', handleUpdate)
    return () => {
      editor.off('selectionUpdate', handleUpdate)
      editor.off('transaction', handleUpdate)
    }
  }, [editor])

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
