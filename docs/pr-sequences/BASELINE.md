# Redesign Baseline Capture

## Goal

Capture before-state screenshots for every redesign route so PRs 02-08 can be checked for visual regressions without changing behavior.

## Capture Instructions

1. Capture from the pre-redesign baseline state.
2. Use representative seeded data for document, analytics, study, and share views.
3. For parameterized routes, use fixed fixtures:
   - `/doc/$docId` -> `/doc/baseline-doc`
   - `/share/$slug` -> `/share/baseline-share`
4. Capture each route at required viewport widths: `1440`, `1024`, `768`, `390`.
5. Capture both themes at every width: `light` and `dark`.
6. Save images with consistent naming:
   - `<route-key>-<width>-<theme>.png`
   - Example: `analytics-1024-dark.png`

## Required Capture Matrix

| Route            | 1440 Light | 1440 Dark | 1024 Light | 1024 Dark | 768 Light | 768 Dark | 390 Light | 390 Dark |
| ---------------- | ---------- | --------- | ---------- | --------- | --------- | -------- | --------- | -------- |
| `/`              | [ ]        | [ ]       | [ ]        | [ ]       | [ ]       | [ ]      | [ ]       | [ ]      |
| `/doc/$docId`    | [ ]        | [ ]       | [ ]        | [ ]       | [ ]       | [ ]      | [ ]       | [ ]      |
| `/analytics`     | [ ]        | [ ]       | [ ]        | [ ]       | [ ]       | [ ]      | [ ]       | [ ]      |
| `/study`         | [ ]        | [ ]       | [ ]        | [ ]       | [ ]       | [ ]      | [ ]       | [ ]      |
| `/study-leeches` | [ ]        | [ ]       | [ ]        | [ ]       | [ ]       | [ ]      | [ ]       | [ ]      |
| `/share/$slug`   | [ ]        | [ ]       | [ ]        | [ ]       | [ ]       | [ ]      | [ ]       | [ ]      |

## Completion Criteria

- Every checkbox in the matrix is completed.
- Baseline assets are available to reviewers for PR-to-PR comparison.
