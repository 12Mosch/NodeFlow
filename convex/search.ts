import { v } from 'convex/values'
import { query } from './_generated/server'
import { getUser } from './auth'
import type { Id } from './_generated/dataModel'

const MIN_SEARCH_QUERY_LENGTH = 2
const RECENT_DOCUMENTS_LIMIT = 10

export const search = query({
  args: {
    query: v.optional(v.string()),
    documentLimit: v.optional(v.number()),
    blockLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getUser(ctx)
    if (!userId) return { documents: [], blocks: [] }
    const q = args.query?.trim() ?? ''

    // If query is empty or too short, return recent documents instead
    if (q.length < MIN_SEARCH_QUERY_LENGTH) {
      const recentDocuments = await ctx.db
        .query('documents')
        .withIndex('by_user_updated', (indexQuery) =>
          indexQuery.eq('userId', userId),
        )
        .order('desc')
        .take(RECENT_DOCUMENTS_LIMIT)

      const documents = recentDocuments.map((doc) => ({
        _id: doc._id,
        title: doc.title,
        updatedAt: doc.updatedAt,
      }))

      return { documents, blocks: [] }
    }

    const documentLimit = args.documentLimit ?? 20
    const blockLimit = args.blockLimit ?? 50
    // Fetch more recent items for fuzzy matching fallback
    const RECENT_ITEMS_LIMIT = 100

    // Run search index queries and recent items queries in parallel
    const [documentResults, blockResults, recentDocuments, recentBlocks] =
      await Promise.all([
        // Search documents by title using search index
        ctx.db
          .query('documents')
          .withSearchIndex('search_title', (searchQuery) =>
            searchQuery.search('title', q).eq('userId', userId),
          )
          .take(documentLimit),
        // Search blocks by text content using search index
        ctx.db
          .query('blocks')
          .withSearchIndex('search_textContent', (searchQuery) =>
            searchQuery.search('textContent', q).eq('userId', userId),
          )
          .take(blockLimit),
        // Fetch recent documents for fuzzy matching fallback
        ctx.db
          .query('documents')
          .withIndex('by_user_updated', (indexQuery) =>
            indexQuery.eq('userId', userId),
          )
          .order('desc')
          .take(RECENT_ITEMS_LIMIT),
        // Fetch recent blocks for fuzzy matching fallback
        // Note: blocks don't have an updatedAt field, so we use _creationTime via order('desc')
        ctx.db
          .query('blocks')
          .withIndex('by_user', (indexQuery) => indexQuery.eq('userId', userId))
          .order('desc')
          .take(RECENT_ITEMS_LIMIT),
      ])

    // Build document map from search results first (they have higher priority)
    const documentMap = new Map<
      Id<'documents'>,
      { _id: Id<'documents'>; title: string }
    >(documentResults.map((d) => [d._id, { _id: d._id, title: d.title }]))

    // Add recent documents to the map if not already present
    for (const doc of recentDocuments) {
      if (!documentMap.has(doc._id)) {
        documentMap.set(doc._id, { _id: doc._id, title: doc.title })
      }
    }

    // Collect document IDs needed for blocks (these are document IDs from the blocks table)
    const blockDocIdsFromSearch = new Set(blockResults.map((b) => b.documentId))
    const blockDocIdsFromRecent = new Set(recentBlocks.map((b) => b.documentId))

    // Fetch any missing documents that are referenced by blocks but not in our document map
    const allBlockDocIds: Array<Id<'documents'>> = Array.from(
      new Set([...blockDocIdsFromSearch, ...blockDocIdsFromRecent]),
    )

    const missingDocIds = allBlockDocIds.filter((id) => !documentMap.has(id))

    if (missingDocIds.length > 0) {
      const additionalDocs = await Promise.all(
        missingDocIds.map((id) => ctx.db.get(id)),
      )
      for (const doc of additionalDocs) {
        if (doc && 'title' in doc) {
          documentMap.set(doc._id, {
            _id: doc._id,
            title: doc.title,
          })
        }
      }
    }

    // Build a set of block IDs from search results for deduplication
    const searchBlockIds = new Set(blockResults.map((b) => b._id))

    // Combine block results: search results first, then recent blocks
    const allBlocks = [
      ...blockResults,
      ...recentBlocks.filter((b) => !searchBlockIds.has(b._id)),
    ]

    // Format block results with document info
    const blocksWithDocuments = allBlocks.map((block) => ({
      _id: block._id,
      documentId: block.documentId,
      documentTitle: documentMap.get(block.documentId)?.title ?? 'Untitled',
      textContent: block.textContent,
      type: block.type,
    }))

    // Format document results: search results first, then recent documents
    const searchDocIds = new Set(documentResults.map((d) => d._id))
    const allDocuments = [
      ...documentResults,
      ...recentDocuments.filter((d) => !searchDocIds.has(d._id)),
    ]

    const documents = allDocuments.map((doc) => ({
      _id: doc._id,
      title: doc.title,
      updatedAt: doc.updatedAt,
    }))

    return {
      documents,
      blocks: blocksWithDocuments,
    }
  },
})
