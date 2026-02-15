'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        root: 'w-fit',
        months: 'flex flex-col gap-4 sm:flex-row',
        month: 'grid grid-cols-[auto_1fr_auto] items-center gap-y-4',
        month_caption:
          'col-start-2 row-start-1 flex h-10 items-center justify-center',
        caption_label:
          'inline-flex h-8 items-center gap-1 px-2 text-sm font-medium',
        dropdowns: 'flex items-center gap-2',
        dropdown_root:
          'relative inline-flex h-8 items-center rounded-md border border-border bg-background px-2 text-sm font-medium text-foreground shadow-sm',
        dropdown:
          'absolute inset-0 z-10 cursor-pointer opacity-0 text-black [color-scheme:light]',
        months_dropdown: 'pr-4',
        years_dropdown: 'pr-4',
        nav: 'pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-between',
        button_previous: cn(
          buttonVariants({ variant: 'outline', size: 'icon-sm' }),
          'col-start-1 row-start-1 pointer-events-auto rounded-md bg-background p-0 opacity-80 hover:opacity-100',
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline', size: 'icon-sm' }),
          'col-start-3 row-start-1 pointer-events-auto rounded-md bg-background p-0 opacity-80 hover:opacity-100',
        ),
        chevron: 'size-4 text-muted-foreground',
        month_grid: 'col-span-3 row-start-2 w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'w-9 text-center text-[0.8rem] font-normal text-muted-foreground',
        week: 'mt-2 flex w-full',
        day: 'relative size-9 p-0 text-center text-sm [&:has([aria-selected])]:bg-accent [&:first-child:has([aria-selected])]:rounded-l-md [&:last-child:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-9 p-0 font-normal aria-selected:opacity-100',
        ),
        selected:
          'rounded-md border border-primary bg-primary/15 text-foreground hover:bg-primary/20 focus:bg-primary/20',
        today:
          'rounded-md border border-border bg-accent text-accent-foreground',
        outside:
          'text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground',
        disabled: 'text-muted-foreground opacity-50',
        range_middle:
          'aria-selected:bg-accent aria-selected:text-accent-foreground',
        range_start: 'rounded-l-md',
        range_end: 'rounded-r-md',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ className: chevronClassName, orientation }) => {
          if (orientation === 'left') {
            return <ChevronLeft className={cn('size-4', chevronClassName)} />
          }
          if (orientation === 'right') {
            return <ChevronRight className={cn('size-4', chevronClassName)} />
          }
          if (orientation === 'up') {
            return (
              <ChevronRight
                className={cn('size-4 -rotate-90', chevronClassName)}
              />
            )
          }
          return (
            <ChevronRight
              className={cn('size-4 rotate-90', chevronClassName)}
            />
          )
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
