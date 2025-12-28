import type React from 'react'

/**
 * Parses cloze text (with {{answer}} patterns) and returns an array of text parts
 * with their answer status.
 */
export function parseClozeText(
  text: string,
): Array<{ text: string; isAnswer: boolean }> {
  const parts: Array<{ text: string; isAnswer: boolean }> = []
  let lastIndex = 0
  const regex = /\{\{([^}]+)\}\}/g
  let match

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, match.index),
        isAnswer: false,
      })
    }
    // Add the answer (without braces)
    parts.push({ text: match[1], isAnswer: true })
    lastIndex = regex.lastIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isAnswer: false })
  }

  return parts
}

/**
 * Renders cloze text with highlighted answers.
 * @param text - The cloze text containing {{answer}} patterns
 * @param options - Optional styling and wrapper options
 */
export function renderClozeText(
  text: string,
  options?: {
    /** CSS classes for the answer highlight mark element */
    markClassName?: string
    /** CSS classes for the wrapper element (if provided, wraps in a <p> tag) */
    wrapperClassName?: string
  },
): React.ReactElement {
  const parts = parseClozeText(text)
  const defaultMarkClassName =
    'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-1 py-0.5 rounded font-medium'
  const markClassName = options?.markClassName ?? defaultMarkClassName

  const content = (
    <>
      {parts.map((part, i) =>
        part.isAnswer ? (
          <mark key={i} className={markClassName}>
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  )

  if (options?.wrapperClassName) {
    return <p className={options.wrapperClassName}>{content}</p>
  }

  return content
}
