import { createElement } from 'react'
import { vi } from 'vitest'
import type { ReactNode } from 'react'

export const navigateMock = vi.fn()
export const routerNavigateMock = vi.fn()
export const routerBackMock = vi.fn()

export const routerMock = {
  history: {
    length: 2,
    back: routerBackMock,
  },
  navigate: routerNavigateMock,
}

export function LinkMock({
  children,
  to,
  ...props
}: {
  children?: ReactNode
  to?: string
  [key: string]: unknown
}) {
  const href = typeof to === 'string' ? to : '#'
  return createElement('a', { href, ...props }, children)
}

export function resetRouterMocks() {
  navigateMock.mockReset()
  routerNavigateMock.mockReset()
  routerBackMock.mockReset()
  routerMock.history.length = 2
}
