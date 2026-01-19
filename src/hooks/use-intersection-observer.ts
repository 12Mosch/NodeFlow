import { useEffect, useRef } from 'react'

interface UseIntersectionObserverOptions {
  /** Callback to execute when the sentinel element becomes visible */
  onIntersect: () => void
  /** Whether the observer should be active. Defaults to true. */
  enabled?: boolean
  /** Intersection threshold (0-1). Defaults to 0.1. */
  threshold?: number
  /** Root margin to trigger early. Defaults to '100px'. */
  rootMargin?: string
}

export function useIntersectionObserver({
  onIntersect,
  enabled = true,
  threshold = 0.1,
  rootMargin = '100px',
}: UseIntersectionObserverOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onIntersectRef = useRef(onIntersect)

  useEffect(() => {
    onIntersectRef.current = onIntersect
  }, [onIntersect])

  useEffect(() => {
    if (!enabled) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onIntersectRef.current()
        }
      },
      { threshold, rootMargin },
    )

    const sentinel = sentinelRef.current
    if (sentinel) {
      observer.observe(sentinel)
    }

    return () => {
      observer.disconnect()
    }
  }, [enabled, threshold, rootMargin])

  return sentinelRef
}
