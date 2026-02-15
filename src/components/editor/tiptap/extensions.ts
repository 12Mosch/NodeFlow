import Color from '@tiptap/extension-color'
import FileHandler from '@tiptap/extension-file-handler'
import Highlight from '@tiptap/extension-highlight'
import { Mathematics } from '@tiptap/extension-mathematics'
import Placeholder from '@tiptap/extension-placeholder'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import type { AnyExtension, Editor } from '@tiptap/core'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { BlockData } from '@/extensions/block-sync'
import type { PresenceExtensionOptions } from '@/extensions/presence'
import { BlockSync } from '@/extensions/block-sync'
import { Callout } from '@/extensions/callout'
import { Database } from '@/extensions/database'
import { ExtendedLink } from '@/extensions/extended-link'
import { FlashcardDecorations } from '@/extensions/flashcard-decorations'
import { ExtendedImage } from '@/extensions/image'
import { LinkDropHandler } from '@/extensions/link-drop-handler'
import { LinkKeys } from '@/extensions/link-keys'
import { OutlinerKeys } from '@/extensions/outliner-keys'
import { PresenceExtension } from '@/extensions/presence'
import { SearchHighlight } from '@/extensions/search-highlight'
import {
  SlashCommands,
  triggerImageDropPaste,
} from '@/extensions/slash-commands'
import { BLOCK_TYPES_WITH_IDS, UniqueID } from '@/extensions/unique-id'

export const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
] as const

interface CreateEditorExtensionsArgs {
  documentId: Id<'documents'>
  onBlockUpdate: (docId: Id<'documents'>, block: BlockData) => void
  onBlocksDelete: (docId: Id<'documents'>, nodeIds: Array<string>) => void
  onInitialSync: (docId: Id<'documents'>, blocks: Array<BlockData>) => void
  onCursorChange?: PresenceExtensionOptions['onSelectionChange']
  extension: AnyExtension | null
  onInlineMathClick: (node: ProseMirrorNode, pos: number) => void
  onBlockMathClick: (node: ProseMirrorNode, pos: number) => void
}

export function createEditorExtensions({
  documentId,
  onBlockUpdate,
  onBlocksDelete,
  onInitialSync,
  onCursorChange,
  extension,
  onInlineMathClick,
  onBlockMathClick,
}: CreateEditorExtensionsArgs) {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3],
      },
      link: false,
    }),
    Placeholder.configure({
      placeholder: 'Start writing...',
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Highlight.configure({
      multicolor: true,
    }),
    TextStyle,
    Color,
    ExtendedLink.configure({
      openOnClick: false,
      HTMLAttributes: {
        class: 'text-primary underline cursor-pointer',
      },
    }),
    ExtendedImage.configure({
      HTMLAttributes: {
        class: 'editor-image',
      },
      allowBase64: false,
    }),
    FileHandler.configure({
      allowedMimeTypes: [...IMAGE_MIME_TYPES],
      onDrop: (_editor: Editor, files: Array<File>, pos: number) => {
        triggerImageDropPaste(files, pos)
      },
      onPaste: (_editor: Editor, files: Array<File>) => {
        triggerImageDropPaste(files)
      },
    }),
    Superscript,
    Subscript,
    Mathematics.configure({
      katexOptions: {
        throwOnError: false,
      },
      inlineOptions: {
        onClick: onInlineMathClick,
      },
      blockOptions: {
        onClick: onBlockMathClick,
      },
    }),
    Callout,
    Database.configure({
      documentId,
    }),
    OutlinerKeys,
    LinkKeys,
    LinkDropHandler,
    SlashCommands,
    UniqueID.configure({
      attributeName: 'blockId',
      types: BLOCK_TYPES_WITH_IDS,
    }),
    BlockSync.configure({
      documentId,
      attributeName: 'blockId',
      debounceMs: 300,
      onBlockUpdate,
      onBlocksDelete,
      onInitialSync,
    }),
    FlashcardDecorations,
    PresenceExtension.configure({
      onSelectionChange: onCursorChange,
    }),
    SearchHighlight,
    extension,
  ].filter((ext): ext is NonNullable<typeof ext> => ext != null)
}
