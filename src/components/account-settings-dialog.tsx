import { useEffect, useState } from 'react'
import { useAction } from 'convex/react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import { DeleteAccountDialog } from './delete-account-dialog'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
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
import { Separator } from './ui/separator'
import { getInitials } from '@/lib/utils'

interface AccountSettingsDialogProps {
  user: {
    name?: string
    email: string
    avatarUrl?: string
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}
export function AccountSettingsDialog({
  user,
  open,
  onOpenChange,
}: AccountSettingsDialogProps) {
  const [name, setName] = useState(user.name ?? '')
  const [email, setEmail] = useState(user.email)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const updateNameInWorkOS = useAction(api.users.updateNameInWorkOS)
  const updateEmailInWorkOS = useAction(api.users.updateEmailInWorkOS)
  useEffect(() => {
    if (open) {
      setName(user.name ?? '')
      setEmail(user.email)
    }
  }, [open, user.name, user.email])
  const nameChanged = name !== (user.name ?? '')
  const emailChanged = email !== user.email
  const hasChanges = nameChanged || emailChanged
  const handleSave = async () => {
    if (!hasChanges) return
    setIsSaving(true)
    try {
      await (async () => {
        // Update name in WorkOS if changed
        if (nameChanged) {
          await updateNameInWorkOS({ name: name || undefined })
        }
        // Update email in WorkOS if changed
        if (emailChanged) {
          await updateEmailInWorkOS({ email })
        }
        toast.success('Account updated')
        onOpenChange(false)
      })()
    } catch (error) {
      toast.error('Failed to update account')
    } finally {
      setIsSaving(false)
    }
  }
  const initials = getInitials(user.name, user.email)
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-ph-mask
          className="ph-mask ph-no-capture sm:max-w-106.25"
        >
          <DialogHeader>
            <DialogTitle>Account Settings</DialogTitle>
            <DialogDescription>
              Manage your account information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.avatarUrl} alt={user.name ?? 'User'} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{user.name ?? 'No name set'}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-destructive">
                Danger Zone
              </h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
              <Button
                variant="destructive"
                onClick={() => {
                  onOpenChange(false)
                  setDeleteDialogOpen(true)
                }}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteAccountDialog
        email={user.email}
        open={deleteDialogOpen}
        onOpenChange={(isOpen) => {
          setDeleteDialogOpen(isOpen)
          if (!isOpen) {
            onOpenChange(true)
          }
        }}
      />
    </>
  )
}
