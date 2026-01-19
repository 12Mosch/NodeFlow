import katex from 'katex'

interface LatexPart {
  type: 'text' | 'inline-math' | 'block-math'
  content: string
}

/**
 * Parses text containing LaTeX delimiters into parts.
 * Supports:
 * - Block math: $$...$$
 * - Inline math: $...$
 * - Escaped dollar signs inside math: \$
 *
 * To distinguish math from currency (e.g., "$5"), inline math requires:
 * - Non-whitespace character immediately after opening $
 * - Non-whitespace character immediately before closing $
 * - Non-greedy matching to find the shortest valid match
 *
 * Examples:
 * - "$x$" -> math (valid)
 * - "$a=b$" -> math (valid)
 * - "$\$$" -> math containing literal $ (valid)
 * - "$5" -> not math (no closing $)
 * - "$ x$" -> not math (space after opening $)
 * - "$x $" -> not math (space before closing $)
 */
export function parseLatexParts(text: string): Array<LatexPart> {
  const parts: Array<LatexPart> = []

  // Regex explanation:
  // Content pattern (?:[^$\\]|\\.)* matches:
  //   - [^$\\] - any char except $ and \
  //   - | \\. - OR a backslash followed by any char (escaped sequences like \$ or \\)
  //
  // Block math: \$\$(?<block>...)\$\$ - standard $$...$$ delimiters
  // Inline math: \$(?<inline>...)\$(?!\d) - with constraints:
  //   - (?!\s) after opening $ - must not start with whitespace
  //   - (?<!\s) before closing $ - must not end with whitespace
  //   - (?!\d) after closing $ - must not be followed by digit (helps with "$5 $10" cases)
  const mathRegex =
    /\$\$(?<block>(?:[^$\\]|\\.)+)\$\$|\$(?<inline>(?!\s)(?:[^$\\]|\\.)*?(?<!\s))\$(?!\d)/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = mathRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      })
    }

    const groups = match.groups ?? {}

    // Determine if it's block or inline math
    if (groups.block) {
      // Block math ($$...$$)
      parts.push({
        type: 'block-math',
        content: groups.block,
      })
    } else if (groups.inline) {
      // Inline math ($...$)
      parts.push({
        type: 'inline-math',
        content: groups.inline,
      })
    }

    lastIndex = mathRegex.lastIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex),
    })
  }

  return parts
}

/**
 * Escapes HTML special characters to prevent XSS.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Renders a LaTeX string to HTML using KaTeX.
 */
function renderLatexToHtml(
  latex: string,
  displayMode: boolean,
): { html: string; error: boolean } {
  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      errorColor: '#cc0000',
    })
    return { html, error: false }
  } catch {
    return {
      html: `<span class="latex-error">${escapeHtml(latex)}</span>`,
      error: true,
    }
  }
}

interface RenderLatexTextProps {
  text: string
  className?: string
}

/**
 * React component that renders text with embedded LaTeX.
 * Parses the text for $...$ (inline) and $$...$$ (block) delimiters
 * and renders them using KaTeX.
 */
export function RenderLatexText({ text, className }: RenderLatexTextProps) {
  const parts = parseLatexParts(text)

  // If no math parts found, return plain text
  if (parts.length === 1 && parts[0].type === 'text') {
    return <span className={className}>{text}</span>
  }

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index}>{part.content}</span>
        }

        const isBlock = part.type === 'block-math'
        const { html, error } = renderLatexToHtml(part.content, isBlock)

        const baseClass = isBlock ? 'latex-block' : 'latex-inline'
        const errorClass = error ? ' latex-render-error' : ''

        return (
          <span
            key={index}
            className={baseClass + errorClass}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      })}
    </span>
  )
}
