import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAction } from 'convex/react'
import { useAuth } from '@workos-inc/authkit-react'
import { convexQuery } from '@convex-dev/react-query'
import { ChevronsUpDown, LogOut, Settings } from 'lucide-react'
import { api } from '../../convex/_generated/api'
import { AccountSettingsDialog } from './account-settings-dialog'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { SidebarMenuButton } from './ui/sidebar'
import { getInitials } from '@/lib/utils'

export function AccountMenu() {
  const { signOut } = useAuth()
  const { data: user } = useQuery(convexQuery(api.users.getCurrentUser, {}))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const syncFromWorkOS = useAction(api.users.syncFromWorkOS)
  const hasSynced = useRef(false)
  const isSyncing = useRef(false)

  // Sync user data from WorkOS if email or name is missing
  useEffect(() => {
    if (
      user &&
      (!user.email || !user.name) &&
      !hasSynced.current &&
      !isSyncing.current
    ) {
      isSyncing.current = true
      syncFromWorkOS({})
        .then(() => {
          hasSynced.current = true
        })
        .catch((error) => {
          console.error('Failed to sync user data from WorkOS:', error)
          // Don't set hasSynced so it can retry on next render
        })
        .finally(() => {
          isSyncing.current = false
        })
    }
  }, [user, syncFromWorkOS])

  if (!user) {
    return null
  }

  const initials = getInitials(user.name, user.email)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            />
          }
        >
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage src={user.avatarUrl} alt={user.name ?? 'User'} />
            <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">
              {user.name ?? 'No name'}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-(--anchor-width) min-w-56"
          align="end"
          side="top"
          sideOffset={4}
        >
          <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Account Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AccountSettingsDialog
        user={{
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        }}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </>
  )
}
