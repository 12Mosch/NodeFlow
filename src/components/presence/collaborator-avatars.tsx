import type { CSSProperties } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getInitials } from '@/lib/utils'

/** Minimal collaborator info needed for avatar display */
export interface CollaboratorInfo {
  id: string
  name: string | undefined
  avatarUrl: string | undefined
  color: string
  isAnonymous: boolean
}

interface CollaboratorAvatarsProps {
  collaborators: Array<CollaboratorInfo>
  maxVisible?: number
}

/**
 * Avatar stack showing collaborators currently viewing/editing a document.
 * Shows up to maxVisible avatars with a "+N" overflow indicator.
 */
export function CollaboratorAvatars({
  collaborators,
  maxVisible = 4,
}: CollaboratorAvatarsProps) {
  if (collaborators.length === 0) {
    return null
  }

  const visibleCollaborators: Array<CollaboratorInfo> = collaborators.slice(
    0,
    maxVisible,
  )
  const overflowCount = collaborators.length - maxVisible
  const overflowCollaborators: Array<CollaboratorInfo> =
    collaborators.slice(maxVisible)

  return (
    <div className="flex items-center -space-x-2.5">
      {visibleCollaborators.map((user, index) => (
        <Tooltip key={user.id}>
          <TooltipTrigger
            render={
              <div
                className="relative rounded-full shadow-sm ring-2 ring-background/95"
                style={{ zIndex: visibleCollaborators.length - index }}
              />
            }
          >
            <Avatar className="h-8 w-8">
              {user.avatarUrl && (
                <AvatarImage src={user.avatarUrl} alt={user.name || 'User'} />
              )}
              <AvatarFallback
                className="text-[10px] font-semibold text-white [text-shadow:0_1px_1px_rgb(0_0_0_/_0.35)]"
                style={{ backgroundColor: user.color }}
              >
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            {/* Accent ring keeps avatars legible in both light and dark themes */}
            <span
              className="pointer-events-none absolute inset-0 rounded-full ring-1"
              style={{ '--tw-ring-color': user.color } as CSSProperties}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <span className="text-xs font-medium">
              {user.name || 'Anonymous'}
            </span>
            {user.isAnonymous && (
              <span className="ml-1 text-xs text-muted-foreground">
                (Guest)
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      ))}

      {overflowCount > 0 && (
        <Tooltip>
          <TooltipTrigger
            render={
              <div className="relative rounded-full shadow-sm ring-2 ring-background/95" />
            }
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                +{overflowCount}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <div className="flex flex-col gap-1">
              {overflowCollaborators.map((user) => (
                <span key={user.id} className="text-xs">
                  {user.name || 'Anonymous'}
                  {user.isAnonymous && (
                    <span className="ml-1 text-muted-foreground">(Guest)</span>
                  )}
                </span>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
