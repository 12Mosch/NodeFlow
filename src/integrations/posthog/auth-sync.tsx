import { usePostHog } from '@posthog/react'
import { useAuth } from '@workos-inc/authkit-react'
import { useEffect, useRef } from 'react'
import type { User } from '@workos-inc/authkit-react'

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST
const IS_POSTHOG_ENABLED = Boolean(POSTHOG_KEY && POSTHOG_HOST)

function getPersonProperties(user: User) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()

  return {
    ...(user.email ? { email: user.email, $email: user.email } : {}),
    ...(name ? { name, $name: name } : {}),
    ...(user.profilePictureUrl ? { avatar_url: user.profilePictureUrl } : {}),
    workos_user_id: user.id,
  }
}

export function PostHogAuthSync() {
  const posthog = usePostHog()
  const { isLoading, user } = useAuth()
  const identifiedUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!IS_POSTHOG_ENABLED || isLoading) {
      return
    }

    if (!user) {
      if (identifiedUserIdRef.current) {
        posthog.reset()
        identifiedUserIdRef.current = null
      }
      return
    }

    const distinctId = user.id.trim()
    if (!distinctId) {
      return
    }

    if (identifiedUserIdRef.current === distinctId) {
      return
    }

    posthog.identify(distinctId, getPersonProperties(user))
    identifiedUserIdRef.current = distinctId
  }, [isLoading, posthog, user])

  return null
}
