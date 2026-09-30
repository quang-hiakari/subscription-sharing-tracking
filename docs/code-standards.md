# Code Standards

## General

- TypeScript strict; follow existing patterns; KISS and YAGNI. Files are kebab-case.
- UI copy is Vietnamese. Comments explain why, not what.
- No fake data or mocks in the app. Tests use real SQLite (see below).

## Pages and Server Actions

- Every page and Server Action starts with `requireAdmin()` or `requireMember()`. Never rely on a layout for access control.
- Action signature: `(prev: FormState, formData: FormData) => Promise<FormState>` — never `.bind(null, id)` an argument in. Cloudflare's Workers runtime (via `@opennextjs/cloudflare`) does not reliably resolve a Server Action invoked from a dynamic `[id]` route when it carries a bound closure argument (404 in production only). Pass ids etc. as hidden fields instead: `<ActionForm hidden={{ id }}>`, read with `formId(formData)` (`lib/form-state.ts`). Success calls `redirect()`; failures return `{ error }`. Forms use `components/action-form.tsx`.
- Validate FormData with the zod schemas in `lib/validation/schemas.ts` through `parseForm`. Messages are user-facing.
- Pages and Server Actions that use the database or cookies declare `export const dynamic = 'force-dynamic'` (otherwise Next.js may try to statically prerender the route, and `getCloudflareContext()` has no request to read at build time).
- Reads live in `lib/queries/*`. Payment state changes go only through `lib/payments/service.ts`.

## Data

- Change `lib/db-schema.ts`, then `pnpm db:generate --name <what>` (never hand-edit generated SQL) and `pnpm db:migrate:local`. Commit the migration.
- Dates are `YYYY-MM-DD` strings in JST; use `todayJst`, `addMonths`, `daysBetween` from `lib/format/date.ts`. Money is a whole integer; format with `formatMoney`.
- Multi-statement changes use `db.batch` (a transaction) with compare-and-swap conditions, as in the payment service.
- Deleting is allowed only when nothing references the row; otherwise archive.

## Worker-shared code

Modules the Worker bundles (see architecture doc) use relative imports and no Next or Node-only APIs. Type-only imports from `db-schema` are fine (erased).

## Tests

- `pnpm test` (Vitest). Logic that touches SQL (payments, reminders, fx storage) runs on in-memory SQLite through `lib/payments/sqlite-d1.ts`, which applies the real migrations and gives a D1-shaped API, batches included.
- Cover behaviour, not implementation: idempotency, concurrency, boundaries (month ends, JST vs UTC), and who is allowed.
- Before finishing a change: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm cf:build` (Cloudflare Workers compatibility, via OpenNext).

## Commits

Conventional commits (`feat:`, `fix:`, `docs:`, ...), focused, no secrets. Never commit `.env*` or `.dev.vars` (only `.env.example`).
