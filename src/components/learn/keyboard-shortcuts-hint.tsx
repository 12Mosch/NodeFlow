import { Kbd } from '@/components/ui/kbd'

export interface KeyboardShortcut {
  key: string
  label: string
}

export const STUDY_RATING_SHORTCUTS: Array<KeyboardShortcut> = [
  { key: '1', label: 'Forgot' },
  { key: '2', label: 'Hard' },
  { key: '3', label: 'Good' },
  { key: '4', label: 'Easy' },
]

export const RANDOM_MODE_SHORTCUTS: Array<KeyboardShortcut> = [
  { key: '1', label: "Didn't know" },
  { key: '2', label: 'Knew it' },
]

interface KeyboardShortcutsHintProps {
  isExpanded: boolean
  shortcuts: Array<KeyboardShortcut>
  showShortcuts: boolean
  canUndo: boolean
}

export function KeyboardShortcutsHint({
  isExpanded,
  shortcuts,
  showShortcuts,
  canUndo,
}: KeyboardShortcutsHintProps) {
  return (
    <p className="text-center text-xs text-muted-foreground">
      <Kbd>Space</Kbd> {isExpanded ? 'hide answer' : 'reveal answer'}
      {showShortcuts && shortcuts.length > 0 && (
        <>
          {', '}
          {shortcuts.map((shortcut, index) => (
            <span key={shortcut.key}>
              {index > 0 && ', '}
              <Kbd>{shortcut.key}</Kbd> {shortcut.label}
            </span>
          ))}
        </>
      )}
      {canUndo && (
        <>
          , <Kbd>U</Kbd> undo (<Kbd>Ctrl</Kbd>/<Kbd>Cmd</Kbd>+<Kbd>Z</Kbd>)
        </>
      )}
      .
    </p>
  )
}
