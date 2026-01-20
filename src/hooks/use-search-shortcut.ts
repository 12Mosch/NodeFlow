import { useEffect } from 'react'
import { useSearch } from '@/components/search-provider'

export function useSearchShortcut() {
  const { open } = useSearch()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+F (Mac) or Ctrl+F (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        // Prevent browser's default find dialog
        event.preventDefault()
        open()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])
}
