import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Link2, Trash2 } from 'lucide-react'
import type { Editor } from '@tiptap/react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface LinkPopoverProps {
  editor: Editor
}

export function LinkPopover({ editor }: LinkPopoverProps) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [showExternalWarning, setShowExternalWarning] = useState(false)

  const isActive = editor.isActive('link')
  const currentLink = editor.getAttributes('link').href as string | undefined

  // Update URL input when popover opens
  useEffect(() => {
    if (open && currentLink) {
      setUrl(currentLink)
    } else if (!open) {
      setUrl('')
    }
  }, [open, currentLink])

  const handleSetLink = useCallback(() => {
    if (!url) {
      editor.chain().focus().unsetLink().run()
    } else {
      // Add https:// if no protocol specified
      const normalizedUrl = url.match(/^https?:\/\//) ? url : `https://${url}`
      editor.chain().focus().setLink({ href: normalizedUrl }).run()
    }
    setOpen(false)
  }, [editor, url])

  const handleRemoveLink = useCallback(() => {
    editor.chain().focus().unsetLink().run()
    setUrl('')
    setOpen(false)
  }, [editor])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSetLink()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    },
    [handleSetLink],
  )

  const handleOpenLinkClick = useCallback(() => {
    if (currentLink) {
      setShowExternalWarning(true)
    }
  }, [currentLink])

  const handleConfirmOpenLink = useCallback(() => {
    if (currentLink) {
      window.open(currentLink, '_blank', 'noopener,noreferrer')
    }
    setShowExternalWarning(false)
  }, [currentLink])

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`bubble-menu-button ${isActive ? 'is-active' : ''}`}
            title="Link"
          >
            <Link2 className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="link-popover" align="start" sideOffset={8}>
          <div className="link-popover-content">
            <Input
              type="url"
              placeholder="Enter URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              className="link-input"
              autoFocus
            />
            <div className="link-popover-actions">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleSetLink}
                className="link-apply-btn"
              >
                Apply
              </Button>
              {isActive && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenLinkClick}
                    title="Open link"
                    className="link-action-btn"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLink}
                    title="Remove link"
                    className="link-action-btn text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <AlertDialog
        open={showExternalWarning}
        onOpenChange={setShowExternalWarning}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this site?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to visit an external website. This link will open in
              a new tab.
              <span className="mt-2 block rounded bg-muted px-2 py-1 font-mono text-xs break-all">
                {currentLink}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOpenLink}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
