import { AlertTriangle, Ban, Repeat, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Leeches</CardTitle>
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalLeeches}</div>
          <p className="text-xs text-muted-foreground">
            Cards showing difficulty
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Suspended</CardTitle>
          <Ban className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.suspendedCount}</div>
          <p className="text-xs text-muted-foreground">Excluded from reviews</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">High Lapses</CardTitle>
          <Repeat className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.highLapsesCount}</div>
          <p className="text-xs text-muted-foreground">
            Forgotten more than 5 times
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Low Retention</CardTitle>
          <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.lowRetentionCount}</div>
          <p className="text-xs text-muted-foreground">
            Less than 40% success rate
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
