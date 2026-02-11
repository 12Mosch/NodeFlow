import type { Doc } from '../../convex/_generated/dataModel'

interface DocumentPreviewProps {
  blocks: Array<Doc<'blocks'>>
}

/**
 * Renders a static preview of document content from cached blocks.
 * Used to show content instantly while the interactive editor loads.
 */
export function DocumentPreview({ blocks }: DocumentPreviewProps) {
  if (blocks.length === 0) {
    return <div className="text-muted-foreground italic">Empty document</div>
  }

  return (
    <div
      data-ph-mask
      className="ph-mask ph-no-capture prose prose-sm dark:prose-invert max-w-none opacity-70"
    >
      {blocks.map((block) => (
        <BlockPreview key={block._id} block={block} />
      ))}
    </div>
  )
}

function BlockPreview({ block }: { block: Doc<'blocks'> }) {
  const text = block.textContent || ''

  // Get heading level from attrs if available
  const headingLevel = block.attrs?.level as number | undefined

  switch (block.type) {
    case 'heading':
      return renderHeading(text, headingLevel ?? 1)

    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      // Container nodes - return null to avoid duplicating content
      // that will be rendered by their child listItem/taskItem blocks
      return null

    case 'listItem':
    case 'taskItem':
      return <div className="my-0.5 flex gap-2">• {text}</div>

    case 'blockquote':
      return (
        <blockquote className="my-2 border-l-2 border-muted-foreground/30 pl-4 italic">
          {text}
        </blockquote>
      )

    case 'codeBlock':
      return (
        <pre className="my-2 rounded bg-muted p-2 text-sm">
          <code>{text}</code>
        </pre>
      )

    case 'horizontalRule':
      return <hr className="my-4 border-muted-foreground/30" />

    case 'callout':
      return (
        <div className="my-2 rounded border-l-4 border-primary bg-muted/50 p-3">
          {text}
        </div>
      )

    case 'paragraph':
    default:
      if (!text.trim()) {
        return <div className="h-6" /> // Empty paragraph spacing
      }
      return <p className="my-1">{text}</p>
  }
}

function renderHeading(text: string, level: number) {
  const baseClass = 'font-bold my-2'

  switch (level) {
    case 1:
      return <h1 className={`${baseClass} text-2xl`}>{text}</h1>
    case 2:
      return <h2 className={`${baseClass} text-xl`}>{text}</h2>
    case 3:
      return <h3 className={`${baseClass} text-lg`}>{text}</h3>
    case 4:
      return <h4 className={`${baseClass} text-base`}>{text}</h4>
    case 5:
      return <h5 className={`${baseClass} text-sm`}>{text}</h5>
    case 6:
      return <h6 className={`${baseClass} text-xs`}>{text}</h6>
    default:
      return <h1 className={`${baseClass} text-2xl`}>{text}</h1>
  }
}
