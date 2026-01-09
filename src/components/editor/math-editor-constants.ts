export interface MathTemplate {
  name: string
  latex: string
  cursorOffset?: number // Position to place cursor after insertion (from start)
}

export interface MathTemplateCategory {
  id: string
  name: string
  icon: string // Unicode/symbol icon for the tab
  templates: Array<MathTemplate>
}

export interface MathSymbolCategory {
  name: string
  symbols: Array<{ latex: string; display: string }>
}

// Template categories for tabbed interface
export const MATH_TEMPLATE_CATEGORIES: Array<MathTemplateCategory> = [
  {
    id: 'fraction',
    name: 'Fraction',
    icon: 'ⁿ⁄ₓ',
    templates: [
      { name: 'Fraction', latex: '\\frac{}{}', cursorOffset: 6 },
      { name: 'Mixed fraction', latex: ' \\frac{}{}', cursorOffset: 0 },
    ],
  },
  {
    id: 'script',
    name: 'Script',
    icon: 'x²',
    templates: [
      { name: 'Superscript', latex: '^{}', cursorOffset: 2 },
      { name: 'Subscript', latex: '_{}', cursorOffset: 2 },
      { name: 'Sub and super', latex: '_{}^{}', cursorOffset: 2 },
    ],
  },
  {
    id: 'radical',
    name: 'Radical',
    icon: '√',
    templates: [
      { name: 'Square root', latex: '\\sqrt{}', cursorOffset: 6 },
      { name: 'Nth root', latex: '\\sqrt[]{}', cursorOffset: 6 },
      { name: 'Cube root', latex: '\\sqrt[3]{}', cursorOffset: 9 },
    ],
  },
  {
    id: 'integral',
    name: 'Integral',
    icon: '∫',
    templates: [
      { name: 'Integral', latex: '\\int ', cursorOffset: 5 },
      { name: 'Definite integral', latex: '\\int_{}^{}', cursorOffset: 6 },
      { name: 'Double integral', latex: '\\iint ', cursorOffset: 6 },
      { name: 'Triple integral', latex: '\\iiint ', cursorOffset: 7 },
      { name: 'Contour integral', latex: '\\oint ', cursorOffset: 6 },
    ],
  },
  {
    id: 'operator',
    name: 'Large Operator',
    icon: 'Σ',
    templates: [
      { name: 'Sum', latex: '\\sum_{}^{}', cursorOffset: 6 },
      { name: 'Product', latex: '\\prod_{}^{}', cursorOffset: 7 },
      { name: 'Coproduct', latex: '\\coprod_{}^{}', cursorOffset: 9 },
      { name: 'Union', latex: '\\bigcup_{}^{}', cursorOffset: 9 },
      { name: 'Intersection', latex: '\\bigcap_{}^{}', cursorOffset: 9 },
    ],
  },
  {
    id: 'bracket',
    name: 'Bracket',
    icon: '()',
    templates: [
      { name: 'Parentheses', latex: '\\left(  \\right)', cursorOffset: 7 },
      { name: 'Brackets', latex: '\\left[  \\right]', cursorOffset: 7 },
      { name: 'Braces', latex: '\\left\\{  \\right\\}', cursorOffset: 8 },
      {
        name: 'Angle brackets',
        latex: '\\left\\langle  \\right\\rangle',
        cursorOffset: 14,
      },
      { name: 'Absolute value', latex: '\\left|  \\right|', cursorOffset: 7 },
      {
        name: 'Floor',
        latex: '\\left\\lfloor  \\right\\rfloor',
        cursorOffset: 14,
      },
      {
        name: 'Ceiling',
        latex: '\\left\\lceil  \\right\\rceil',
        cursorOffset: 13,
      },
    ],
  },
  {
    id: 'function',
    name: 'Function',
    icon: 'sin',
    templates: [
      { name: 'sin', latex: '\\sin()', cursorOffset: 5 },
      { name: 'cos', latex: '\\cos()', cursorOffset: 5 },
      { name: 'tan', latex: '\\tan()', cursorOffset: 5 },
      { name: 'cot', latex: '\\cot()', cursorOffset: 5 },
      { name: 'sec', latex: '\\sec()', cursorOffset: 5 },
      { name: 'csc', latex: '\\csc()', cursorOffset: 5 },
      { name: 'arcsin', latex: '\\arcsin()', cursorOffset: 8 },
      { name: 'arccos', latex: '\\arccos()', cursorOffset: 8 },
      { name: 'arctan', latex: '\\arctan()', cursorOffset: 8 },
      { name: 'sinh', latex: '\\sinh()', cursorOffset: 6 },
      { name: 'cosh', latex: '\\cosh()', cursorOffset: 6 },
      { name: 'tanh', latex: '\\tanh()', cursorOffset: 6 },
      { name: 'log', latex: '\\log()', cursorOffset: 5 },
      { name: 'ln', latex: '\\ln()', cursorOffset: 4 },
      { name: 'log₁₀', latex: '\\log_{10}()', cursorOffset: 10 },
      { name: 'exp', latex: '\\exp()', cursorOffset: 5 },
    ],
  },
  {
    id: 'accent',
    name: 'Accent',
    icon: 'x̂',
    templates: [
      { name: 'Hat', latex: '\\hat{}', cursorOffset: 5 },
      { name: 'Bar', latex: '\\bar{}', cursorOffset: 5 },
      { name: 'Dot', latex: '\\dot{}', cursorOffset: 5 },
      { name: 'Double dot', latex: '\\ddot{}', cursorOffset: 6 },
      { name: 'Vector', latex: '\\vec{}', cursorOffset: 5 },
      { name: 'Tilde', latex: '\\tilde{}', cursorOffset: 7 },
      { name: 'Overline', latex: '\\overline{}', cursorOffset: 10 },
      { name: 'Underline', latex: '\\underline{}', cursorOffset: 11 },
    ],
  },
  {
    id: 'limit',
    name: 'Limit',
    icon: 'lim',
    templates: [
      { name: 'Limit', latex: '\\lim_{}', cursorOffset: 6 },
      { name: 'Limit to', latex: '\\lim_{x \\to }', cursorOffset: 12 },
      { name: 'Sup', latex: '\\sup_{}', cursorOffset: 6 },
      { name: 'Inf', latex: '\\inf_{}', cursorOffset: 6 },
      { name: 'Max', latex: '\\max_{}', cursorOffset: 6 },
      { name: 'Min', latex: '\\min_{}', cursorOffset: 6 },
    ],
  },
  {
    id: 'matrix',
    name: 'Matrix',
    icon: '[:]',
    templates: [
      {
        name: '2×2 matrix',
        latex: '\\begin{pmatrix}  &  \\\\  &  \\end{pmatrix}',
        cursorOffset: 17,
      },
      {
        name: '3×3 matrix',
        latex: '\\begin{pmatrix}  &  &  \\\\  &  &  \\\\  &  &  \\end{pmatrix}',
        cursorOffset: 17,
      },
      {
        name: '2×2 brackets',
        latex: '\\begin{bmatrix}  &  \\\\  &  \\end{bmatrix}',
        cursorOffset: 17,
      },
      {
        name: '3×3 brackets',
        latex: '\\begin{bmatrix}  &  &  \\\\  &  &  \\\\  &  &  \\end{bmatrix}',
        cursorOffset: 17,
      },
      {
        name: 'Determinant 2×2',
        latex: '\\begin{vmatrix}  &  \\\\  &  \\end{vmatrix}',
        cursorOffset: 17,
      },
    ],
  },
]

// Symbol categories for the symbols tab
export const MATH_SYMBOL_CATEGORIES: Array<MathSymbolCategory> = [
  {
    name: 'Greek lowercase',
    symbols: [
      { latex: '\\alpha', display: 'α' },
      { latex: '\\beta', display: 'β' },
      { latex: '\\gamma', display: 'γ' },
      { latex: '\\delta', display: 'δ' },
      { latex: '\\epsilon', display: 'ε' },
      { latex: '\\varepsilon', display: 'ε' },
      { latex: '\\zeta', display: 'ζ' },
      { latex: '\\eta', display: 'η' },
      { latex: '\\theta', display: 'θ' },
      { latex: '\\vartheta', display: 'ϑ' },
      { latex: '\\iota', display: 'ι' },
      { latex: '\\kappa', display: 'κ' },
      { latex: '\\lambda', display: 'λ' },
      { latex: '\\mu', display: 'μ' },
      { latex: '\\nu', display: 'ν' },
      { latex: '\\xi', display: 'ξ' },
      { latex: '\\pi', display: 'π' },
      { latex: '\\varpi', display: 'ϖ' },
      { latex: '\\rho', display: 'ρ' },
      { latex: '\\varrho', display: 'ϱ' },
      { latex: '\\sigma', display: 'σ' },
      { latex: '\\varsigma', display: 'ς' },
      { latex: '\\tau', display: 'τ' },
      { latex: '\\upsilon', display: 'υ' },
      { latex: '\\phi', display: 'φ' },
      { latex: '\\varphi', display: 'ϕ' },
      { latex: '\\chi', display: 'χ' },
      { latex: '\\psi', display: 'ψ' },
      { latex: '\\omega', display: 'ω' },
    ],
  },
  {
    name: 'Greek uppercase',
    symbols: [
      { latex: '\\Gamma', display: 'Γ' },
      { latex: '\\Delta', display: 'Δ' },
      { latex: '\\Theta', display: 'Θ' },
      { latex: '\\Lambda', display: 'Λ' },
      { latex: '\\Xi', display: 'Ξ' },
      { latex: '\\Pi', display: 'Π' },
      { latex: '\\Sigma', display: 'Σ' },
      { latex: '\\Upsilon', display: 'Υ' },
      { latex: '\\Phi', display: 'Φ' },
      { latex: '\\Psi', display: 'Ψ' },
      { latex: '\\Omega', display: 'Ω' },
    ],
  },
  {
    name: 'Relations',
    symbols: [
      { latex: '=', display: '=' },
      { latex: '\\neq', display: '≠' },
      { latex: '\\approx', display: '≈' },
      { latex: '\\equiv', display: '≡' },
      { latex: '\\sim', display: '∼' },
      { latex: '\\simeq', display: '≃' },
      { latex: '\\cong', display: '≅' },
      { latex: '<', display: '<' },
      { latex: '>', display: '>' },
      { latex: '\\leq', display: '≤' },
      { latex: '\\geq', display: '≥' },
      { latex: '\\ll', display: '≪' },
      { latex: '\\gg', display: '≫' },
      { latex: '\\subset', display: '⊂' },
      { latex: '\\supset', display: '⊃' },
      { latex: '\\subseteq', display: '⊆' },
      { latex: '\\supseteq', display: '⊇' },
      { latex: '\\in', display: '∈' },
      { latex: '\\ni', display: '∋' },
      { latex: '\\notin', display: '∉' },
      { latex: '\\propto', display: '∝' },
    ],
  },
  {
    name: 'Operators',
    symbols: [
      { latex: '+', display: '+' },
      { latex: '-', display: '−' },
      { latex: '\\pm', display: '±' },
      { latex: '\\mp', display: '∓' },
      { latex: '\\times', display: '×' },
      { latex: '\\div', display: '÷' },
      { latex: '\\cdot', display: '·' },
      { latex: '\\ast', display: '∗' },
      { latex: '\\star', display: '⋆' },
      { latex: '\\circ', display: '∘' },
      { latex: '\\bullet', display: '•' },
      { latex: '\\oplus', display: '⊕' },
      { latex: '\\ominus', display: '⊖' },
      { latex: '\\otimes', display: '⊗' },
      { latex: '\\oslash', display: '⊘' },
      { latex: '\\odot', display: '⊙' },
      { latex: '\\cap', display: '∩' },
      { latex: '\\cup', display: '∪' },
      { latex: '\\sqcap', display: '⊓' },
      { latex: '\\sqcup', display: '⊔' },
      { latex: '\\wedge', display: '∧' },
      { latex: '\\vee', display: '∨' },
    ],
  },
  {
    name: 'Arrows',
    symbols: [
      { latex: '\\leftarrow', display: '←' },
      { latex: '\\rightarrow', display: '→' },
      { latex: '\\leftrightarrow', display: '↔' },
      { latex: '\\Leftarrow', display: '⇐' },
      { latex: '\\Rightarrow', display: '⇒' },
      { latex: '\\Leftrightarrow', display: '⇔' },
      { latex: '\\uparrow', display: '↑' },
      { latex: '\\downarrow', display: '↓' },
      { latex: '\\updownarrow', display: '↕' },
      { latex: '\\Uparrow', display: '⇑' },
      { latex: '\\Downarrow', display: '⇓' },
      { latex: '\\Updownarrow', display: '⇕' },
      { latex: '\\mapsto', display: '↦' },
      { latex: '\\longmapsto', display: '⟼' },
      { latex: '\\nearrow', display: '↗' },
      { latex: '\\searrow', display: '↘' },
      { latex: '\\swarrow', display: '↙' },
      { latex: '\\nwarrow', display: '↖' },
    ],
  },
  {
    name: 'Miscellaneous',
    symbols: [
      { latex: '\\infty', display: '∞' },
      { latex: '\\partial', display: '∂' },
      { latex: '\\nabla', display: '∇' },
      { latex: '\\emptyset', display: '∅' },
      { latex: '\\varnothing', display: '∅' },
      { latex: '\\forall', display: '∀' },
      { latex: '\\exists', display: '∃' },
      { latex: '\\nexists', display: '∄' },
      { latex: '\\neg', display: '¬' },
      { latex: '\\angle', display: '∠' },
      { latex: '\\triangle', display: '△' },
      { latex: '\\square', display: '□' },
      { latex: '\\cdots', display: '⋯' },
      { latex: '\\ldots', display: '…' },
      { latex: '\\vdots', display: '⋮' },
      { latex: '\\ddots', display: '⋱' },
      { latex: '\\aleph', display: 'ℵ' },
      { latex: '\\hbar', display: 'ℏ' },
      { latex: '\\ell', display: 'ℓ' },
      { latex: '\\wp', display: '℘' },
      { latex: '\\Re', display: 'ℜ' },
      { latex: '\\Im', display: 'ℑ' },
      { latex: '\\prime', display: '′' },
      { latex: '\\backslash', display: '\\' },
    ],
  },
]

// Greek letters set derived from MATH_SYMBOL_CATEGORIES for syntax highlighting
// Extracts letter names (without backslash) from Greek lowercase and uppercase categories
export const GREEK_LETTERS: Set<string> = new Set(
  MATH_SYMBOL_CATEGORIES.filter(
    (category) =>
      category.name === 'Greek lowercase' ||
      category.name === 'Greek uppercase',
  )
    .flatMap((category) => category.symbols)
    .map((symbol) => symbol.latex.replace(/^\\/, '')),
)
