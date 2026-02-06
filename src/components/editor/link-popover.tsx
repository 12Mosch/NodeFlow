import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import {
  ExternalLink,
  FileText,
  Globe,
  Link2,
  MoveRight,
  Trash2,
} from 'lucide-react'
import { api } from '../../../convex/_generated/api'
import { DocumentLinkPopover } from './document-link-popover'
import type { Id } from '../../../convex/_generated/dataModel'
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
import { cn } from '@/lib/utils'

interface LinkPopoverProps {
  editor: Editor
}

type LinkMode = 'url' | 'document'

export function LinkPopover({ editor }: LinkPopoverProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState<string | null>(null)
  const [showExternalWarning, setShowExternalWarning] = useState(false)
  const [mode, setMode] = useState<LinkMode>('url')

  const isActive = editor.isActive('link')
  const currentLink = editor.getAttributes('link').href as string | undefined
  const currentDocumentId = editor.getAttributes('link').documentId as
    | string
    | undefined

  // Fetch document title if this is a document link
  const { data: linkedDocument } = useQuery(
    convexQuery(
      api.documents.get,
      currentDocumentId ? { id: currentDocumentId as Id<'documents'> } : 'skip',
    ),
  )

  // When popover is open, use the mode state (allows tab toggling).
  // When closed/opening, initialize based on whether it's a document link.
  const derivedMode = open ? mode : currentDocumentId ? 'document' : 'url'

  // Don't prefill URL input with document link paths (e.g., /doc/{id})
  const url =
    urlDraft ?? (open && !currentDocumentId ? (currentLink ?? '') : '')

  const handleSetLink = () => {
    if (!url) {
      editor.chain().focus().unsetLink().run()
    } else {
      // Add https:// if no protocol specified
      const normalizedUrl = url.match(/^https?:\/\//) ? url : `https://${url}`
      editor.chain().focus().setLink({ href: normalizedUrl }).run()
    }
    setOpen(false)
    setUrlDraft(null)
  }

  const handleRemoveLink = () => {
    editor.chain().focus().unsetLink().run()
    setUrlDraft(null)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSetLink()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  const handleOpenLinkClick = () => {
    if (currentDocumentId) {
      // Navigate to document directly
      navigate({ to: '/doc/$docId', params: { docId: currentDocumentId } })
      setOpen(false)
    } else if (currentLink) {
      // Show warning for external links
      setShowExternalWarning(true)
    }
  }

  const handleConfirmOpenLink = () => {
    if (currentLink) {
      window.open(currentLink, '_blank', 'noopener,noreferrer')
    }
    setShowExternalWarning(false)
  }

  const handleClosePopover = () => {
    setOpen(false)
    setUrlDraft(null)
  }

  // Use derivedMode for rendering but track user's explicit mode choice
  const activeMode = derivedMode

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          setUrlDraft(null)
          // Reset mode when opening popover
          if (nextOpen) {
            setMode(currentDocumentId ? 'document' : 'url')
          }
        }}
      >
        <PopoverTrigger
          render={
            <button
              type="button"
              className={`bubble-menu-button ${isActive ? 'is-active' : ''}`}
              title="Link"
            />
          }
        >
          <Link2 className="h-4 w-4" />
        </PopoverTrigger>
        <PopoverContent
          className="link-popover w-72"
          align="start"
          sideOffset={8}
        >
          <div className="link-popover-content flex flex-col gap-3">
            {/* Mode toggle tabs */}
            <div className="flex rounded-md border bg-muted/30 p-0.5">
              <button
                type="button"
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors',
                  activeMode === 'url'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setMode('url')}
              >
                <Globe className="h-3 w-3" />
                URL
              </button>
              <button
                type="button"
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors',
                  activeMode === 'document'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setMode('document')}
              >
                <FileText className="h-3 w-3" />
                Document
              </button>
            </div>

            {/* URL mode content */}
            {activeMode === 'url' && (
              <>
                <Input
                  type="url"
                  placeholder="Enter URL..."
                  value={url}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="link-input"
                  autoFocus
                />
                <div className="link-popover-actions flex gap-1">
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleSetLink}
                    className="link-apply-btn flex-1"
                  >
                    Apply
                  </Button>
                  {isActive && !currentDocumentId && (
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
              </>
            )}

            {/* Document mode content */}
            {activeMode === 'document' && (
              <>
                {/* Show current document link info if editing */}
                {currentDocumentId && linkedDocument && (
                  <div className="flex items-center gap-2 rounded border bg-muted/30 px-2 py-1.5">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-sm">
                      {linkedDocument.title || 'Untitled'}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleOpenLinkClick}
                      title="Go to document"
                      className="h-6 w-6 p-0"
                    >
                      <MoveRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <DocumentLinkPopover
                  editor={editor}
                  onClose={handleClosePopover}
                  currentDocumentId={currentDocumentId}
                />

                {/* Remove link button for document links */}
                {isActive && currentDocumentId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveLink}
                    className="w-full justify-center gap-1.5 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove link
                  </Button>
                )}
              </>
            )}
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
