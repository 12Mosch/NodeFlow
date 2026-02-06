import { Suspense, startTransition, useEffect, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import * as Sentry from '@sentry/tanstackstart-react'
import { Loader2 } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { StudyState } from '@/components/study/types'
import type { StudyMode } from '@/components/study-mode-dialog'
import { StudyModeDialog } from '@/components/study-mode-dialog'
import { SpacedRepetitionMode } from '@/components/study/SpacedRepetitionMode'
import { RandomMode } from '@/components/study/RandomMode'

type StudySearch = {
  mode?: StudyMode
}

export const Route = createFileRoute('/study')({
  validateSearch: (search: Record<string, unknown>): StudySearch => {
    return {
      mode:
        search.mode === 'spaced-repetition' || search.mode === 'random'
          ? search.mode
          : undefined,
    }
  },
  loader: async ({ context, location }) => {
    const searchParams = new URLSearchParams(location.search)
    const mode = searchParams.get('mode')

    await Sentry.startSpan(
      { name: 'study.prefetch', op: 'navigation' },
      async () => {
        // Conditionally load data based on selected mode
        // React Query will cache it, so mode switching within a session is still fast
        if (mode === 'spaced-repetition') {
          await Promise.all([
            context.queryClient.ensureQueryData(
              convexQuery(api.cardStates.getStats, {}),
            ),
            context.queryClient.ensureQueryData(
              convexQuery(api.cardStates.getLearnSession, {}),
            ),
          ])
        } else if (mode === 'random') {
          await context.queryClient.ensureQueryData(
            convexQuery(api.blocks.listAllFlashcards, {}),
          )
        } else {
          // No mode selected - only load stats for potential dialog display
          await context.queryClient.ensureQueryData(
            convexQuery(api.cardStates.getStats, {}),
          )
        }
      },
    )
  },
  component: StudyPage,
})

function StudyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm text-muted-foreground shadow-xs">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading study workspace...</span>
            </div>
          </div>
        }
      >
        <StudyContent />
      </Suspense>
    </div>
  )
}

function StudyContent() {
  const navigate = useNavigate()
  const { mode } = Route.useSearch()
  const [studyState, setStudyState] = useState<StudyState>(
    mode === 'spaced-repetition' ? 'overview' : 'selecting',
  )
  const [isDialogOpen, setIsDialogOpen] = useState(!mode)
  const prevModeRef = useRef(mode)

  // Sync states with mode parameter changes
  // This effect syncs local UI state with URL parameters, which is necessary
  // because studyState can be 'studying' (local state) but needs to reset when mode changes
  useEffect(() => {
    // Only update if mode actually changed
    if (prevModeRef.current !== mode) {
      prevModeRef.current = mode

      // Use startTransition to mark these as non-urgent updates
      startTransition(() => {
        if (mode === 'spaced-repetition') {
          setStudyState('overview')
        } else if (mode === 'random') {
          setStudyState('selecting')
        }
        setIsDialogOpen(!mode)
      })
    }
  }, [mode])

  // Handle mode selection from dialog
  const handleSelectMode = (selectedMode: StudyMode) => {
    navigate({ to: '/study', search: { mode: selectedMode } })
  }

  const handleGoHome = () => {
    navigate({ to: '/' })
  }

  // If no mode selected, show dialog
  if (!mode) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <StudyModeDialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) {
              handleGoHome()
            }
          }}
          onSelectMode={handleSelectMode}
        />
      </div>
    )
  }

  // Render content based on mode
  switch (mode) {
    case 'spaced-repetition':
      return (
        <SpacedRepetitionMode
          studyState={studyState}
          setStudyState={setStudyState}
          onGoHome={handleGoHome}
        />
      )
    case 'random':
      return (
        <RandomMode
          studyState={studyState}
          setStudyState={setStudyState}
          onGoHome={handleGoHome}
        />
      )
    default:
      return null
  }
}
