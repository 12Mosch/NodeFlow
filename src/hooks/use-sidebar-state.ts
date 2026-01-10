import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'nodeflow-sidebar-state'

export function useSidebarState(defaultOpen = false) {
  const [isHydrated, setIsHydrated] = useState(false)
  const [isOpen, setIsOpen] = useState(() => {
    // During SSR, use defaultOpen
    if (typeof window === 'undefined') {
      return defaultOpen
    }
    // On client, try to read from localStorage
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored !== null ? stored === 'true' : defaultOpen
  })

  useEffect(() => {
    // This is a valid use case for SSR hydration - setting a flag after mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsHydrated(true)
  }, [])

  const setOpen = useCallback(
    (open: boolean | ((prev: boolean) => boolean)) => {
      setIsOpen((prev) => {
        const next = typeof open === 'function' ? open(prev) : open
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, String(next))
        }
        return next
      })
    },
    [],
  )

  return { isOpen, setOpen, isHydrated }
}
