import { ChevronDown, ChevronsRight, Circle } from 'lucide-react'
import { useRef } from 'react'
import { useMutation } from 'convex/react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { Link } from '@tanstack/react-router'
import * as Sentry from '@sentry/tanstackstart-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

interface BlockItemProps {
  block: {
    _id: Id<'blocks'>
    text: string
    isCollapsed: boolean
    rank: number
    parentId?: Id<'blocks'>
  }
  parentBlock?: {
    _id: Id<'blocks'>
    parentId?: Id<'blocks'>
    rank: number
  }
  previousBlock?: { _id: Id<'blocks'>; rank: number }
  nextBlock?: { _id: Id<'blocks'>; rank: number }
  level: number
}

function BlockTreeBase({ rootId }: { rootId?: Id<'blocks'> }) {
  const { data: rootBlock } = useSuspenseQuery(
    convexQuery(api.blocks.getOne, rootId ? { id: rootId } : 'skip'),
  )

  if (rootId && rootBlock === null) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">Block not found</h1>
        <p className="text-muted-foreground mb-6">
          This block doesn't exist or you don't have access to it.
        </p>
        <Link to="/" className="text-primary hover:underline">
          Go back home
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-8 font-sans">
      <h1 className="text-3xl font-bold mb-6 text-foreground">
        {rootBlock ? rootBlock.text || 'Untitled' : 'Notes'}
      </h1>
      <BlockList parentId={rootId} level={0} />
    </div>
  )
}

export const BlockTree = Sentry.withProfiler(BlockTreeBase, {
  name: 'BlockTree',
})

const BlockList = Sentry.withProfiler(
  ({
    parentId,
    parentBlock,
    level = 0,
  }: {
    parentId?: Id<'blocks'>
    parentBlock?: { _id: Id<'blocks'>; parentId?: Id<'blocks'>; rank: number }
    level: number
  }) => {
    const { data: blocks } = useSuspenseQuery(
      convexQuery(api.blocks.get, { parentId }),
    )

    return (
      <div className="flex flex-col relative group">
        {level > 0 && (
          <div className="absolute left-0 top-0 bottom-0 w-px bg-border/50 group-hover:bg-border transition-colors -ml-3" />
        )}

        {blocks.map((block, index) => (
          <BlockItem
            key={block._id}
            block={block}
            parentBlock={parentBlock}
            previousBlock={blocks[index - 1]}
            nextBlock={blocks[index + 1]}
            level={level}
          />
        ))}

        {blocks.length === 0 && level === 0 && (
          <div className="text-muted-foreground italic mt-4">
            Press Enter to create a block.
            <div className="mt-2">
              <CreateFirstBlockButton />
            </div>
          </div>
        )}
      </div>
    )
  },
  { name: 'BlockList' },
)

function CreateFirstBlockButton() {
  const create = useMutation(api.blocks.create)
  return (
    <button
      className="bg-primary text-primary-foreground px-4 py-2 rounded shadow hover:opacity-90 transition-opacity"
      onClick={() => create({ text: '' })}
    >
      Create first block
    </button>
  )
}

const BlockItem = Sentry.withProfiler(
  ({ block, parentBlock, previousBlock, nextBlock, level }: BlockItemProps) => {
    const update = useMutation(api.blocks.update).withOptimisticUpdate(
      (localStore, args) => {
        const parentId = block.parentId
        const existing = localStore.getQuery(api.blocks.get, { parentId })
        if (existing) {
          localStore.setQuery(
            api.blocks.get,
            { parentId },
            existing.map((b) => {
              if (b._id === args.id) {
                const { id, ...updates } = args
                return { ...b, ...updates }
              }
              return b
            }),
          )
        }
      },
    )
    const create = useMutation(api.blocks.create)
    const move = useMutation(api.blocks.move)
    const deleteBlock = useMutation(api.blocks.deleteBlock)

    const { data: children } = useSuspenseQuery(
      convexQuery(api.blocks.get, { parentId: block._id }),
    )
    const hasChildren = children.length > 0

    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const handleKeyDown = async (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        await Sentry.startSpan(
          { name: 'BlockItem.createSibling', op: 'ui.interaction' },
          async () => {
            await create({
              parentId: block.parentId,
              text: '',
              afterId: block._id,
            })
          },
        )
      } else if (e.key === 'Tab') {
        e.preventDefault()
        if (e.shiftKey) {
          // Outdent
          if (parentBlock) {
            await Sentry.startSpan(
              { name: 'BlockItem.outdent', op: 'ui.interaction' },
              async () => {
                await move({
                  id: block._id,
                  parentId: parentBlock.parentId,
                  afterId: parentBlock._id,
                })
              },
            )
          }
        } else {
          // Indent
          if (previousBlock) {
            await Sentry.startSpan(
              { name: 'BlockItem.indent', op: 'ui.interaction' },
              async () => {
                await move({
                  id: block._id,
                  parentId: previousBlock._id,
                })
                update({ id: previousBlock._id, isCollapsed: false })
              },
            )
          }
        }
      } else if (e.key === 'Backspace' && block.text === '') {
        e.preventDefault()
        await Sentry.startSpan(
          { name: 'BlockItem.delete', op: 'ui.interaction' },
          async () => {
            await deleteBlock({ id: block._id })
          },
        )
      } else if (e.key === 'ArrowUp') {
        const prev = document.getElementById(`block-${previousBlock?._id}`)
        if (prev) prev.querySelector('textarea')?.focus()
      } else if (e.key === 'ArrowDown') {
        const next = document.getElementById(`block-${nextBlock?._id}`)
        if (next) next.querySelector('textarea')?.focus()
      }
    }

    return (
      <div className="flex flex-col my-1" id={`block-${block._id}`}>
        <div className="flex items-start group/row">
          <div
            className="flex items-center justify-center w-6 h-6 mr-1 mt-0.5 shrink-0 hover:bg-muted rounded cursor-pointer select-none transition-colors"
            onClick={() =>
              Sentry.startSpan(
                { name: 'BlockItem.toggleCollapse', op: 'ui.interaction' },
                () => {
                  update({ id: block._id, isCollapsed: !block.isCollapsed })
                },
              )
            }
          >
            {hasChildren ? (
              block.isCollapsed ? (
                <ChevronsRight className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )
            ) : (
              <Circle className="w-2 h-2 fill-muted-foreground text-muted-foreground/50" />
            )}
          </div>

          <textarea
            ref={textareaRef}
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none overflow-hidden min-h-6 leading-6 text-base text-foreground placeholder-muted-foreground/40"
            value={block.text}
            onChange={(e) => {
              e.target.style.height = 'inherit'
              e.target.style.height = `${e.target.scrollHeight}px`
              update({ id: block._id, text: e.target.value })
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type something..."
          />
        </div>

        {!block.isCollapsed && (
          <div className="pl-6">
            <BlockList
              parentId={block._id}
              parentBlock={block}
              level={level + 1}
            />
          </div>
        )}
      </div>
    )
  },
  { name: 'BlockItem' },
)
