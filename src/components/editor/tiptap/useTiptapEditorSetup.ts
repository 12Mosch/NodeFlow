import { useCallback, useEffect, useMemo } from 'react'
import { useTiptapSync } from '@convex-dev/prosemirror-sync/tiptap'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { createEditorExtensions } from './extensions'
import { EMPTY_DOC } from './types'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { BlockData } from '@/extensions/block-sync'
import type { PresenceUser } from '@/hooks/use-presence'
import type { PresenceExtensionOptions } from '@/extensions/presence'
import { triggerMathEdit } from '@/extensions/slash-commands'
import { setSearchQuery } from '@/extensions/search-highlight'
import { setPresenceCollaborators } from '@/extensions/presence'

interface UseTiptapEditorSetupArgs {
  documentId: Id<'documents'>
  collaborators: Array<PresenceUser>
  searchQuery?: string
  onCursorChange?: (
    position: number,
    selectionFrom: number,
    selectionTo: number,
  ) => void
}

export function useTiptapEditorSetup({
  documentId,
  collaborators,
  searchQuery,
  onCursorChange,
}: UseTiptapEditorSetupArgs) {
  const sync = useTiptapSync(api.prosemirrorSync, documentId)
  const { isLoading, initialContent, create, extension } = sync

  const upsertBlock = useMutation(api.blocks.upsertBlock)
  const deleteBlocks = useMutation(api.blocks.deleteBlocks)
  const syncBlocks = useMutation(api.blocks.syncBlocks)

  const toBlockPayload = useCallback((block: BlockData) => {
    return {
      nodeId: block.nodeId,
      type: block.type,
      content: block.content,
      textContent: block.textContent,
      position: block.position,
      attrs: block.attrs,
      isCard: block.isCard,
      cardType: block.cardType,
      cardDirection: block.cardDirection,
      cardFront: block.cardFront,
      cardBack: block.cardBack,
      clozeOcclusions: block.clozeOcclusions,
    }
  }, [])

  const handleCursorChange = useCallback<
    NonNullable<PresenceExtensionOptions['onSelectionChange']>
  >(
    (position, selectionFrom, selectionTo) => {
      onCursorChange?.(position, selectionFrom, selectionTo)
    },
    [onCursorChange],
  )

  const handleBlockUpdate = useCallback(
    (docId: Id<'documents'>, block: BlockData) => {
      void (async () => {
        await upsertBlock({
          documentId: docId,
          ...toBlockPayload(block),
        })
      })().catch((error) => {
        console.error('Failed to upsert block:', error)
      })
    },
    [toBlockPayload, upsertBlock],
  )

  const handleBlocksDelete = useCallback(
    (docId: Id<'documents'>, nodeIds: Array<string>) => {
      void (async () => {
        await deleteBlocks({
          documentId: docId,
          nodeIds,
        })
      })().catch((error) => {
        console.error('Failed to delete blocks:', error)
      })
    },
    [deleteBlocks],
  )

  const handleInitialSync = useCallback(
    (docId: Id<'documents'>, blocks: Array<BlockData>) => {
      void (async () => {
        await syncBlocks({
          documentId: docId,
          blocks: blocks.map(toBlockPayload),
        })
      })().catch((error) => {
        console.error('Failed to sync blocks:', error)
      })
    },
    [syncBlocks, toBlockPayload],
  )

  const handleInlineMathClick = useCallback(
    (node: ProseMirrorNode, pos: number) => {
      const currentLatex = node.attrs.latex || ''
      triggerMathEdit({
        nodeType: 'inlineMath',
        pos,
        latex: currentLatex,
      })
    },
    [],
  )

  const handleBlockMathClick = useCallback(
    (node: ProseMirrorNode, pos: number) => {
      const currentLatex = node.attrs.latex || ''
      triggerMathEdit({
        nodeType: 'blockMath',
        pos,
        latex: currentLatex,
      })
    },
    [],
  )

  useEffect(() => {
    if (!isLoading && initialContent === null) {
      create(EMPTY_DOC)
    }
  }, [isLoading, initialContent, create])

  useEffect(() => {
    setPresenceCollaborators(collaborators)
  }, [collaborators])

  useEffect(() => {
    setSearchQuery(searchQuery ?? '')
  }, [searchQuery])

  const extensions = useMemo(() => {
    return createEditorExtensions({
      documentId,
      onBlockUpdate: handleBlockUpdate,
      onBlocksDelete: handleBlocksDelete,
      onInitialSync: handleInitialSync,
      onCursorChange: handleCursorChange,
      extension,
      onInlineMathClick: handleInlineMathClick,
      onBlockMathClick: handleBlockMathClick,
    })
  }, [
    documentId,
    extension,
    handleBlockMathClick,
    handleBlockUpdate,
    handleBlocksDelete,
    handleCursorChange,
    handleInlineMathClick,
    handleInitialSync,
  ])

  return {
    isLoading,
    initialContent,
    extensions,
  }
}
