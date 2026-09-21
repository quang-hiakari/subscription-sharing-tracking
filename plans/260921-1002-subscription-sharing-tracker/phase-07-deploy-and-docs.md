---
phase: 7
title: "Deploy and docs"
status: pending
priority: P2
effort: "3h"
dependencies: [5, 6]
---

# Phase 7: Deploy and docs

## Overview

Deploy Pages app + cron Worker on the existing Cloudflare account/domain, verify Resend, seed real data, write docs.

## Requirements

- Functional: app on subdomain of existing domain; Worker cron live; production D1 migrated.
- Non-functional: secrets only in Cloudflare (never committed); `.env*` gitignored.

## Architecture

- Pages project: env `ADMIN_EMAILS`, `BETTER_AUTH_SECRET`, `APP_URL`, `RESEND_FROM_EMAIL`, `RESEND_API_KEY`, D1 binding `DB`.
<!-- Updated: Validation Session 1 - env names aligned to sono -->
- Worker needs `RESEND_FROM_EMAIL` and `APP_URL` too (email links).
- Worker: same D1 database id, `RESEND_API_KEY` secret, cron `0 0 * * *`.
- Resend: verify sending domain (SPF/DKIM) before first login attempt.

## Related Code Files

- Create: `docs/{project-overview-pdr,system-architecture,code-standards,deployment-and-setup}.md`, `README.md`, `.gitignore`, `.dev.vars.example`
- Modify: `wrangler.toml`, `worker/wrangler.toml`

## Implementation Steps

1. Verify Resend domain; create sender address.
2. `wrangler d1 migrations apply --remote`.
3. `pnpm deploy` Pages; `wrangler deploy` worker; set secrets.
4. Custom domain via Cloudflare DNS.
5. Smoke test: admin login, add data, submit + approve payment, `wrangler` manual cron trigger sends a reminder to a test member.
6. Seed real subscriptions/members.
7. Docs: architecture (paid_through model, reminder rules), setup/recovery (admin allowlist), cron ops.

## Success Criteria

- [ ] Prod login works for admin and a test member (needs deploy)
- [ ] Scheduled run visible in Worker logs and sends expected reminder (needs deploy)
- [x] No secrets in repo (`git grep` clean; `.env*` and `.dev.vars` ignored, only `.env.example` tracked)
- [x] Docs describe setup, env vars, admin recovery

## Status (docs done, deploy pending user go-ahead)

Done: `README.md`, `docs/{project-overview-pdr,system-architecture,code-standards,deployment-and-setup}.md`, `.env.example`. Every command in the deployment doc except the remote ones was run during development (local D1, `wrangler dev --test-scheduled`, `pages:build`, `wrangler deploy --dry-run`).

Not done, because they create resources or use credentials on the user's Cloudflare/Resend accounts: `wrangler d1 create`, remote migrations, Pages project + secrets, `pnpm deploy`, custom domain, Worker deploy + secret, smoke test.

**Resolved decision:** the public URL variable is now the server-only runtime `APP_URL` (was `NEXT_PUBLIC_APP_URL`, which Next inlines at build time: verified `appUrl:"http://localhost:3000"` in the built bundle). Set it as a Pages secret and in `worker/wrangler.toml` `[vars]`.

## Risk Assessment

- Pages + Worker sharing one D1: apply migrations from one place only (app repo).
- Mis-set cron time: verify first run in JST via logs.
