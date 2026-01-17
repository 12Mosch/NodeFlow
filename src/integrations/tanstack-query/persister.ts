import { del, get, set } from 'idb-keyval'
import type {
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client'
import * as Sentry from '@sentry/tanstackstart-react'

const IDB_KEY = 'nodeflow-query-cache'

export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(IDB_KEY, client)
      } catch (error) {
        Sentry.captureException(error, {
          tags: { component: 'idb-persister', operation: 'persistClient' },
        })
      }
    },
    restoreClient: async () => {
      try {
        return await get<PersistedClient>(IDB_KEY)
      } catch (error) {
        Sentry.captureException(error, {
          tags: { component: 'idb-persister', operation: 'restoreClient' },
        })
        return undefined
      }
    },
    removeClient: async () => {
      try {
        await del(IDB_KEY)
      } catch (error) {
        Sentry.captureException(error, {
          tags: { component: 'idb-persister', operation: 'removeClient' },
        })
      }
    },
  }
}
