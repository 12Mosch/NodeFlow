import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useMutation } from 'convex/react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { getPresenceColor } from '@/lib/presence-colors'

// Heartbeat interval: 10 seconds
const HEARTBEAT_INTERVAL_MS = 10 * 1000
// Debounce interval for cursor updates: 150ms
const CURSOR_UPDATE_DEBOUNCE_MS = 150

export interface PresenceUser {
  id: string
  name: string | undefined
  avatarUrl: string | undefined
  color: string
  isAnonymous: boolean
  cursorPosition: number | undefined
  selectionFrom: number | undefined
  selectionTo: number | undefined
}

interface UsePresenceOptions {
  documentId: Id<'documents'>
  userName?: string
  isAnonymous?: boolean
}

interface UsePresenceReturn {
  collaborators: Array<PresenceUser>
  updateCursor: (
    position: number | undefined,
    selectionFrom?: number,
    selectionTo?: number,
  ) => void
  sessionId: string
}

/**
 * Generate or retrieve a session ID for this browser tab.
 * Uses sessionStorage keyed by documentId for persistence within the tab session.
 */
function getSessionId(documentId: string): string {
  const storageKey = `presence-session-${documentId}`

  // Check sessionStorage first
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem(storageKey)
    if (stored) return stored

    // Generate new session ID
    const newSessionId = crypto.randomUUID()
    sessionStorage.setItem(storageKey, newSessionId)
    return newSessionId
  }

  // Server-side fallback
  return crypto.randomUUID()
}

/**
 * Hook for managing real-time presence in a document.
 * Handles cursor position updates, heartbeats, and cleanup.
 */
export function usePresence({
  documentId,
  userName,
  isAnonymous = false,
}: UsePresenceOptions): UsePresenceReturn {
  const sessionId = useMemo(() => getSessionId(documentId), [documentId])

  // Derive a consistent color from the session ID
  const color = useMemo(() => getPresenceColor(sessionId), [sessionId])

  // Mutations
  const updatePresenceMutation = useMutation(api.presence.updatePresence)
  const removePresenceMutation = useMutation(api.presence.removePresence)
  const setInactiveMutation = useMutation(api.presence.setPresenceInactive)

  // Track last cursor update for debouncing
  const lastCursorUpdate = useRef<number>(0)
  const pendingCursorUpdate = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cursorStateRef = useRef<{
    position: number | undefined
    selectionFrom: number | undefined
    selectionTo: number | undefined
  }>({
    position: undefined,
    selectionFrom: undefined,
    selectionTo: undefined,
  })

  // Send presence update to server
  const sendPresenceUpdate = useCallback(
    (
      position: number | undefined,
      selectionFrom?: number,
      selectionTo?: number,
    ) => {
      void updatePresenceMutation({
        documentId,
        sessionId,
        cursorPosition: position,
        selectionFrom,
        selectionTo,
        name: isAnonymous ? (userName ?? 'Anonymous') : undefined,
        color,
      })
    },
    [
      documentId,
      sessionId,
      color,
      isAnonymous,
      userName,
      updatePresenceMutation,
    ],
  )

  // Debounced cursor update
  const updateCursor = useCallback(
    (
      position: number | undefined,
      selectionFrom?: number,
      selectionTo?: number,
    ) => {
      // Store the latest cursor state
      cursorStateRef.current = { position, selectionFrom, selectionTo }

      const now = Date.now()
      const timeSinceLastUpdate = now - lastCursorUpdate.current

      // Clear any pending update
      if (pendingCursorUpdate.current) {
        clearTimeout(pendingCursorUpdate.current)
        pendingCursorUpdate.current = null
      }

      if (timeSinceLastUpdate >= CURSOR_UPDATE_DEBOUNCE_MS) {
        // Enough time has passed, send immediately
        lastCursorUpdate.current = now
        sendPresenceUpdate(position, selectionFrom, selectionTo)
      } else {
        // Schedule update for later
        const delay = CURSOR_UPDATE_DEBOUNCE_MS - timeSinceLastUpdate
        pendingCursorUpdate.current = setTimeout(() => {
          lastCursorUpdate.current = Date.now()
          const state = cursorStateRef.current
          sendPresenceUpdate(
            state.position,
            state.selectionFrom,
            state.selectionTo,
          )
          pendingCursorUpdate.current = null
        }, delay)
      }
    },
    [sendPresenceUpdate],
  )

  // Initial presence update and heartbeat
  useEffect(() => {
    // Send initial presence update
    sendPresenceUpdate(undefined)

    // Set up heartbeat
    const heartbeatInterval = setInterval(() => {
      const state = cursorStateRef.current
      sendPresenceUpdate(state.position, state.selectionFrom, state.selectionTo)
    }, HEARTBEAT_INTERVAL_MS)

    // Cleanup on unmount
    return () => {
      clearInterval(heartbeatInterval)
      if (pendingCursorUpdate.current) {
        clearTimeout(pendingCursorUpdate.current)
      }
      void removePresenceMutation({ sessionId })
    }
  }, [documentId, sessionId, sendPresenceUpdate, removePresenceMutation])

  // Handle visibility changes (pause heartbeat when tab is hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Mark as inactive when tab is hidden
        void setInactiveMutation({ sessionId })
      } else {
        // Reactivate when tab becomes visible
        const state = cursorStateRef.current
        sendPresenceUpdate(
          state.position,
          state.selectionFrom,
          state.selectionTo,
        )
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [sessionId, setInactiveMutation, sendPresenceUpdate])

  // Handle beforeunload to clean up presence
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Best-effort cleanup: removePresenceMutation({ sessionId }) fires a Convex
      // mutation (WebSocket/HTTP) that may not complete before the page closes.
      // Server-side cleanup of stale presence records is the reliable fallback.
      void removePresenceMutation({ sessionId })
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [sessionId, removePresenceMutation])

  // Subscribe to presence updates for this document
  const { data: presenceRecords } = useQuery({
    ...convexQuery(api.presence.getDocumentPresence, {
      documentId,
      excludeSessionId: sessionId,
    }),
  })

  // Transform presence records to collaborator objects
  const collaborators = useMemo((): Array<PresenceUser> => {
    if (!presenceRecords) return []

    return presenceRecords.map(
      (record): PresenceUser => ({
        // Use _id as unique identifier since sessionId is omitted from query response for security
        id: record._id,
        name: record.name,
        avatarUrl: record.avatarUrl,
        color: record.color,
        isAnonymous: record.isAnonymous,
        cursorPosition: record.cursorPosition,
        selectionFrom: record.selectionFrom,
        selectionTo: record.selectionTo,
      }),
    )
  }, [presenceRecords])

  return {
    collaborators,
    updateCursor,
    sessionId,
  }
}
