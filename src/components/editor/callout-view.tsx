import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'

const EMOJIS = [
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
] as const

export function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const emoji = node.attrs.emoji || '💡'

  const cycleEmoji = (direction: 'next' | 'prev' = 'next') => {
    const currentIndex = EMOJIS.indexOf(emoji as (typeof EMOJIS)[number])
    const index = currentIndex === -1 ? 0 : currentIndex
    const nextIndex =
      direction === 'next'
        ? (index + 1) % EMOJIS.length
        : (index - 1 + EMOJIS.length) % EMOJIS.length
    updateAttributes({ emoji: EMOJIS[nextIndex] })
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'Enter':
      case ' ': // Space
        event.preventDefault()
        cycleEmoji('next')
        break
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        cycleEmoji('next')
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        cycleEmoji('prev')
        break
    }
  }

  return (
    <NodeViewWrapper className="callout-wrapper">
      <div className="callout">
        <span
          className="callout-emoji"
          contentEditable={false}
          role="button"
          tabIndex={0}
          aria-label={`Callout icon: ${emoji}. Press Enter or Space to cycle, or use arrow keys to navigate.`}
          onClick={() => cycleEmoji('next')}
          onKeyDown={handleKeyDown}
          title="Click or press Enter/Space to change icon. Use arrow keys to navigate."
        >
          {emoji}
        </span>
        <NodeViewContent className="callout-content" />
      </div>
    </NodeViewWrapper>
  )
}
