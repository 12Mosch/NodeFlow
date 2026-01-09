import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MathEditorTemplates } from './math-editor-templates'
import { GREEK_LETTERS } from './math-editor-constants'
import type { Editor } from '@tiptap/react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'

interface MathEditorPopoverProps {
  editor: Editor
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  nodeType: 'inlineMath' | 'blockMath'
  position: number
  initialLatex: string
  anchorRect: DOMRect
}

// Debounce utility with cancel support

interface DebouncedFunction<T extends (...args: Array<any>) => any> {
  (...args: Parameters<T>): void
  cancel: () => void
}

function debounce<T extends (...args: Array<any>) => any>(
  func: T,
  wait: number,
): DebouncedFunction<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  return debounced
}

// Syntax highlight LaTeX code
function highlightLatex(code: string): string {
  // Escape HTML entities first
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Highlight commands (backslash followed by letters)
  // Greek letters get variable styling, other commands get command styling
  highlighted = highlighted.replace(/\\([a-zA-Z]+)/g, (match, name) => {
    if (GREEK_LETTERS.has(name)) {
      return `<span class="latex-greek">\\${name}</span>`
    }
    return `<span class="latex-command">\\${name}</span>`
  })

  // Highlight braces {} - grey
  highlighted = highlighted.replace(
    /([{}])/g,
    '<span class="latex-brace">$1</span>',
  )

  // Highlight brackets [] - grey (slightly different)
  highlighted = highlighted.replace(
    /(\[|\])/g,
    '<span class="latex-bracket">$1</span>',
  )

  // Highlight numbers - cyan (no word boundaries, as _ is a word char)
  highlighted = highlighted.replace(
    /(\d+\.?\d*)/g,
    '<span class="latex-number">$1</span>',
  )

  // Highlight special characters (^, _, &) - orange
  highlighted = highlighted.replace(
    /([_^&])/g,
    '<span class="latex-special">$1</span>',
  )

  return highlighted
}

export function MathEditorPopover({
  editor,
  isOpen,
  onOpenChange,
  nodeType,
  position,
  initialLatex,
  anchorRect,
}: MathEditorPopoverProps) {
  const [latex, setLatex] = useState(initialLatex)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)

  // Update editor with new LaTeX (debounced for live preview)
  const updateMathNode = useMemo(
    () =>
      debounce((newLatex: string) => {
        if (nodeType === 'inlineMath') {
          editor.commands.updateInlineMath({ latex: newLatex, pos: position })
        } else {
          editor.commands.updateBlockMath({ latex: newLatex, pos: position })
        }
      }, 100),
    [editor, nodeType, position],
  )

  // Cancel pending debounced updates on unmount or dependency change
  useEffect(() => {
    return () => {
      updateMathNode.cancel()
    }
  }, [updateMathNode])

  // Handle latex input change
  const handleLatexChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newLatex = e.target.value
      setLatex(newLatex)
      updateMathNode(newLatex)
    },
    [updateMathNode],
  )

  // Sync scroll position between textarea and highlight overlay
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  // Insert template or symbol at cursor position
  const handleInsert = useCallback(
    (insertLatex: string, cursorOffset?: number) => {
      if (!textareaRef.current) return

      const textarea = textareaRef.current
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const currentValue = textarea.value

      // Insert at cursor position
      const newValue =
        currentValue.substring(0, start) +
        insertLatex +
        currentValue.substring(end)

      setLatex(newValue)
      updateMathNode(newValue)

      // Set cursor position: use cursorOffset if provided, otherwise place at end of inserted text
      setTimeout(() => {
        textarea.focus()
        const newCursorPos =
          cursorOffset !== undefined
            ? start + cursorOffset
            : start + insertLatex.length
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      }, 0)
    },
    [updateMathNode],
  )

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        // Close popover and keep current changes (consistent with clicking outside)
        onOpenChange(false)
      }
    },
    [onOpenChange],
  )

  // Reset latex when initialLatex changes (when a new math node is clicked)
  useEffect(() => {
    setLatex(initialLatex)
  }, [initialLatex])

  // Handle focus when popover opens via onOpenAutoFocus callback
  const handleOpenAutoFocus = useCallback((e: Event) => {
    // Prevent default Radix autofocus behavior
    e.preventDefault()
    // Focus and select textarea content
    textareaRef.current?.focus()
    textareaRef.current?.select()
  }, [])

  // Get highlighted HTML
  const highlightedHtml = useMemo(() => highlightLatex(latex), [latex])

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <div
          className="math-editor-anchor"
          style={{
            position: 'fixed',
            left: anchorRect.left,
            top: anchorRect.top,
            width: anchorRect.width,
            height: anchorRect.height,
            pointerEvents: 'none',
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        className="math-editor-popover"
        align="start"
        sideOffset={8}
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        <div className="math-editor-content">
          <div className="math-editor-input-wrapper">
            <label htmlFor="latex-input" className="math-editor-label">
              LaTeX {nodeType === 'blockMath' ? '(Block)' : '(Inline)'}
            </label>
            <div className="math-editor-input-container">
              {/* Syntax highlighted backdrop */}
              <div
                ref={highlightRef}
                className="math-editor-highlight"
                dangerouslySetInnerHTML={{ __html: highlightedHtml + '\n' }}
                aria-hidden="true"
              />
              {/* Actual textarea (transparent text) */}
              <textarea
                ref={textareaRef}
                id="latex-input"
                className="math-editor-textarea"
                value={latex}
                onChange={handleLatexChange}
                onKeyDown={handleKeyDown}
                onScroll={handleScroll}
                placeholder="Enter LaTeX..."
                rows={3}
                spellCheck={false}
              />
            </div>
          </div>
          <MathEditorTemplates onInsert={handleInsert} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
