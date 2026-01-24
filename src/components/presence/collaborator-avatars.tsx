import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getInitials } from '@/lib/utils'

/** Minimal collaborator info needed for avatar display */
export interface CollaboratorInfo {
  sessionId: string
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
    <div className="flex items-center -space-x-2">
      {visibleCollaborators.map((user, index) => (
        <Tooltip key={user.sessionId}>
          <TooltipTrigger asChild>
            <div
              className="relative rounded-full ring-2 ring-background"
              style={{ zIndex: visibleCollaborators.length - index }}
            >
              <Avatar className="h-7 w-7">
                {user.avatarUrl && (
                  <AvatarImage src={user.avatarUrl} alt={user.name || 'User'} />
                )}
                <AvatarFallback
                  className="text-xs font-medium text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              {/* Color indicator ring */}
              <span
                className="absolute inset-0 rounded-full ring-2"
                style={{ '--tw-ring-color': user.color } as React.CSSProperties}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <span>{user.name || 'Anonymous'}</span>
            {user.isAnonymous && (
              <span className="ml-1 text-muted-foreground">(Guest)</span>
            )}
          </TooltipContent>
        </Tooltip>
      ))}

      {overflowCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative rounded-full ring-2 ring-background">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-muted text-xs font-medium">
                  +{overflowCount}
                </AvatarFallback>
              </Avatar>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            <div className="flex flex-col gap-1">
              {overflowCollaborators.map((user) => (
                <span key={user.sessionId}>
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
