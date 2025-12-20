import { AuthKitProvider } from '@workos-inc/authkit-react'
import { useNavigate } from '@tanstack/react-router'

const VITE_WORKOS_CLIENT_ID = import.meta.env.VITE_WORKOS_CLIENT_ID
if (!VITE_WORKOS_CLIENT_ID) {
  throw new Error('Add your WorkOS Client ID to the .env.local file')
}

const VITE_WORKOS_API_HOSTNAME = import.meta.env.VITE_WORKOS_API_HOSTNAME

export default function AppWorkOSProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const navigate = useNavigate()

  return (
    <AuthKitProvider
      clientId={VITE_WORKOS_CLIENT_ID}
      apiHostname={VITE_WORKOS_API_HOSTNAME}
      devMode={import.meta.env.DEV}
      redirectUri={
        import.meta.env.VITE_WORKOS_REDIRECT_URI ||
        (typeof window !== 'undefined'
          ? `${window.location.origin}/callback`
          : '')
      }
      onRedirectCallback={({ state }) => {
        if (state?.returnTo) {
          navigate({ to: state.returnTo })
        } else {
          navigate({ to: '/' })
        }
      }}
    >
      {children}
    </AuthKitProvider>
  )
}
