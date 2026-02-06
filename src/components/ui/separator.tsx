'use client'

import { Separator as SeparatorPrimitive } from '@base-ui/react/separator'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const separatorVariants = cva(
  'shrink-0 data-[orientation=horizontal]:w-full data-[orientation=vertical]:self-stretch',
  {
    variants: {
      variant: {
        default:
          'bg-border data-[orientation=horizontal]:h-px data-[orientation=vertical]:w-px',
        muted:
          'bg-border/60 data-[orientation=horizontal]:h-px data-[orientation=vertical]:w-px',
        strong:
          'bg-foreground/20 data-[orientation=horizontal]:h-px data-[orientation=vertical]:w-px',
        dashed:
          'bg-transparent data-[orientation=horizontal]:h-0 data-[orientation=horizontal]:border-t data-[orientation=horizontal]:border-dashed data-[orientation=horizontal]:border-border/80 data-[orientation=vertical]:w-0 data-[orientation=vertical]:border-l data-[orientation=vertical]:border-dashed data-[orientation=vertical]:border-border/80',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Separator({
  className,
  orientation = 'horizontal',
  variant = 'default',
  ...props
}: SeparatorPrimitive.Props & VariantProps<typeof separatorVariants>) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      data-variant={variant}
      className={cn(separatorVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Separator, separatorVariants }
