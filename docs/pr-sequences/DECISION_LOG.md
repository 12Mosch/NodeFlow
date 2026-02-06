# Redesign Scope Decision Log

Track all scope-affecting decisions for the redesign program.

## Rules

- Every new request that changes scope must be logged before implementation.
- Every accepted scope addition must include a tradeoff (what is removed or delayed).
- Rejected requests stay in the log for traceability.

## Decision Table

| Date       | Request                                               | Source | Decision | Rationale                                                              | Tradeoff                                       |
| ---------- | ----------------------------------------------------- | ------ | -------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| 2026-02-06 | Keep redesign implementation-only, no product changes | Team   | Approved | Prevent feature creep and keep schedule predictable                    | New feature requests deferred to post-redesign |
| 2026-02-06 | Build PR-sequenced rollout docs (`PR-01` to `PR-08`)  | Team   | Approved | Enables incremental delivery, safer QA, and route-level rollback       | Adds documentation overhead in PR 01           |
| 2026-02-06 | Add scope/baseline/decision governance docs           | Team   | Approved | Creates objective guardrails and baseline references for regression QA | None                                           |

## Deferred Requests

Use this section for good ideas intentionally postponed.

### 2026-02-06 - Centralize `AnalyticsCard` Horizontal Padding

- Request:
  Move repeated `px-6`/`px-3` usage from analytics call sites into
  `AnalyticsCard` variants for consistent, reusable horizontal spacing.
- Source:
  PR-04 review feedback.
- Proposed Change:
  Update `src/components/analytics/AnalyticsCard.tsx` variant behavior so
  padding variants include horizontal spacing defaults, then simplify
  `AnalyticsDashboard` call sites.
- User Value:
  Less duplication and more consistent spacing semantics across analytics pages.
- Timeline Impact:
  Low-to-moderate. Requires shared primitive API change and consumer updates
  beyond PR-04 route-only migration intent.
- Decision:
  Deferred.
- Tradeoff (what gets removed or delayed):
  Keep PR-04 focused on `/analytics` migration only; schedule primitive API
  cleanup in a later PR.
- Notes:
  Consider in a dedicated follow-up after PR-04 to avoid scope creep.

### 2026-02-06 - PR-08 Route Coverage Checklist Docs Target

- Request:
  PR-08 implementation step requires updating docs with a final route coverage
  completion checklist, but `PR-08` file scope does not list a docs target.
- Source:
  PR-08 execution planning and user selection.
- Proposed Change:
  Choose one docs target (`PR-08` file or `BASELINE.md`) and update checklist
  status there during PR-08.
- User Value:
  Clear completion traceability for final rollout QA.
- Timeline Impact:
  Low for either option, but ambiguous target risks out-of-scope edits.
- Decision:
  Deferred.
- Tradeoff (what gets removed or delayed):
  Keep PR-08 implementation scoped to listed code files; defer checklist
  placement decision to follow-up clarification.
- Notes:
  User selected "No docs change" for checklist placement in this PR.

## Rejected Requests

Use this section for explicitly rejected scope additions.

- _None yet._

## Change Request Template

Copy this block for each new scope change request:

```md
### YYYY-MM-DD - <Short Request Name>

- Request:
- Source:
- Proposed Change:
- User Value:
- Timeline Impact:
- Decision:
- Tradeoff (what gets removed or delayed):
- Notes:
```
