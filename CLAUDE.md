# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Full architecture reference

`project.md` is a maintained, detailed architecture doc for this repo (user flows, every API route, Prisma schema summary, integrations, known limitations). Read it before any non-trivial change, and update it in the same change when you touch schema, API routes, or user flows — this is enforced by `.cursor/rules/project-conventions.mdc`.

## Commands

```bash
npm install
copy .env.example .env      # fill in real keys; never commit .env
npm run db:setup            # prisma generate + db push + seed (needs a reachable DATABASE_URL)
npm run dev                 # start dev server (also runs prisma generate)
npm run build                # prisma generate + next build
npm run lint                 # ESLint
npm run db:generate          # regenerate Prisma client after schema edits
npm run db:push               # push schema.prisma to the database (no migration history is checked in)
npm run db:seed                # re-run prisma/seed.ts
npm run db:studio               # open Prisma Studio
npm run db:clear                 # wipes all app data rows — do not run unless explicitly asked to wipe data
```

There is no test suite in this repo. There is no way to run a "single test."

## Architecture

Next.js 16 App Router CRM (`outreach-dashboard`) for an outreach pipeline: import leads -> generate Groq drafts -> review/approve -> send via Resend -> track delivery/engagement via webhooks -> pipeline/analytics. Single-tenant, no auth — every API is effectively admin.

- `src/app/.../page.tsx` — pages. `src/app/api/.../route.ts` — API routes.
- `src/lib/` — integrations and core services: `prisma.ts`, `ai.ts` (Groq), `resend.ts`, `analytics.ts`, `apollo-enrich.ts`, `apollo-import-handler.ts`, `linkedin-status.ts`, `linkedin-authors.ts`.
- `src/components/` — shared UI (`ui/` is shadcn) and nav (`nav-config.tsx` — add new nav items here).
- `prisma/schema.prisma` is the data model; generated client outputs to `src/generated/prisma` (gitignored, never edit/commit it).
- `n8n workflows/*.json` — exported automations (Apollo/Google Sheets). These are adjacent/external and are not imported or run by the Next.js app.

Key cross-cutting invariants (full detail in `.cursor/rules/outreach-invariants.mdc`, `.cursor/rules/send-and-generate.mdc`, `.cursor/rules/prisma-schema.mdc`):

- `Contact.email` is unique; Apollo import dedupes by `apolloPersonId` instead, and locked/unenriched Apollo rows get placeholder emails (`email_not_unlocked+<apolloId>@apollo.local`) rather than colliding on a shared address.
- Draft lifecycle is `PENDING_REVIEW` -> `APPROVED` -> `SENT`; `POST /api/send` must only ever send `APPROVED` drafts.
- Send pacing (delay + daily cap) is read from the `AppSettings` singleton (`id: "default"`), not hardcoded — defaults are 2s / 100 per day. Draft generation throttles ~2100ms/contact and skips remaining contacts on Groq quota errors.
- Resend webhook route maps provider events to `EmailEvent`, dedupes via a SHA-256 event hash, and auto-updates `Contact.status` (bounce -> `BOUNCED`, complaint -> `UNSUBSCRIBED`); keep the optional `RESEND_WEBHOOK_SECRET` signature check.
- LinkedIn contacts (`source: linkedin-apollo`) use a separate NEW/OUTREACHED status model (`linkedin-status.ts`) distinct from the main `ContactStatus` enum; legacy `CONTACTED` rows there display as Outreached.
- List filters (contacts, LinkedIn list) live in the URL, not component state — see `contacts-url.ts` / `linkedin-url.ts`.
- One vertical slice per change — don't mix schema changes, send/generate logic, and UI redesigns in one pass.
