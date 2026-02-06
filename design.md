# NodeFlow Design System Brief

## 1. Design Direction

NodeFlow should feel like an editorial analytics desk: precise, fast, and typographically confident.
The visual reference is `src/routes/4.tsx`, translated into a reusable system for the full app.

Core principles:

- Structural integrity: every layout aligns to an 8px grid.
- Monochrome first: neutrals carry most UI; accent colors are semantic only.
- Data clarity over decoration: no heavy shadows or ornamental gradients.
- Source traceability: every analytic insight should link back to originating notes/cards.

## 2. Scope

This brief defines foundations and UI behavior for:

- Analytics dashboard and related data views.
- Shared shell patterns (headers, cards, metrics, tables, filters).
- Chart visual language and interaction rules.

Out of scope for this phase:

- Reworking editor content styles beyond token adoption.
- New analytics features not already planned in product scope.

## 3. Foundation Tokens

### 3.1 Color System

The palette follows a newspaper-like neutral base with one editorial accent.

`Light`

- `--nf-bg`: `#FFFFFF`
- `--nf-fg`: `#0F0F0F`
- `--nf-muted`: `#6B6B6B`
- `--nf-border`: `#E5E5E5`
- `--nf-rule`: `#111111`
- `--nf-accent`: `#E63946`
- `--nf-success`: `#16A34A`
- `--nf-info`: `#0284C7`
- `--nf-warning`: `#D97706`
- `--nf-danger`: `#DC2626`

`Dark`

- `--nf-bg`: `#0F1115`
- `--nf-fg`: `#F3F4F6`
- `--nf-muted`: `#9CA3AF`
- `--nf-border`: `#2A2D34`
- `--nf-rule`: `#E5E7EB`
- `--nf-accent`: `#FF5A5F`
- `--nf-success`: `#22C55E`
- `--nf-info`: `#38BDF8`
- `--nf-warning`: `#F59E0B`
- `--nf-danger`: `#F87171`

Usage rules:

- Accent red (`--nf-accent`) is reserved for hero metrics, key separators, and critical highlights.
- Success/info/warning/danger are only used for status and chart meaning.
- Avoid decorative color fills in core containers.

### 3.2 Typography

Use a dual type system:

- Display serif: `Instrument Serif` (fallback: `Lora`, `Georgia`, `serif`).
- UI sans: `IBM Plex Sans` (fallback: `Helvetica Neue`, `Arial`, `sans-serif`).

Type scale:

- `display-xl`: 96/92, serif, weight 400 (hero KPI).
- `display-lg`: 72/90, serif, weight 400 (section headline).
- `h1`: 48/96, serif, weight 400.
- `h2`: 32/100, serif, weight 400.
- `title`: 20/120, sans, weight 600.
- `body`: 14/160, sans, weight 400.
- `meta`: 10/140, sans, weight 500, uppercase, tracking `0.20em`.

Usage rules:

- Large numbers and major page titles use serif.
- UI controls, labels, and chart annotations use sans.
- Do not use more than two font families.

### 3.3 Spacing, Grid, Shape

- Base unit: `8px`.
- Section rhythm: `40px` top, `48px` bottom (desktop).
- Card padding: `24px` default, `32px` for dense chart cards.
- Max content width: `1280px`.
- Grid defaults:
- `3-col` KPI row for desktop.
- `2-col` chart/detail row for desktop.
- Collapse to single column below `900px`.
- Radius: `8px` max for interactive controls; analytics containers can be square (`0-6px`).
- Borders: `1px` standard; heavy section rules are `3px`.

### 3.4 Elevation and Surfaces

- Default: flat surfaces with border separation.
- Shadows: minimal and optional (`0 1px 2px`) only for overlays.
- No floating glass effects on analytics pages.

## 4. Component System Rules

### 4.1 App Shell

- Sticky top bar with subtle backdrop (`bg + 80% opacity` and light blur).
- Back action on the left, mode/theme switch on the right.
- Header title pairs icon + text, never icon-only.

### 4.2 Analytics Block (Primary Container)

Every analytic block uses:

- `1px` border with `--nf-border`.
- Optional muted background tint (`2-4%`).
- Internal spacing `24-32px`.
- Title, description, content hierarchy.
- Hover utility action: "Go to source" affordance when actionable.

### 4.3 Metric Cards

- Label in `meta` style.
- Value in serif for major KPIs, sans for compact metrics.
- Helper text in muted body style.
- Avoid decorative icons unless they add meaning.

### 4.4 Tables and Rows

- Horizontal separators only where possible.
- Row density tuned for scan speed (`40-48px` row heights).
- Sticky headers for long tables.

## 5. Data Visualization Standards

### 5.1 Chart Styling

- SVG first for all production charts.
- Line thickness: `2px` (core), `1px` (grid).
- Grid lines are dashed and low contrast.
- Axes and labels use sans meta/body styles.
- Color mapping must remain consistent across the app.

### 5.2 Retention Charts

- Include a benchmark line at `85%` retention.
- 7/30/90 day curves should keep stable colors across pages.
- Missing data renders as gaps, not zero.

### 5.3 Interaction

- Tooltip content must include value, date/time, and source context.
- Clicking anomalous points opens a filtered review list for that time slice.
- Legends are clickable to isolate series.

## 6. Motion and Interaction

- Default transition duration: `120ms`.
- Complex panel/chart transitions: `180ms`.
- Entry easing: `cubic-bezier(0.22, 1, 0.36, 1)`.
- Exit easing: `cubic-bezier(0.4, 0, 1, 1)`.
- Respect `prefers-reduced-motion` by disabling transforms and using opacity-only fades.

## 7. Accessibility and Quality Bar

- Minimum contrast: WCAG AA for all text and UI states.
- Keyboard focus is always visible and at least `2px` equivalent contrast ring.
- All charts require accessible labels and summaries.
- Empty states must explain why data is missing and what action unlocks it.

## 8. Implementation Plan (TanStack + Tailwind + Shadcn)

1. Add NodeFlow design tokens to `src/styles.css` as CSS variables.
2. Define typography utilities for serif display and meta labels.
3. Create reusable primitives:
   - `AnalyticsSection`
   - `AnalyticsCard`
   - `MetricCard` variants (`hero`, `default`, `compact`)
   - `ChartFrame` with shared axes/legend patterns
4. Migrate `src/components/analytics/AnalyticsDashboard.tsx` to these primitives.
5. Apply shell and card rules to `/analytics`, `/study-leeches`, and future insight pages.
6. Run visual QA at `1440px`, `1024px`, `768px`, and `390px`.
7. Validate keyboard navigation and reduced-motion behavior.

## 9. Acceptance Criteria

- UI is recognizably inspired by `/4` (editorial, high-contrast, typographic).
- Visual system is tokenized and reusable across pages.
- Charts are consistent, interactive, and accessible.
- No feature scope expansion is introduced by the redesign spec.
