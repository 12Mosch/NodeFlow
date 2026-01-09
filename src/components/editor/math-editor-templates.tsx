import { MathEditorSymbols } from './math-editor-symbols'
import { MATH_TEMPLATE_CATEGORIES } from './math-editor-constants'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface MathEditorTemplatesProps {
  onInsert: (latex: string, cursorOffset?: number) => void
}

export function MathEditorTemplates({ onInsert }: MathEditorTemplatesProps) {
  return (
    <Tabs defaultValue="fraction" className="math-templates-tabs">
      <TabsList className="math-templates-tabs-list">
        {MATH_TEMPLATE_CATEGORIES.map((category) => (
          <TabsTrigger
            key={category.id}
            value={category.id}
            className="math-templates-tab"
            title={category.name}
            aria-label={category.name}
          >
            <span className="math-tab-icon">{category.icon}</span>
          </TabsTrigger>
        ))}
        <TabsTrigger
          value="symbols"
          className="math-templates-tab"
          title="Symbols"
          aria-label="Symbols"
        >
          <span className="math-tab-icon">αβ</span>
        </TabsTrigger>
      </TabsList>

      {MATH_TEMPLATE_CATEGORIES.map((category) => (
        <TabsContent
          key={category.id}
          value={category.id}
          className="math-templates-tab-content"
        >
          <div className="math-templates-grid">
            {category.templates.map((template) => (
              <button
                key={template.name}
                type="button"
                className="math-template-button"
                onClick={() => onInsert(template.latex, template.cursorOffset)}
                title={template.name}
                aria-label={`Insert ${template.name}`}
              >
                <span className="math-template-label">{template.name}</span>
              </button>
            ))}
          </div>
        </TabsContent>
      ))}

      <TabsContent value="symbols" className="math-templates-tab-content">
        <MathEditorSymbols onInsert={onInsert} />
      </TabsContent>
    </Tabs>
  )
}
