import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const analyticsCardVariants = cva('border-border/70 shadow-none', {
  variants: {
    padding: {
      default: '',
      compact: '',
      dense: '',
      none: '',
    },
  },
  defaultVariants: {
    padding: 'default',
  },
})

type AnalyticsCardProps = ComponentProps<'div'> &
  VariantProps<typeof analyticsCardVariants> & {
    muted?: boolean
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
      className={cn(analyticsCardVariants({ padding, className }))}
      {...props}
    />
  )
}

export { AnalyticsCard, analyticsCardVariants }
