/**
 * Flashcard syntax parser for RemNote-style flashcard detection.
 *
 * Supported syntax:
 * - Basic cards: >> (forward), << (reverse), <> (bidirectional), == (forward)
 * - Concept cards: :: (bidirectional), :> (forward), :< (reverse)
 * - Descriptor cards: ;; (forward), ;< (reverse), ;<> (bidirectional)
 * - Cloze cards: {{occlusion}} for fill-in-the-blank
 * - Multi-line cards: Triple markers (>>>, :::, ;;;)
 * - Disabled cards: Suffix with - (e.g., >>-, ::--)
 */

export type CardType = 'basic' | 'concept' | 'descriptor' | 'cloze'
export type CardDirection = 'forward' | 'reverse' | 'bidirectional' | 'disabled'

export interface FlashcardParseResult {
  isCard: boolean
  cardType?: CardType
  cardDirection?: CardDirection
  cardFront?: string
  cardBack?: string
  clozeOcclusions?: Array<string>
}

// Regex for cloze occlusions: matches {{content}}
const CLOZE_PATTERN = /\{\{([^}]+)\}\}/g

// Card separator patterns with their types and directions
// Order matters: more specific patterns must come first
interface CardPattern {
  pattern: RegExp
  type: CardType
  direction: CardDirection
}

const CARD_PATTERNS: Array<CardPattern> = [
  // Disabled patterns (must come before non-disabled)
  // More specific patterns first (descriptor before basic to prevent <>- matching ;<>-)
  // Descriptor disabled
  {
    pattern: /^(.+?)\s*;<>-\s*(.*)$/,
    type: 'descriptor',
    direction: 'disabled',
  },
  {
    pattern: /^(.+?)\s*;<-\s*(.*)$/,
    type: 'descriptor',
    direction: 'disabled',
  },
  {
    pattern: /^(.+?)\s*;;-\s*(.*)$/,
    type: 'descriptor',
    direction: 'disabled',
  },
  // Basic disabled
  { pattern: /^(.+?)\s*>>-\s*(.*)$/, type: 'basic', direction: 'disabled' },
  { pattern: /^(.+?)\s*<<-\s*(.*)$/, type: 'basic', direction: 'disabled' },
  { pattern: /^(.+?)\s*<>-\s*(.*)$/, type: 'basic', direction: 'disabled' },
  { pattern: /^(.+?)\s*==-\s*(.*)$/, type: 'basic', direction: 'disabled' },
  // Concept disabled
  { pattern: /^(.+?)\s*::-\s*(.*)$/, type: 'concept', direction: 'disabled' },
  { pattern: /^(.+?)\s*:>-\s*(.*)$/, type: 'concept', direction: 'disabled' },
  { pattern: /^(.+?)\s*:<-\s*(.*)$/, type: 'concept', direction: 'disabled' },

  // Multi-line patterns (triple markers)
  // Basic multi-line
  { pattern: /^(.+?)\s*>>>\s*([\s\S]*)$/, type: 'basic', direction: 'forward' },
  { pattern: /^(.+?)\s*<<<\s*([\s\S]*)$/, type: 'basic', direction: 'reverse' },
  {
    pattern: /^(.+?)\s*<><>\s*([\s\S]*)$/,
    type: 'basic',
    direction: 'bidirectional',
  },
  { pattern: /^(.+?)\s*===\s*([\s\S]*)$/, type: 'basic', direction: 'forward' },
  // Concept multi-line
  {
    pattern: /^(.+?)\s*:::\s*([\s\S]*)$/,
    type: 'concept',
    direction: 'bidirectional',
  },
  {
    pattern: /^(.+?)\s*:>>\s*([\s\S]*)$/,
    type: 'concept',
    direction: 'forward',
  },
  {
    pattern: /^(.+?)\s*:<<\s*([\s\S]*)$/,
    type: 'concept',
    direction: 'reverse',
  },
  // Descriptor multi-line
  {
    pattern: /^(.+?)\s*;;;\s*([\s\S]*)$/,
    type: 'descriptor',
    direction: 'forward',
  },
  {
    pattern: /^(.+?)\s*;;<>\s*([\s\S]*)$/,
    type: 'descriptor',
    direction: 'bidirectional',
  },
  {
    pattern: /^(.+?)\s*;<<\s*([\s\S]*)$/,
    type: 'descriptor',
    direction: 'reverse',
  },

  // Bidirectional patterns (must come before single-direction)
  {
    pattern: /^(.+?)\s*;<>\s*(.+)$/,
    type: 'descriptor',
    direction: 'bidirectional',
  },
  { pattern: /^(.+?)\s*<>\s*(.+)$/, type: 'basic', direction: 'bidirectional' },

  // Standard patterns
  // Basic
  { pattern: /^(.+?)\s*>>\s*(.+)$/, type: 'basic', direction: 'forward' },
  { pattern: /^(.+?)\s*<<\s*(.+)$/, type: 'basic', direction: 'reverse' },
  { pattern: /^(.+?)\s*==\s*(.+)$/, type: 'basic', direction: 'forward' },
  // Concept (:: is bidirectional by default)
  {
    pattern: /^(.+?)\s*::\s*(.+)$/,
    type: 'concept',
    direction: 'bidirectional',
  },
  { pattern: /^(.+?)\s*:>\s*(.+)$/, type: 'concept', direction: 'forward' },
  { pattern: /^(.+?)\s*:<\s*(.+)$/, type: 'concept', direction: 'reverse' },
  // Descriptor
  { pattern: /^(.+?)\s*;;\s*(.+)$/, type: 'descriptor', direction: 'forward' },
  { pattern: /^(.+?)\s*;<\s*(.+)$/, type: 'descriptor', direction: 'reverse' },
]

/**
 * Parse text content to detect flashcard syntax.
 * @param text - The text content to parse
 * @returns FlashcardParseResult with card metadata if detected
 */
export function parseFlashcard(text: string): FlashcardParseResult {
  const trimmedText = text.trim()

  if (!trimmedText) {
    return { isCard: false }
  }

  // Check for cloze deletions first ({{...}})
  const clozeMatches = [...trimmedText.matchAll(CLOZE_PATTERN)]
  if (clozeMatches.length > 0) {
    const occlusions = clozeMatches.map((match) => match[1].trim())
    return {
      isCard: true,
      cardType: 'cloze',
      clozeOcclusions: occlusions,
    }
  }

  // Check for card separator patterns
  for (const { pattern, type, direction } of CARD_PATTERNS) {
    const match = trimmedText.match(pattern)
    if (match) {
      const front = match[1].trim()
      const back = match[2].trim()

      // Require non-empty front for valid card
      if (!front) {
        continue
      }

      return {
        isCard: true,
        cardType: type,
        cardDirection: direction,
        cardFront: front,
        cardBack: back || undefined,
      }
    }
  }

  return { isCard: false }
}
