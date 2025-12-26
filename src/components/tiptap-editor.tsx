import { useCallback, useEffect } from 'react'
import { EditorContent, EditorProvider, useCurrentEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { useTiptapSync } from '@convex-dev/prosemirror-sync/tiptap'
import { useMutation } from 'convex/react'
import * as Sentry from '@sentry/tanstackstart-react'
import {
  Bold,
  Code,
  Code2,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Redo,
  Strikethrough,
  Undo,
} from 'lucide-react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import type { BlockData } from '@/extensions/block-sync'
import { Button } from '@/components/ui/button'
import { BlockSync } from '@/extensions/block-sync'
import { BLOCK_TYPES_WITH_IDS, UniqueID } from '@/extensions/unique-id'
import { OutlinerKeys } from '@/extensions/outliner-keys'
import { SlashCommands } from '@/extensions/slash-commands'

interface TiptapEditorProps {
  documentId: Id<'documents'>
}

const EMPTY_DOC = { type: 'doc', content: [] }

export function TiptapEditor({ documentId }: TiptapEditorProps) {
  const sync = useTiptapSync(api.prosemirrorSync, documentId)

  // Mutations for block-level sync
  const upsertBlock = useMutation(api.blocks.upsertBlock)
  const deleteBlocks = useMutation(api.blocks.deleteBlocks)
  const syncBlocks = useMutation(api.blocks.syncBlocks)

  // Callbacks for block sync extension
  const handleBlockUpdate = useCallback(
    (docId: Id<'documents'>, block: BlockData) => {
      void Sentry.startSpan(
        { name: 'BlockSync.upsertBlock', op: 'convex.mutation' },
        async () => {
          await upsertBlock({
            documentId: docId,
            nodeId: block.nodeId,
            type: block.type,
            content: block.content,
            textContent: block.textContent,
            position: block.position,
            attrs: block.attrs,
          })
        },
      ).catch((error) => {
        // Errors are already captured by Sentry span, but we need to handle the rejection
        console.error('Failed to upsert block:', error)
      })
    },
    [upsertBlock],
  )

  const handleBlocksDelete = useCallback(
    (docId: Id<'documents'>, nodeIds: Array<string>) => {
      void Sentry.startSpan(
        { name: 'BlockSync.deleteBlocks', op: 'convex.mutation' },
        async () => {
          await deleteBlocks({
            documentId: docId,
            nodeIds,
          })
        },
      ).catch((error) => {
        // Errors are already captured by Sentry span, but we need to handle the rejection
        console.error('Failed to delete blocks:', error)
      })
    },
    [deleteBlocks],
  )

  const handleInitialSync = useCallback(
    (docId: Id<'documents'>, blocks: Array<BlockData>) => {
      void Sentry.startSpan(
        { name: 'BlockSync.syncBlocks', op: 'convex.mutation' },
        async () => {
          await syncBlocks({
            documentId: docId,
            blocks: blocks.map((b) => ({
              nodeId: b.nodeId,
              type: b.type,
              content: b.content,
              textContent: b.textContent,
              position: b.position,
              attrs: b.attrs,
            })),
          })
        },
      ).catch((error) => {
        // Errors are already captured by Sentry span, but we need to handle the rejection
        console.error('Failed to sync blocks:', error)
      })
    },
    [syncBlocks],
  )

  // Auto-create the document in prosemirror-sync if it doesn't exist yet
  useEffect(() => {
    if (!sync.isLoading && sync.initialContent === null) {
      sync.create(EMPTY_DOC)
    }
  }, [sync.isLoading, sync.initialContent, sync.create])

  if (sync.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">
          Loading document...
        </div>
      </div>
    )
  }

  // Still waiting for document to be created
  if (sync.initialContent === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">
          Initializing document...
        </div>
      </div>
    )
  }

  const extensions = [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
    }),
    Placeholder.configure({
      placeholder: 'Start writing...',
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    // Outliner keyboard shortcuts (Enter, Shift+Enter, Tab, Shift+Tab)
    OutlinerKeys,
    // Slash commands menu for quick block insertion
    SlashCommands,
    // UniqueID extension to assign block IDs to block-level nodes
    UniqueID.configure({
      attributeName: 'blockId',
      types: BLOCK_TYPES_WITH_IDS,
    }),
    // BlockSync extension to track and persist block changes
    BlockSync.configure({
      documentId,
      attributeName: 'blockId',
      debounceMs: 300,
      onBlockUpdate: handleBlockUpdate,
      onBlocksDelete: handleBlocksDelete,
      onInitialSync: handleInitialSync,
    }),
    sync.extension,
  ]

  return (
    <div className="w-full">
      <EditorProvider
        content={sync.initialContent}
        extensions={extensions}
        immediatelyRender={false}
        slotBefore={<EditorToolbarSlot />}
      >
        <EditorContentWrapper />
      </EditorProvider>
    </div>
  )
}

function EditorContentWrapper() {
  const { editor } = useCurrentEditor()

  if (!editor) {
    return null
  }

  return (
    <>
      <DragHandle editor={editor} className="drag-handle">
        <GripVertical className="h-4 w-4" />
      </DragHandle>
      <EditorContent
        editor={editor}
        className="prose prose-zinc dark:prose-invert max-w-none min-h-[400px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:p-4"
      />
    </>
  )
}

function EditorToolbarSlot() {
  const { editor } = useCurrentEditor()

  if (!editor) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-muted/30 rounded-t-lg sticky top-0 z-10">
      {/* Text formatting */}
      <div className="flex gap-0.5 pr-2 border-r border-border">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          title="Inline code"
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Headings */}
      <div className="flex gap-0.5 px-2 border-r border-border">
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Lists */}
      <div className="flex gap-0.5 px-2 border-r border-border">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive('taskList')}
          title="Task list"
        >
          <ListTodo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Blocks */}
      <div className="flex gap-0.5 px-2 border-r border-border">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="Code block"
        >
          <Code2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal rule"
        >
          <Minus className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* History */}
      <div className="flex gap-0.5 pl-2">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </div>
  )
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-8 w-8 p-0"
    >
      {children}
    </Button>
  )
}
