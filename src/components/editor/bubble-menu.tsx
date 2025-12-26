import { BubbleMenu } from '@tiptap/react/menus'
import { useCurrentEditor } from '@tiptap/react'
import { Bold, Code, Italic, Strikethrough } from 'lucide-react'
import { BlockTypeMenu } from './block-type-menu'

export function EditorBubbleMenu() {
  const { editor } = useCurrentEditor()

  if (!editor) {
    return null
  }

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
    </BubbleMenu>
  )
}
