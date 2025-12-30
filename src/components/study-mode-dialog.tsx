import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Brain, Shuffle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type StudyMode = 'spaced-repetition' | 'random'

interface StudyModeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectMode: (mode: StudyMode) => void
}

const MODES: Array<{ mode: StudyMode; label: string; shortcut: string }> = [
  { mode: 'spaced-repetition', label: 'Spaced Repetition', shortcut: '1' },
  { mode: 'random', label: 'Random Mode', shortcut: '2' },
]

export function StudyModeDialog({
  open,
  onOpenChange,
  onSelectMode,
}: StudyModeDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dialogInstance, setDialogInstance] = useState(0)
  const cardRefs = useRef<Array<HTMLDivElement | null>>([])
  const prevOpenRef = useRef(open)

  const handleSelect = useCallback(
    (mode: StudyMode) => {
      onSelectMode(mode)
      onOpenChange(false)
    },
    [onSelectMode, onOpenChange],
  )

  // Reset selection when dialog opens by creating new instance
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Dialog just opened - create new instance to reset state
      // Use startTransition to mark this as a non-urgent update
      startTransition(() => {
        setDialogInstance((prev) => prev + 1)
        setSelectedIndex(0)
      })
    }
    prevOpenRef.current = open
  }, [open])

  // Handle focus when dialog opens using Radix's onOpenAutoFocus
  const handleOpenAutoFocus = useCallback((event: Event) => {
    // Prevent default focus behavior and focus the first card instead
    event.preventDefault()
    requestAnimationFrame(() => {
      cardRefs.current[0]?.focus()
    })
  }, [])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea
      const target = event.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          setSelectedIndex((prev) => (prev === 0 ? MODES.length - 1 : prev - 1))
          break
        case 'ArrowRight':
          event.preventDefault()
          setSelectedIndex((prev) => (prev === MODES.length - 1 ? 0 : prev + 1))
          break
        case 'Enter':
        case ' ':
          event.preventDefault()
          handleSelect(MODES[selectedIndex].mode)
          break
        case '1':
          event.preventDefault()
          handleSelect('spaced-repetition')
          break
        case '2':
          event.preventDefault()
          handleSelect('random')
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, selectedIndex, handleSelect])

  // Update focus when selectedIndex changes
  useEffect(() => {
    if (open) {
      cardRefs.current[selectedIndex]?.focus()
    }
  }, [selectedIndex, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        key={dialogInstance}
        className="sm:max-w-[600px]"
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>Choose Study Mode</DialogTitle>
          <DialogDescription>
            Select how you want to study your flashcards. Use arrow keys to
            navigate, or press{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
              1
            </kbd>{' '}
            /{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground">
              2
            </kbd>{' '}
            to select.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 sm:grid-cols-2">
          {MODES.map((modeData, index) => {
            const isSelected = selectedIndex === index
            const isSpacedRepetition = modeData.mode === 'spaced-repetition'

            return (
              <Card
                key={modeData.mode}
                ref={(el) => {
                  cardRefs.current[index] = el
                }}
                tabIndex={0}
                role="button"
                aria-label={`${modeData.label}. Press ${modeData.shortcut} or Enter to select.`}
                className={cn(
                  'cursor-pointer transition-all hover:border-primary hover:shadow-md focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none',
                  isSelected && 'border-primary shadow-md ring-2 ring-ring',
                )}
                onClick={() => handleSelect(modeData.mode)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleSelect(modeData.mode)
                  }
                }}
              >
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    {isSpacedRepetition ? (
                      <Brain className="h-6 w-6 text-primary" />
                    ) : (
                      <Shuffle className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <CardTitle>
                    {modeData.label}
                    {isSelected && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (Selected)
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {isSpacedRepetition
                      ? 'Review cards at scientifically optimal intervals using FSRS. Rate each card (Again, Hard, Good, Easy) to maximize long-term retention.'
                      : "Practice all cards in random order with simple know/don't know tracking. Perfect for quick review sessions without spaced repetition."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" variant="outline">
                    Choose Mode
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
