import { Extension, ReactRenderer } from '@tiptap/react'
import Suggestion from '@tiptap/suggestion'
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Pilcrow,
  Quote,
} from 'lucide-react'
import type { SuggestionOptions } from '@tiptap/suggestion'
import type { Editor } from '@tiptap/core'
import type { SlashMenuRef } from '@/components/editor/slash-menu'
import { SlashMenu } from '@/components/editor/slash-menu'

export interface SlashCommand {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  command: (editor: Editor) => void
  aliases?: Array<string>
  category: 'text' | 'headings' | 'lists' | 'other'
}

export const slashCommands: Array<SlashCommand> = [
  {
    title: 'Text',
    description: 'Plain text paragraph',
    icon: Pilcrow,
    category: 'text',
    aliases: ['paragraph', 'p'],
    command: (editor) => {
      editor.chain().focus().setParagraph().run()
    },
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: Heading1,
    category: 'headings',
    aliases: ['h1', 'title'],
    command: (editor) => {
      editor.chain().focus().toggleHeading({ level: 1 }).run()
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: Heading2,
    category: 'headings',
    aliases: ['h2', 'subtitle'],
    command: (editor) => {
      editor.chain().focus().toggleHeading({ level: 2 }).run()
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: Heading3,
    category: 'headings',
    aliases: ['h3'],
    command: (editor) => {
      editor.chain().focus().toggleHeading({ level: 3 }).run()
    },
  },
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: List,
    category: 'lists',
    aliases: ['ul', 'unordered', 'bullets'],
    command: (editor) => {
      editor.chain().focus().toggleBulletList().run()
    },
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: ListOrdered,
    category: 'lists',
    aliases: ['ol', 'ordered', 'numbers'],
    command: (editor) => {
      editor.chain().focus().toggleOrderedList().run()
    },
  },
  {
    title: 'To-do List',
    description: 'Checklist with checkboxes',
    icon: ListTodo,
    category: 'lists',
    aliases: ['todo', 'task', 'checkbox', 'checklist'],
    command: (editor) => {
      editor.chain().focus().toggleTaskList().run()
    },
  },
  {
    title: 'Code Block',
    description: 'Code snippet',
    icon: Code2,
    category: 'other',
    aliases: ['code', 'pre', 'snippet'],
    command: (editor) => {
      editor.chain().focus().toggleCodeBlock().run()
    },
  },
  {
    title: 'Quote',
    description: 'Blockquote',
    icon: Quote,
    category: 'other',
    aliases: ['blockquote', 'citation'],
    command: (editor) => {
      editor.chain().focus().toggleBlockquote().run()
    },
  },
  {
    title: 'Divider',
    description: 'Horizontal rule',
    icon: Minus,
    category: 'other',
    aliases: ['hr', 'rule', 'separator', 'line'],
    command: (editor) => {
      editor.chain().focus().setHorizontalRule().run()
    },
  },
]

function filterCommands(query: string): Array<SlashCommand> {
  const lowerQuery = query.toLowerCase()
  return slashCommands.filter((cmd) => {
    const titleMatch = cmd.title.toLowerCase().includes(lowerQuery)
    const descMatch = cmd.description.toLowerCase().includes(lowerQuery)
    const aliasMatch = cmd.aliases?.some((alias) =>
      alias.toLowerCase().includes(lowerQuery),
    )
    return titleMatch || descMatch || aliasMatch
  })
}

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor
          range: { from: number; to: number }
          props: SlashCommand
        }) => {
          // Delete the slash and query text
          editor.chain().focus().deleteRange(range).run()
          // Execute the command
          props.command(editor)
        },
      } satisfies Partial<SuggestionOptions<SlashCommand>>,
    }
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      Suggestion<SlashCommand>({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => filterCommands(query),
        render: () => {
          let component: ReactRenderer<SlashMenuRef> | null = null
          let container: HTMLDivElement | null = null

          function updatePosition(
            clientRect: (() => DOMRect | null) | null | undefined,
          ) {
            if (!container || !clientRect) {
              return
            }

            const rect = clientRect()
            if (!rect) {
              return
            }

            container.style.position = 'fixed'
            container.style.left = `${rect.left}px`
            container.style.top = `${rect.bottom + 8}px`
            container.style.zIndex = '9999'
          }

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, {
                editor,
                props,
              })

              // Create a container div for the menu
              container = document.createElement('div')
              container.className = 'slash-menu-container'
              document.body.appendChild(container)
              container.appendChild(component.element)

              // Position the menu
              updatePosition(props.clientRect)
            },

            onUpdate: (props) => {
              component?.updateProps(props)
              updatePosition(props.clientRect)
            },

            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                return true
              }

              return component?.ref?.onKeyDown(props.event) ?? false
            },

            onExit: () => {
              if (container) {
                document.body.removeChild(container)
                container = null
              }
              component?.destroy()
            },
          }
        },
      }),
    ]
  },
})
