# Legacy Real Estate Audit — Hakika / OmniGuard Operations Hub

## Purpose
Forensic read-only audit of the legacy Real Estate implementation in
`C:\Users\evince\Downloads\omniguard-operations-hub` to capture every route,
page, control, form field, data operation, and permission rule required to
recreate the Real Estate application in the new Hakika Business OS.

## Audit Date
2025-07-14

## Legacy Root
`C:\Users\evince\Downloads\omniguard-operations-hub`

## Artifact Index

| File | Contents |
|------|----------|
| project-selection.md | Why this copy was chosen; alternatives |
| route-inventory.md | All Real Estate routes with metadata |
| page-inventory.md | Per-page control counts and completeness |
| control-inventory.md | Every button, link, dropdown, row action |
| form-field-inventory.md | Every form field in exact order |
| table-inventory.md | Every table with columns, filters, actions |
| dialog-inventory.md | Every modal and confirmation dialog |
| action-inventory.md | Every handler traced to DB/service |
| data-access-inventory.md | Every Supabase query and mutation |
| permission-inventory.md | Every role/permission gate |
| responsive-inventory.md | Desktop/mobile layout notes |
| legacy-defects.md | Known bugs and placeholder behavior |
| open-questions.md | Items requiring clarification |
| migration-recommendations.md | Recommended migration order |
| routes.json | Machine-readable route list |
| pages.json | Machine-readable page list |
| controls.json | Machine-readable control list |
| forms.json | Machine-readable form list |
| actions.json | Machine-readable action list |
| data-access.json | Machine-readable data access list |
| permissions.json | Machine-readable permission list |

## Summary Counts (Verified by verify-audit.cjs)
- Real Estate source files: 74
- Real Estate routes documented: 73
- Pages fully audited (source read): 10
- Pages identified but not yet source-read: 54
- Forms documented: 7
- Form fields documented: 90+
- onClick buttons discovered (regex): 159
- navigate() calls discovered: 59
- Links (<Link to=) discovered: 20
- onSubmit forms discovered: 24
- Supabase operations discovered: 197
- Edge Function calls: 4
- callDaraja() calls: 11
- Actions documented in actions.json: 21
- Permission rules documented: 14
- Dialogs documented: 10
- Component coverage: 89% (66/74)
- Undocumented components: 10 (see open-questions.md OQ-001)
