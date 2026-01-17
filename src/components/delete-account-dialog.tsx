import { useState } from 'react'
import { useAction } from 'convex/react'
import { useAuth } from '@workos-inc/authkit-react'
import * as Sentry from '@sentry/tanstackstart-react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface DeleteAccountDialogProps {
  email: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeleteAccountDialog({
  email,
  open,
  onOpenChange,
}: DeleteAccountDialogProps) {
  const [confirmEmail, setConfirmEmail] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const { signOut } = useAuth()
  const deleteAccount = useAction(api.users.deleteAccount)

  const isConfirmed =
    confirmEmail.trim().toLowerCase() === email.trim().toLowerCase()

  const handleDelete = async () => {
    if (!isConfirmed) return

    setIsDeleting(true)
    try {
      await Sentry.startSpan(
        { name: 'DeleteAccount.delete', op: 'user.delete' },
        async () => {
          await deleteAccount({})
          await signOut()
        },
      )
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'account.delete' },
      })
      toast.error('Failed to delete account. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmEmail('')
    }
    onOpenChange(newOpen)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Account</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              This action cannot be undone. This will permanently delete your
              account and remove all your data including:
            </span>
            <ul className="list-inside list-disc text-sm">
              <li>All documents</li>
              <li>All flashcards and review history</li>
              <li>All uploaded files</li>
            </ul>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor="confirm-email">
            Type <span className="font-semibold">{email}</span> to confirm
          </Label>
          <Input
            id="confirm-email"
            value={confirmEmail}
            onChange={(e) => setConfirmEmail(e.target.value)}
            placeholder="Enter your email"
            autoComplete="off"
            autoFocus
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? 'Deleting...' : 'Delete Account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
