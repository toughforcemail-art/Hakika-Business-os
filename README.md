# Hakika Business OS

Clean Phase 1 rebuild for the Hakika Business OS. The implementation follows the architecture and database contracts in `Docs/` and targets the new Supabase project only.

## Workspace

- `frontend/` — Next.js App Router entrypoints, shared shells, launcher and public pages.
- `backend/` — Supabase migrations, tests and backend runbooks.
- `packages/` — shared design and contract packages.
- `docs/` — delivery notes and security decisions.
- `tests/` — cross-workspace acceptance notes.

## Commands

```bash
npm ci
npm run check
npm run dev
```

Database commands must be run from `backend/` and the first real `supabase db push` requires explicit approval.

Frontend tooling is standardized on npm with one root `package-lock.json`, Next.js 16, React 19.2 and Node.js 22 LTS (`.nvmrc`).
