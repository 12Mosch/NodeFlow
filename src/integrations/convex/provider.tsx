import { ConvexProviderWithAuthKit } from '@convex-dev/workos'
import { useAuth } from '@workos-inc/authkit-react'
import { ConvexReactClient } from 'convex/react'
import { ConvexQueryClient } from '@convex-dev/react-query'

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL
if (!CONVEX_URL) {
  console.error('missing envar VITE_CONVEX_URL')
}

export const convex = new ConvexReactClient(CONVEX_URL as string)
export const convexQueryClient = new ConvexQueryClient(convex)

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexProviderWithAuthKit client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithAuthKit>
  )
}
