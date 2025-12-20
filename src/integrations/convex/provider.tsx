import { ConvexProviderWithAuthKit } from '@convex-dev/workos'
import { useAuth } from '@workos-inc/authkit-react'
import { ConvexReactClient } from 'convex/react'

const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL
if (!CONVEX_URL) {
  console.error('missing envar VITE_CONVEX_URL')
}
const convex = new ConvexReactClient(CONVEX_URL)

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
