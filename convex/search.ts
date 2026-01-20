import { v } from 'convex/values'
import { query } from './_generated/server'
import { requireUser } from './auth'

export const search = query({
  args: {
    query: v.string(),
    documentLimit: v.optional(v.number()),
    blockLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx)
    const q = args.query.trim()

    // Don't search if query is empty or too short
    if (q.length < 2) {
      return { documents: [], blocks: [] }
    }

    const documentLimit = args.documentLimit ?? 20
    const blockLimit = args.blockLimit ?? 50

    // Search documents by title
    const documentResults = await ctx.db
      .query('documents')
      .withSearchIndex('search_title', (searchQuery) =>
        searchQuery.search('title', q).eq('userId', userId),
      )
      .take(documentLimit)

    // Search blocks by text content
    const blockResults = await ctx.db
      .query('blocks')
      .withSearchIndex('search_textContent', (searchQuery) =>
        searchQuery.search('textContent', q).eq('userId', userId),
      )
      .take(blockLimit)

    // Build document map, reusing documents already fetched from title search
    const documentMap = new Map(
      documentResults.map((d) => [d._id, { _id: d._id, title: d.title }]),
    )

    // Only fetch documents we don't already have from title search
    const missingDocIds = [
      ...new Set(
        blockResults
          .map((b) => b.documentId)
          .filter((id) => !documentMap.has(id)),
      ),
    ]

    if (missingDocIds.length > 0) {
      const additionalDocs = await Promise.all(
        missingDocIds.map((id) => ctx.db.get(id)),
      )
      for (const doc of additionalDocs) {
        if (doc) {
          documentMap.set(doc._id, { _id: doc._id, title: doc.title })
        }
      }
    }

    // Format block results with document info
    const blocksWithDocuments = blockResults.map((block) => ({
      _id: block._id,
      documentId: block.documentId,
      documentTitle: documentMap.get(block.documentId)?.title ?? 'Untitled',
      textContent: block.textContent,
      type: block.type,
    }))

    // Format document results
    const documents = documentResults.map((doc) => ({
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
