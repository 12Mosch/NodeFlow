import { del, get, set } from 'idb-keyval'
import type {
  PersistedClient,
  Persister,
} from '@tanstack/react-query-persist-client'

const IDB_KEY = 'nodeflow-query-cache'
export function createIDBPersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(IDB_KEY, client)
      } catch (error) {
        console.error('[idb-persister] persistClient failed', error)
      }
    },
    restoreClient: async () => {
      try {
        return await get<PersistedClient>(IDB_KEY)
      } catch (error) {
        console.error('[idb-persister] restoreClient failed', error)
        return undefined
      }
    },
    removeClient: async () => {
      try {
        await del(IDB_KEY)
      } catch (error) {
        console.error('[idb-persister] removeClient failed', error)
      }
    },
  }
}
