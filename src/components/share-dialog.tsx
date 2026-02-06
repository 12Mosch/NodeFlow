import { useMutation, useQuery } from 'convex/react'
import * as Sentry from '@sentry/tanstackstart-react'
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
      Sentry.captureException(error, {
        tags: { operation: 'sharing.copyLink' },
      })
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
      Sentry.captureException(error, {
        tags: { operation: 'sharing.toggleSharing' },
      })
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
      Sentry.captureException(error, {
        tags: { operation: 'sharing.updatePermission' },
      })
      toast.error('Failed to update permission')
    }
  }

  const handleRegenerateLink = async () => {
    try {
      await regenerateSlug({ documentId })
      toast.success('New link generated')
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'sharing.regenerateSlug' },
      })
      toast.error('Failed to generate new link')
    }
  }

  if (settings === undefined || settings === null) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="py-8 text-center text-muted-foreground">
            Loading...
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-125">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
          <DialogDescription>
            Create a public link to share this document with anyone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Enable/disable sharing toggle */}
          <div className="flex items-center justify-between">
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
              <div className="space-y-2">
                <Label>Permission level</Label>
                <RadioGroup
                  value={settings.publicPermission}
                  onValueChange={handlePermissionChange}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="view" id="view" />
                    <Label htmlFor="view" className="font-normal">
                      View only
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="edit" id="edit" />
                    <Label htmlFor="edit" className="font-normal">
                      Can edit
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Share link with copy button */}
              <div className="space-y-2">
                <Label>Share link</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={shareUrl ?? ''}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Regenerate link button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRegenerateLink}
                className="text-muted-foreground"
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
