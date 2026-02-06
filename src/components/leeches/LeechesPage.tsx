import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useRouter } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { LeechStatsOverview } from './LeechStatsOverview'
import { LeechesTable } from './LeechesTable'
import { BulkActionsToolbar } from './BulkActionsToolbar'
import type { Id } from '../../../convex/_generated/dataModel'
import { AnalyticsCard, AnalyticsSection } from '@/components/analytics'
import { Button } from '@/components/ui/button'
import { ModeToggle } from '@/components/mode-toggle'

type FilterMode = 'all' | 'suspended' | 'unsuspended'

export function LeechesPage() {
  const router = useRouter()
  const [selectedCards, setSelectedCards] = useState<Set<Id<'cardStates'>>>(
    new Set(),
  )
  const [filterMode, setFilterMode] = useState<FilterMode>('all')

  const { data: leechCards } = useSuspenseQuery(
    convexQuery(api.cardStates.listLeechCards, {}),
  )
  const { data: stats } = useSuspenseQuery(
    convexQuery(api.cardStates.getLeechStats, {}),
  )

  // Defensive guard: backend returns null before auth is established during
  // cache restoration. useSuspenseQuery treats null as "resolved" data, so
  // we bail out rather than rendering with missing data.
  if (!leechCards || !stats) return null

  // Filter cards based on mode
  const filteredCards = leechCards.filter((item) => {
    if (filterMode === 'suspended') {
      return item.cardState.suspended === true
    }
    if (filterMode === 'unsuspended') {
      return item.cardState.suspended !== true
    }
    return true // 'all'
  })

  const handleToggleSelect = (cardId: Id<'cardStates'>) => {
    setSelectedCards((prev) => {
      const next = new Set(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })
  }

  const handleClearSelection = () => {
    setSelectedCards(new Set())
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => router.history.back()}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
              <h1 className="text-base font-semibold sm:text-lg">
                Leech Cards Management
              </h1>
            </div>
          </div>
          <ModeToggle />
        </div>
      </header>

      <div className="space-y-10 p-6 sm:p-8">
        {stats.totalLeeches === 0 ? (
          <AnalyticsSection>
            <AnalyticsCard className="px-6">
              <div className="py-16 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <h3 className="mt-4 text-lg font-semibold">No Leech Cards!</h3>
                <p className="mt-1 text-muted-foreground">
                  All your cards are being learned effectively.
                </p>
              </div>
            </AnalyticsCard>
          </AnalyticsSection>
        ) : (
          <>
            <AnalyticsSection
              title="Leech Snapshot"
              description="Cards flagged for repeated lapses or low retention."
            >
              <LeechStatsOverview stats={stats} />
            </AnalyticsSection>

            <AnalyticsSection
              title="Leech Queue"
              description="Filter, inspect, and manage difficult cards without changing review workflows."
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={filterMode === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterMode('all')}
                  >
                    All ({leechCards.length})
                  </Button>
                  <Button
                    variant={filterMode === 'suspended' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterMode('suspended')}
                  >
                    Suspended ({stats.suspendedCount})
                  </Button>
                  <Button
                    variant={
                      filterMode === 'unsuspended' ? 'default' : 'outline'
                    }
                    size="sm"
                    onClick={() => setFilterMode('unsuspended')}
                  >
                    Active ({stats.totalLeeches - stats.suspendedCount})
                  </Button>
                </div>
              }
            >
              {selectedCards.size > 0 && (
                <BulkActionsToolbar
                  selectedCount={selectedCards.size}
                  selectedCardIds={Array.from(selectedCards)}
                  onClearSelection={handleClearSelection}
                />
              )}

              <LeechesTable
                cards={filteredCards}
                selectedCards={selectedCards}
                onToggleSelect={handleToggleSelect}
              />
            </AnalyticsSection>
          </>
        )}
      </div>
    </div>
  )
}
