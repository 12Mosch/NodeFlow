import { AlertTriangle, Ban, Repeat, TrendingDown } from 'lucide-react'
import { MetricCard } from '@/components/analytics'

interface LeechStatsOverviewProps {
  stats: {
    totalLeeches: number
    suspendedCount: number
    highLapsesCount: number
    lowRetentionCount: number
  }
}

export function LeechStatsOverview({ stats }: LeechStatsOverviewProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label={
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" />
            Total Leeches
          </span>
        }
        value={stats.totalLeeches}
        helper="Cards showing difficulty"
        valueClassName="text-amber-700 dark:text-amber-400"
      />
      <MetricCard
        label={
          <span className="inline-flex items-center gap-1.5">
            <Ban className="h-3.5 w-3.5 text-destructive" />
            Suspended
          </span>
        }
        value={stats.suspendedCount}
        helper="Excluded from reviews"
        valueClassName="text-destructive"
      />
      <MetricCard
        label={
          <span className="inline-flex items-center gap-1.5">
            <Repeat className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" />
            High Lapses
          </span>
        }
        value={stats.highLapsesCount}
        helper="Forgotten more than 5 times"
        valueClassName="text-amber-700 dark:text-amber-400"
      />
      <MetricCard
        label={
          <span className="inline-flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500" />
            Low Retention
          </span>
        }
        value={stats.lowRetentionCount}
        helper="Less than 40% success rate"
        valueClassName="text-amber-700 dark:text-amber-400"
      />
    </div>
  )
}
