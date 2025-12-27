import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

export function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const emoji = node.attrs.emoji || '💡'

  return (
    <NodeViewWrapper className="callout-wrapper">
      <div className="callout">
        <span
          className="callout-emoji"
          contentEditable={false}
          onClick={() => {
            // Could open emoji picker here
            const emojis = [
              '💡',
              '📋',
              '⚠️',
              '✅',
              '❌',
              '💬',
              '🔥',
              '⭐',
              '📌',
              '🎯',
            ]
            const currentIndex = emojis.indexOf(emoji)
            const nextIndex = (currentIndex + 1) % emojis.length
            updateAttributes({ emoji: emojis[nextIndex] })
          }}
          title="Click to change icon"
        >
          {emoji}
        </span>
        <NodeViewContent className="callout-content" />
      </div>
    </NodeViewWrapper>
  )
}
