import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useLocation,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { useEffect, useRef } from 'react'
import { useAuth } from '@workos-inc/authkit-react'
import { useConvexAuth, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'

import WorkOSProvider from '../integrations/workos/provider'
import ConvexProvider from '../integrations/convex/provider'
import * as TanStackQuery from '../integrations/tanstack-query/root-provider'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { Toaster } from '../components/ui/sonner'
import { ThemeProvider } from '../components/theme-provider'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'NodeFlow',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
})

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, signIn } = useAuth()
  const { isAuthenticated, isLoading: isConvexLoading } = useConvexAuth()
  const storeUser = useMutation(api.users.getOrCreateUser)
  const storeUserRef = useRef(storeUser)
  useEffect(() => {
    storeUserRef.current = storeUser
    // eslint-disable-next-line @tanstack/query/no-unstable-deps
  }, [storeUser])

  const { pathname } = useLocation()

  useEffect(() => {
    if (!isLoading && !user && pathname !== '/callback') {
      signIn()
    }
  }, [isLoading, user, signIn, pathname])

  useEffect(() => {
    if (isAuthenticated) {
      void storeUserRef.current({})
    }
  }, [isAuthenticated])

  if (
    (isLoading || isConvexLoading || !user || !isAuthenticated) &&
    pathname !== '/callback'
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-lg font-medium text-foreground">
          Loading NodeFlow...
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient } = Route.useRouteContext()

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider defaultTheme="system" storageKey="nodeflow-ui-theme">
          <WorkOSProvider>
            <ConvexProvider>
              <TanStackQuery.Provider queryClient={queryClient}>
                <AuthGuard>{children}</AuthGuard>
                <Toaster />
                <TanStackDevtools
                  config={{
                    position: 'bottom-right',
                  }}
                  plugins={[
                    {
                      name: 'Tanstack Router',
                      render: <TanStackRouterDevtoolsPanel />,
                    },
                    TanStackQueryDevtools,
                  ]}
                />
              </TanStackQuery.Provider>
            </ConvexProvider>
          </WorkOSProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
