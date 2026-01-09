import { MATH_SYMBOL_CATEGORIES } from './math-editor-constants'

interface MathEditorSymbolsProps {
  onInsert: (latex: string, cursorOffset?: number) => void
}

export function MathEditorSymbols({ onInsert }: MathEditorSymbolsProps) {
  return (
    <div className="math-symbols-container">
      {MATH_SYMBOL_CATEGORIES.map((category) => (
        <div key={category.name} className="math-symbols-category">
          <div className="math-symbols-category-name">{category.name}</div>
          <div className="math-symbols-grid">
            {category.symbols.map((symbol) => (
              <button
                key={symbol.latex}
                type="button"
                className="math-symbol-button"
                onClick={() => onInsert(symbol.latex)}
                title={symbol.latex}
                aria-label={`Insert ${symbol.latex}`}
              >
                {symbol.display}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
