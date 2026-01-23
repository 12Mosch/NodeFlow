import { useCurrentEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'
import type { ImageAlignment } from '@/extensions/image'

export function ImageBubbleMenu() {
  const { editor } = useCurrentEditor()

  if (!editor) {
    return null
  }

  const currentAlign =
    (editor.getAttributes('image').align as ImageAlignment | undefined) ??
    'center'

  const handleAlignmentChange = (alignment: ImageAlignment) => {
    editor.chain().focus().setImageAlignment(alignment).run()
  }

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top',
      }}
      shouldShow={({ editor: bubbleEditor }) => {
        return bubbleEditor.isActive('image')
      }}
      className="bubble-menu"
    >
      <div className="bubble-menu-group">
        <button
          type="button"
          className={`bubble-menu-button ${currentAlign === 'left' ? 'is-active' : ''}`}
          onClick={() => handleAlignmentChange('left')}
          title="Align left"
          aria-pressed={currentAlign === 'left'}
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`bubble-menu-button ${currentAlign === 'center' ? 'is-active' : ''}`}
          onClick={() => handleAlignmentChange('center')}
          title="Align center"
          aria-pressed={currentAlign === 'center'}
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={`bubble-menu-button ${currentAlign === 'right' ? 'is-active' : ''}`}
          onClick={() => handleAlignmentChange('right')}
          title="Align right"
          aria-pressed={currentAlign === 'right'}
        >
          <AlignRight className="h-4 w-4" />
        </button>
      </div>
    </BubbleMenu>
  )
}
