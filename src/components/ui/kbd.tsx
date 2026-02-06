import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export { Kbd }
