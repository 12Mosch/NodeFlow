import { Extension } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export interface UniqueIDOptions {
  attributeName: string
  types: Array<string>
  generateID: () => string
}

// Generate a unique ID using crypto.randomUUID
function defaultGenerateID(): string {
  return crypto.randomUUID()
}

export const uniqueIDPluginKey = new PluginKey('uniqueID')

export const UniqueID = Extension.create<UniqueIDOptions>({
  name: 'uniqueID',

  addOptions() {
    return {
      attributeName: 'blockId',
      types: [],
      generateID: defaultGenerateID,
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          [this.options.attributeName]: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute(`data-${this.options.attributeName}`),
            renderHTML: (attributes) => {
              if (!attributes[this.options.attributeName]) {
                return {}
              }
              return {
                [`data-${this.options.attributeName}`]:
                  attributes[this.options.attributeName],
              }
            },
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    const { attributeName, types, generateID } = this.options

    return [
      new Plugin({
        key: uniqueIDPluginKey,
        appendTransaction: (transactions, _oldState, newState) => {
          // Only process if document changed
          const docChanged = transactions.some((tr) => tr.docChanged)
          if (!docChanged) {
            return null
          }

          const { tr } = newState
          const nodesToUpdate: Array<{
            pos: number
            attrs: Record<string, any>
          }> = []

          // Go through all nodes and find block-level nodes missing IDs
          newState.doc.descendants((node, pos) => {
            // Check if node type is in our types list
            if (types.includes(node.type.name)) {
              const attrs = node.attrs
              if (!attrs[attributeName]) {
                nodesToUpdate.push({
                  pos,
                  attrs: {
                    ...attrs,
                    [attributeName]: generateID(),
                  },
                })
              }
            }
          })

          // Apply updates if any
          if (nodesToUpdate.length === 0) {
            return null
          }

          nodesToUpdate.forEach(({ pos, attrs }) => {
            tr.setNodeMarkup(pos, undefined, attrs)
          })

          return tr
        },
      }),
    ]
  },
})

// Get the list of block-level node types that should have IDs
export const BLOCK_TYPES_WITH_IDS: Array<string> = [
  'paragraph',
  'heading',
  'listItem', // Individual list items (nested inside bulletList/orderedList)
  'taskItem', // Individual task items (nested inside taskList)
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'callout',
  'image',
]
