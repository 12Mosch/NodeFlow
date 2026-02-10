import { useMutation, useQuery } from 'convex/react'
import { Copy, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Switch } from './ui/switch'
import type { Id } from '../../convex/_generated/dataModel'

interface ShareDialogProps {
  documentId: Id<'documents'>
  open: boolean
  onOpenChange: (open: boolean) => void
}
export function ShareDialog({
  documentId,
  open,
  onOpenChange,
}: ShareDialogProps) {
  // Use Convex's useQuery for reactive updates with optimistic mutations
  const settings = useQuery(
    api.sharing.getSharingSettings,
    open ? { documentId } : 'skip',
  )
  const toggleSharing = useMutation(
    api.sharing.toggleSharing,
  ).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.sharing.getSharingSettings, {
      documentId: args.documentId,
    })
    if (current) {
      localStore.setQuery(
        api.sharing.getSharingSettings,
        {
          documentId: args.documentId,
        },
        {
          ...current,
          isPublic: args.isPublic,
        },
      )
    }
  })
  const updatePermission = useMutation(
    api.sharing.updatePublicPermission,
  ).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.sharing.getSharingSettings, {
      documentId: args.documentId,
    })
    if (current) {
      localStore.setQuery(
        api.sharing.getSharingSettings,
        {
          documentId: args.documentId,
        },
        {
          ...current,
          publicPermission: args.permission,
        },
      )
    }
  })
  const regenerateSlug = useMutation(api.sharing.regeneratePublicSlug)
  const shareUrl = settings?.publicSlug
    ? `${window.location.origin}/share/${settings.publicSlug}`
    : null
  const handleCopyLink = async () => {
    if (!shareUrl) {
      return
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy link. Please try copying manually.')
    }
  }
  const handleToggleSharing = async (checked: boolean) => {
    try {
      await toggleSharing({ documentId, isPublic: checked })
      if (checked) {
        toast.success('Sharing enabled')
      } else {
        toast.success('Sharing disabled')
      }
    } catch (error) {
      toast.error('Failed to toggle sharing')
    }
  }
  const handlePermissionChange = async (value: string) => {
    // Type guard to ensure value is a valid permission
    if (value !== 'view' && value !== 'edit') {
      return
    }
    try {
      await updatePermission({ documentId, permission: value })
      toast.success(`Permission updated to ${value}`)
    } catch (error) {
      toast.error('Failed to update permission')
    }
  }
  const handleRegenerateLink = async () => {
    try {
      await regenerateSlug({ documentId })
      toast.success('New link generated')
    } catch (error) {
      toast.error('Failed to generate new link')
    }
  }
  if (settings == null) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-2xl border border-border/70 bg-card/95 shadow-xl">
          <div className="py-8 text-center text-muted-foreground">
            <span className="inline-flex rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-sm">
              Loading...
            </span>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border border-border/70 bg-card/95 shadow-xl sm:max-w-125">
        <DialogHeader className="space-y-1">
          <DialogTitle className="nf-type-display text-3xl text-foreground">
            Share Document
          </DialogTitle>
          <DialogDescription>
            Create a public link to share this document with anyone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Enable/disable sharing toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
            <Label htmlFor="public-sharing">Enable public sharing</Label>
            <Switch
              id="public-sharing"
              checked={settings.isPublic}
              onCheckedChange={handleToggleSharing}
            />
          </div>

          {settings.isPublic && (
            <>
              {/* Permission level selector */}
              <div className="space-y-3 rounded-xl border border-border/70 bg-card px-4 py-3">
                <Label>Permission level</Label>
                <RadioGroup
                  value={settings.publicPermission}
                  onValueChange={handlePermissionChange}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <RadioGroupItem value="view" id="view" />
                    <Label htmlFor="view" className="font-normal">
                      View only
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                    <RadioGroupItem value="edit" id="edit" />
                    <Label htmlFor="edit" className="font-normal">
                      Can edit
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Share link with copy button */}
              <div className="space-y-2 rounded-xl border border-border/70 bg-card px-4 py-3">
                <Label>Share link</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={shareUrl ?? ''}
                    className="border-border/70 bg-muted/30 font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={handleCopyLink}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Regenerate link button */}
              <Button
                variant="subtle"
                size="sm"
                onClick={handleRegenerateLink}
                className="w-full justify-center text-muted-foreground"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate new link (invalidates current)
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
