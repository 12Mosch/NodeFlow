import { useCallback, useEffect, useState } from 'react'
import { BubbleMenu } from '@tiptap/react/menus'
import { useCurrentEditor } from '@tiptap/react'
import {
  Bold,
  Code,
  Highlighter,
  Italic,
  Palette,
  Strikethrough,
  Unlink,
} from 'lucide-react'
import { BlockTypeMenu } from './block-type-menu'
import { ColorPicker } from './color-picker'
import { LinkPopover } from './link-popover'

function selectionContainsMark(
  editor: NonNullable<ReturnType<typeof useCurrentEditor>['editor']>,
  markName: string,
) {
  const { state } = editor
  const { from, to, empty } = state.selection

  // Cursor selection: check active marks at the cursor position
  if (empty) {
    return editor.isActive(markName)
  }

  let found = false
  state.doc.nodesBetween(from, to, (node) => {
    if (found) return false
    if (!node.isText) return
    if (node.marks.some((m) => m.type.name === markName)) {
      found = true
      return false
    }
  })

  return found
}

export function EditorBubbleMenu() {
  const { editor } = useCurrentEditor()

  const currentHighlight = editor?.getAttributes('highlight').color as
    | string
    | undefined
  const currentTextColor = editor?.getAttributes('textStyle').color as
    | string
    | undefined

  const [hasLinkInSelection, setHasLinkInSelection] = useState(false)

  const handleHighlightChange = useCallback(
    (color: string | null) => {
      if (!editor) return
      if (color) {
        editor.chain().focus().setHighlight({ color }).run()
      } else {
        editor.chain().focus().unsetHighlight().run()
      }
    },
    [editor],
  )

  const handleTextColorChange = useCallback(
    (color: string | null) => {
      if (!editor) return
      if (color) {
        editor.chain().focus().setColor(color).run()
      } else {
        editor.chain().focus().unsetColor().run()
      }
    },
    [editor],
  )

  if (!editor) {
    return null
  }

  // Keep selection-dependent UI reactive (Tiptap editor object itself is stable)
  useEffect(() => {
    const recompute = () => {
      setHasLinkInSelection(selectionContainsMark(editor, 'link'))
    }

    recompute()
    editor.on('selectionUpdate', recompute)
    editor.on('transaction', recompute)

    return () => {
      editor.off('selectionUpdate', recompute)
      editor.off('transaction', recompute)
    }
  }, [editor])

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top-start',
      }}
      shouldShow={({ editor: bubbleEditor, state }) => {
        // Don't show in code blocks
        if (bubbleEditor.isActive('codeBlock')) {
          return false
        }

        // Only show when there's a text selection
        const { from, to } = state.selection
        const hasSelection = from !== to

        return hasSelection
      }}
      className="bubble-menu"
    >
      {/* Block type dropdown */}
      <BlockTypeMenu editor={editor} />

      <div className="bubble-menu-divider" />

      {/* Text formatting buttons */}
      <div className="bubble-menu-group">
        <button
          type="button"
          className={`bubble-menu-button ${editor.isActive('bold') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
          aria-pressed={editor.isActive('bold')}
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`bubble-menu-button ${editor.isActive('italic') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
          aria-pressed={editor.isActive('italic')}
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`bubble-menu-button ${editor.isActive('strike') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
          aria-pressed={editor.isActive('strike')}
        >
          <Strikethrough className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`bubble-menu-button ${editor.isActive('code') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Code"
          aria-pressed={editor.isActive('code')}
        >
          <Code className="h-4 w-4" />
        </button>
      </div>

      <div className="bubble-menu-divider" />

      {/* Color pickers */}
      <div className="bubble-menu-group">
        <ColorPicker
          type="highlight"
          currentColor={currentHighlight ?? null}
          onSelectColor={handleHighlightChange}
          icon={<Highlighter className="h-4 w-4" />}
        />
        <ColorPicker
          type="text"
          currentColor={currentTextColor ?? null}
          onSelectColor={handleTextColorChange}
          icon={<Palette className="h-4 w-4" />}
        />
      </div>

      <div className="bubble-menu-divider" />

      {/* Link button */}
      <div className="bubble-menu-group">
        <LinkPopover editor={editor} />
        {hasLinkInSelection && (
          <button
            type="button"
            className="bubble-menu-button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            title="Remove link"
            aria-label="Remove link"
          >
            <Unlink className="h-4 w-4" />
          </button>
        )}
      </div>
    </BubbleMenu>
  )
}
