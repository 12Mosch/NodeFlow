/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { beforeEach, describe, expect, it } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import type { Doc, Id } from './_generated/dataModel'

const modules = import.meta.glob('./**/*.ts')

async function createAuthenticatedContext(t: ReturnType<typeof convexTest>) {
  const workosId = `ghost-title-${Date.now()}-${Math.random()}`
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert('users', {
      workosId,
      email: `${workosId}@example.com`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  })

  return {
    userId,
    asUser: t.withIdentity({ subject: workosId }),
  }
}

function headingContent(text: string, level = 1) {
  return {
    type: 'heading',
    attrs: { level },
    content: text ? [{ type: 'text', text }] : [],
  }
}

function paragraphContent(text: string) {
  return {
    type: 'paragraph',
    content: text ? [{ type: 'text', text }] : [],
  }
}

async function upsertHeading(
  caller: ReturnType<ReturnType<typeof convexTest>['withIdentity']>,
  {
    documentId,
    nodeId,
    textContent,
    position,
    level = 1,
  }: {
    documentId: Id<'documents'>
    nodeId: string
    textContent: string
    position: number
    level?: number
  },
) {
  await caller.mutation(api.blocks.upsertBlock, {
    documentId,
    nodeId,
    type: 'heading',
    content: headingContent(textContent, level),
    textContent,
    position,
    attrs: { level },
  })
}

async function getDocument(
  t: ReturnType<typeof convexTest>,
  documentId: Id<'documents'>,
): Promise<Doc<'documents'>> {
  const document = await t.run(async (ctx) => await ctx.db.get(documentId))
  if (!document) throw new Error('Expected document to exist')
  return document
}

async function syncBlocks(
  caller: ReturnType<ReturnType<typeof convexTest>['withIdentity']>,
  {
    documentId,
    blocks,
  }: {
    documentId: Id<'documents'>
    blocks: Array<{
      nodeId: string
      type: string
      content: any
      textContent: string
      position: number
      attrs?: any
    }>
  },
) {
  await caller.mutation(api.blocks.syncBlocks, {
    documentId,
    blocks,
  })
}

describe('ghost titles', () => {
  let t: ReturnType<typeof convexTest>

  beforeEach(() => {
    t = convexTest(schema, modules)
  })

  it('promotes first non-empty heading of any level to title for new Untitled docs', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {})

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'heading-1',
      textContent: '  Getting Started  ',
      position: 0,
      level: 2,
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Getting Started')
    expect(document.titleMode).toBe('auto')
    expect(document.titleSourceNodeId).toBe('heading-1')
  })

  it('updates title when the source heading text changes in auto mode', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {})

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'heading-1',
      textContent: 'First Title',
      position: 0,
    })
    await upsertHeading(asUser, {
      documentId,
      nodeId: 'heading-1',
      textContent: 'Updated Title',
      position: 0,
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Updated Title')
    expect(document.titleSourceNodeId).toBe('heading-1')
    expect(document.titleMode).toBe('auto')
  })

  it('reselects first available heading when source heading is removed', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {})

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'source-heading',
      textContent: 'Canonical Title',
      position: 0,
    })
    await upsertHeading(asUser, {
      documentId,
      nodeId: 'other-heading',
      textContent: 'Another Heading',
      position: 1,
    })

    await asUser.mutation(api.blocks.deleteBlock, {
      documentId,
      nodeId: 'source-heading',
    })

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'other-heading',
      textContent: 'Another Heading Updated',
      position: 0,
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Another Heading Updated')
    expect(document.titleSourceNodeId).toBe('other-heading')
    expect(document.titleMode).toBe('auto')
  })

  it('deleteBlock immediately reselects title source without requiring a later write', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {})

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'source-heading',
      textContent: 'Canonical Title',
      position: 0,
    })
    await upsertHeading(asUser, {
      documentId,
      nodeId: 'other-heading',
      textContent: 'Fallback Heading',
      position: 1,
    })

    await asUser.mutation(api.blocks.deleteBlock, {
      documentId,
      nodeId: 'source-heading',
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Fallback Heading')
    expect(document.titleSourceNodeId).toBe('other-heading')
    expect(document.titleMode).toBe('auto')
  })

  it('reselects source when original source is deleted before a later heading is added', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {})

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'source-heading',
      textContent: 'Canonical Title',
      position: 0,
    })

    await asUser.mutation(api.blocks.deleteBlock, {
      documentId,
      nodeId: 'source-heading',
    })

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'replacement-heading',
      textContent: 'Replacement Title',
      position: 0,
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Replacement Title')
    expect(document.titleSourceNodeId).toBe('replacement-heading')
    expect(document.titleMode).toBe('auto')
  })

  it('switches to manual mode after updateTitle and ignores subsequent heading updates', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {})

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'heading-1',
      textContent: 'Auto Title',
      position: 0,
    })

    await asUser.mutation(api.documents.updateTitle, {
      id: documentId,
      title: 'Manual Title',
    })

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'heading-1',
      textContent: 'Auto Title Changed',
      position: 0,
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Manual Title')
    expect(document.titleMode).toBe('manual')
    expect(document.titleSourceNodeId).toBeUndefined()
  })

  it('does not auto-sync legacy docs without titleMode', async () => {
    const { userId, asUser } = await createAuthenticatedContext(t)
    const now = Date.now()
    const documentId = await t.run(async (ctx) => {
      return await ctx.db.insert('documents', {
        userId,
        title: 'Untitled',
        createdAt: now,
        updatedAt: now,
      })
    })

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'heading-legacy',
      textContent: 'Legacy Heading',
      position: 0,
      level: 3,
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Untitled')
    expect(document.titleMode).toBeUndefined()
    expect(document.titleSourceNodeId).toBeUndefined()
  })

  it('allows public-edit non-owners to trigger auto title sync', async () => {
    const owner = await createAuthenticatedContext(t)
    const editor = await createAuthenticatedContext(t)
    const documentId = await owner.asUser.mutation(api.documents.create, {})

    await t.run(async (ctx) => {
      await ctx.db.patch(documentId, {
        isPublic: true,
        publicPermission: 'edit',
      })
    })

    await upsertHeading(editor.asUser, {
      documentId,
      nodeId: 'shared-heading',
      textContent: 'Shared Edit Title',
      position: 0,
      level: 2,
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Shared Edit Title')
    expect(document.titleMode).toBe('auto')
    expect(document.titleSourceNodeId).toBe('shared-heading')
  })

  it('syncBlocks promotes first non-empty heading and stores source node', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {})

    await syncBlocks(asUser, {
      documentId,
      blocks: [
        {
          nodeId: 'paragraph-1',
          type: 'paragraph',
          content: paragraphContent('Intro text'),
          textContent: 'Intro text',
          position: 0,
        },
        {
          nodeId: 'heading-sync',
          type: 'heading',
          content: headingContent('Synced Heading', 2),
          textContent: 'Synced Heading',
          position: 1,
          attrs: { level: 2 },
        },
      ],
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Synced Heading')
    expect(document.titleMode).toBe('auto')
    expect(document.titleSourceNodeId).toBe('heading-sync')
  })

  it('reselects heading source when original source is converted to a non-heading block', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {})

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'source-heading',
      textContent: 'Canonical Title',
      position: 0,
    })
    await upsertHeading(asUser, {
      documentId,
      nodeId: 'other-heading',
      textContent: 'Other Title',
      position: 1,
    })

    await asUser.mutation(api.blocks.upsertBlock, {
      documentId,
      nodeId: 'source-heading',
      type: 'paragraph',
      content: paragraphContent('Converted'),
      textContent: 'Converted',
      position: 0,
    })

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'other-heading',
      textContent: 'Other Title Updated',
      position: 1,
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Other Title Updated')
    expect(document.titleMode).toBe('auto')
    expect(document.titleSourceNodeId).toBe('other-heading')
  })

  it('deleteBlocks immediately reselects title source to remaining heading', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {})

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'source-heading',
      textContent: 'Canonical Title',
      position: 0,
    })
    await upsertHeading(asUser, {
      documentId,
      nodeId: 'other-heading',
      textContent: 'Fallback Heading',
      position: 1,
    })

    await asUser.mutation(api.blocks.deleteBlocks, {
      documentId,
      nodeIds: ['source-heading'],
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Fallback Heading')
    expect(document.titleSourceNodeId).toBe('other-heading')
    expect(document.titleMode).toBe('auto')
  })

  it('keeps title but clears source when tracked heading becomes empty', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {})

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'source-heading',
      textContent: 'Canonical Title',
      position: 0,
    })

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'source-heading',
      textContent: '   ',
      position: 0,
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Canonical Title')
    expect(document.titleMode).toBe('auto')
    expect(document.titleSourceNodeId).toBeUndefined()
  })

  it('does not change title when no headings exist', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {})

    await syncBlocks(asUser, {
      documentId,
      blocks: [
        {
          nodeId: 'paragraph-1',
          type: 'paragraph',
          content: paragraphContent('Only paragraph content'),
          textContent: 'Only paragraph content',
          position: 0,
        },
      ],
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Untitled')
    expect(document.titleMode).toBe('auto')
    expect(document.titleSourceNodeId).toBeUndefined()
  })

  it('skips empty headings and picks the first non-empty heading', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {})

    await syncBlocks(asUser, {
      documentId,
      blocks: [
        {
          nodeId: 'heading-empty',
          type: 'heading',
          content: headingContent('   ', 1),
          textContent: '   ',
          position: 0,
          attrs: { level: 1 },
        },
        {
          nodeId: 'heading-valid',
          type: 'heading',
          content: headingContent('First Valid Heading', 3),
          textContent: 'First Valid Heading',
          position: 1,
          attrs: { level: 3 },
        },
      ],
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('First Valid Heading')
    expect(document.titleMode).toBe('auto')
    expect(document.titleSourceNodeId).toBe('heading-valid')
  })

  it('stores titleSourceNodeId even when heading text equals current title', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {})

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'heading-untitled',
      textContent: 'Untitled',
      position: 0,
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Untitled')
    expect(document.titleMode).toBe('auto')
    expect(document.titleSourceNodeId).toBe('heading-untitled')
  })

  it('creates custom-titled documents in manual mode and never auto-syncs', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {
      title: 'Custom Start',
    })

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'heading-1',
      textContent: 'Auto Candidate',
      position: 0,
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Custom Start')
    expect(document.titleMode).toBe('manual')
    expect(document.titleSourceNodeId).toBeUndefined()
  })

  it('treats explicitly passed Untitled as auto mode', async () => {
    const { asUser } = await createAuthenticatedContext(t)
    const documentId = await asUser.mutation(api.documents.create, {
      title: 'Untitled',
    })

    await upsertHeading(asUser, {
      documentId,
      nodeId: 'heading-explicit-untitled',
      textContent: 'Explicit Untitled Auto',
      position: 0,
    })

    const document = await getDocument(t, documentId)
    expect(document.title).toBe('Explicit Untitled Auto')
    expect(document.titleMode).toBe('auto')
    expect(document.titleSourceNodeId).toBe('heading-explicit-untitled')
  })
})
