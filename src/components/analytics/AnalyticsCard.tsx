import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import type { cardVariants } from '@/components/ui/card'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const analyticsCardVariants = cva('border-border/70 shadow-none')

type AnalyticsCardProps = ComponentProps<'div'> & {
  muted?: boolean
  padding?: VariantProps<typeof cardVariants>['padding']
}

function AnalyticsCard({
  className,
  muted = false,
  padding = 'default',
  ...props
}: AnalyticsCardProps) {
  return (
    <Card
      data-slot="analytics-card"
      variant={muted ? 'subtle' : 'default'}
      padding={padding}
      className={cn(analyticsCardVariants(), className)}
      {...props}
    />
  )
}

export { AnalyticsCard, analyticsCardVariants }
