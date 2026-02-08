import { getFlashcardIconTooltipLabel } from './flashcard-icon-tooltip-label'
import type { CardType } from '@/lib/flashcard-parser'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface FlashcardTypeIconProps {
  type: CardType
}

function FlashcardTypeIcon({ type }: FlashcardTypeIconProps) {
  const className = 'h-3.5 w-3.5'

  switch (type) {
    case 'basic':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M8 3 4 7l4 4" />
          <path d="M4 7h16" />
          <path d="m16 21 4-4-4-4" />
          <path d="M20 17H4" />
        </svg>
      )
    case 'concept':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
          <path d="M9 18h6" />
          <path d="M10 22h4" />
        </svg>
      )
    case 'descriptor':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v4a2 2 0 0 0 2 2h4" />
          <path d="M10 9H8" />
          <path d="M16 13H8" />
          <path d="M16 17H8" />
        </svg>
      )
    case 'cloze':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M8 8h.01" />
          <path d="M16 8h.01" />
          <path d="M12 12h.01" />
          <path d="M8 16h.01" />
          <path d="M16 16h.01" />
        </svg>
      )
  }
}

export interface FlashcardIconTooltipProps {
  type: CardType
  disabled: boolean
}

export function FlashcardIconTooltip({
  type,
  disabled,
}: FlashcardIconTooltipProps) {
  const tooltipLabel = getFlashcardIconTooltipLabel(type, disabled)

  const iconClass = disabled
    ? 'flashcard-icon flashcard-icon-disabled'
    : `flashcard-icon flashcard-icon-${type}`

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={iconClass}
            contentEditable={false}
            aria-label={tooltipLabel}
          >
            <FlashcardTypeIcon type={type} />
          </span>
        }
      />
      <TooltipContent side="top" sideOffset={8}>
        {tooltipLabel}
      </TooltipContent>
    </Tooltip>
  )
}
