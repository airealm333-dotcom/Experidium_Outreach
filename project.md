# Outreach Dashboard - Project Documentation

## 1) Project Overview

Outreach Dashboard is a full-stack outreach CRM built with Next.js App Router. It helps a sales/outreach workflow end-to-end:

- import leads from CSV (Apollo-style exports) or directly from Apollo ICP filter modal
- generate personalized cold-email drafts using Groq (Llama 3.3 70B)
- review/edit/approve drafts
- send approved emails through Resend
- receive delivery/open/click/bounce/complaint events via Resend webhooks
- track outcomes in dashboard + analytics + lightweight deal pipeline

Branding and sender identity in code currently target `Experidium`, with default sender `Alex <alex@experidium.online>`.

---

## 2) Tech Stack

- **Framework:** Next.js `16.2.3` (App Router)
- **Runtime UI:** React `19.2.4`
- **Language:** TypeScript (strict mode enabled)
- **Styling:** Tailwind CSS v4 + shadcn/ui + `tw-animate-css`
- **Database ORM:** Prisma `7.7.0`
- **Database adapter:** `@prisma/adapter-pg` + `pg` (PostgreSQL)
- **AI provider:** Groq SDK (`groq-sdk`)
- **Email provider:** Resend SDK (`resend`)
- **Icons:** `lucide-react`
- **Date utilities:** `date-fns`
- **Linting:** ESLint 9 + Next core-web-vitals + TypeScript config

---

## 3) Repository Structure

- `src/app` - App Router pages + API routes
- `src/components` - shared UI and navigation components
- `src/lib` - integrations and core services (`prisma`, `ai`, `resend`, `analytics`)
- `prisma/schema.prisma` - full data model
- `prisma/seed.ts` - default seed data (pipeline stages + default template)
- `n8n workflows/` - external workflow JSON exports
- `public/` - static assets

Generated Prisma client path is configured to:

- `src/generated/prisma`

---

## 4) Main User Flows

### A) Lead import flow

1. User uploads CSV in `/import` or imports from Apollo in `/contacts`.
2. CSV path auto-detects header mappings.
3. `POST /api/import` (CSV) and `POST /api/import/apollo` (Apollo filter payload) parse rows.
4. Apollo import dedupes by `apolloPersonId` (not email) to avoid pagination stalls and duplicate-page loops.
5. Companies are upsert-like created by deterministic `company-<slug>` IDs.
6. For Apollo locked rows (`email_not_unlocked@domain.com`), importer mints unique placeholder emails (`email_not_unlocked+<apolloId>@apollo.local`) so all rows can be inserted under unique `Contact.email`.
7. New contacts are inserted with source `csv-import` or `apollo-saved-search` (Apollo ICP modal path).
8. Apollo import immediately runs bulk enrichment (`/api/v1/people/bulk_match`) in chunks of 10 IDs and updates unlocked work emails.

### B) Draft generation flow

1. User triggers generate from contacts list or contact detail.
2. `POST /api/generate` loads latest email template from DB.
3. For each contact, placeholder prompt is built and sent to Groq.
4. Drafts are saved as `PENDING_REVIEW`.
5. API includes throttling delay: **2100ms between contacts**.
6. If Groq rate limit/quota error appears, remaining contacts are marked skipped in response.

### C) Draft review flow

1. `/drafts` shows recent drafts.
2. User can approve/reject one-by-one, approve all pending, edit draft content, or clear all drafts.
3. Editing + save action sets draft status to `APPROVED`.

### D) Send flow

1. `/send-queue` lists approved drafts.
2. User sends one, selected, or all approved drafts.
3. `POST /api/send` sends each draft through Resend sequentially (1 API call per draft).
4. API includes throttling delay: **2000ms between sends** when bulk sending.
5. On success it creates `EmailSend`, updates draft to `SENT`, sets contact status `CONTACTED`, and writes an email activity.

### E) Webhook/event flow

1. Resend posts events to `POST /api/webhooks/resend`.
2. Optional signature verification uses `RESEND_WEBHOOK_SECRET`.
3. Event mapped to local enum and deduped with SHA-256 event hash.
4. Event persisted to `EmailEvent`.
5. Contact status auto-updated:
   - `BOUNCED` -> `Contact.status = BOUNCED`
   - `COMPLAINED` -> `Contact.status = UNSUBSCRIBED`

---

## 5) Frontend Pages (Navigation)

Defined in `src/components/nav-config.tsx`:

- `/` - Dashboard
- `/contacts` - Contacts list with status tabs, pagination (20/page), search, locked-email visibility toggle, retry enrichment action, select/edit/delete, generate drafts, import from Apollo ICP modal
- `/contacts/[id]` - Contact detail with timeline/actions
- `/pipeline` - Kanban-like deal board with drag/drop stage movement
- `/drafts` - Draft queue and review actions
- `/send-queue` - Approved drafts + send actions + recent sends
- `/analytics` - KPI, trend, domain, funnel, and failure-reason analytics
- `/import` - CSV upload/mapping/import wizard
- `/settings` - API key checks, prompt template editor, sender/pacing display

Layout includes desktop sidebar and mobile sheet navigation.

---

## 6) API Endpoints

### Contacts

- `PATCH /api/contacts/[id]` - update allowed fields (firstName, lastName, email, position, seniority, linkedinUrl, country, state, status)
- `DELETE /api/contacts/[id]` - delete contact

### Activities

- `POST /api/activities` - create NOTE/TASK/EMAIL activity
- `PATCH /api/activities` - update completion flag

### Import

- `POST /api/import` - CSV ingest and mapping-driven contact/company creation
- `POST /api/import/apollo` - Apollo people ingest from ICP filter payload with pagination, dedupe-by-`apolloPersonId`, immediate enrichment trigger, and import debug metadata

### Enrichment / Debug

- `POST /api/enrich/retry` - re-run Apollo bulk enrichment for all contacts still using unlock-placeholder emails
- `GET /api/debug/contacts` - debug snapshot of contact counts + latest contacts (no-store response)

### AI Generation

- `POST /api/generate` - generate drafts for `contactIds`

### Drafts

- `GET /api/drafts/[id]` - fetch one draft
- `PATCH /api/drafts/[id]` - update status/subject/body
- `PATCH /api/drafts/bulk` - set all pending drafts to APPROVED or REJECTED
- `DELETE /api/drafts/bulk` - delete all drafts

### Sending

- `POST /api/send` - send approved drafts via Resend

### Deals

- `POST /api/deals` - create deal
- `PATCH /api/deals/[id]` - update stage/status/title/value
- `DELETE /api/deals/[id]` - delete deal

### Settings

- `GET /api/settings` - fetch latest prompt template
- `PATCH /api/settings` - create/update prompt template

### Analytics

- `GET /api/analytics?range=7d|30d|90d|custom&from=YYYY-MM-DD&to=YYYY-MM-DD`

### Webhooks

- `POST /api/webhooks/resend` - ingest Resend delivery/engagement events

---

## 7) Database Schema Summary (Prisma)

Core models in `prisma/schema.prisma`:

- `Company` - organization data
- `Contact` - lead/prospect entity, unique email, optional unique `apolloPersonId` for Apollo identity/dedupe
- `PipelineStage` - configurable deal stages
- `Deal` - pipeline item tied to contact and stage
- `Activity` - notes/tasks/email logs per contact
- `EmailTemplate` - prompt template source for AI generation
- `EmailDraft` - generated and reviewable draft
- `EmailSend` - sent-mail record mapped to Resend message ID
- `EmailEvent` - webhook event history

Important enums:

- `ContactStatus`: `NEW`, `QUALIFIED`, `CONTACTED`, `REPLIED`, `BOUNCED`, `UNSUBSCRIBED`
- `DealStatus`: `OPEN`, `WON`, `LOST`
- `DraftStatus`: `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `SENT`
- `EmailEventType`: `DELIVERED`, `OPENED`, `CLICKED`, `BOUNCED`, `COMPLAINED`
- `ActivityType`: `TASK`, `NOTE`, `EMAIL`

Notable constraints/relations:

- `Contact.email` unique
- `Contact.apolloPersonId` unique (nullable)
- `EmailSend.resendMessageId` unique (nullable)
- one draft can map to one send (`EmailSend.draftId` unique)
- cascading deletes on many contact-linked records

---

## 8) Integrations

### Groq (AI)

- File: `src/lib/ai.ts`
- Model: `llama-3.3-70b-versatile`
- Prompt placeholders:
  - `{{firstName}}`, `{{lastName}}`
  - `{{position}}`
  - `{{companyName}}`, `{{companyIndustry}}`, `{{companySize}}`, `{{companyDescription}}`

Output parser expects:

- `Subject: ...`
- `Body: ...`

### Resend (Email)

- File: `src/lib/resend.ts`
- One `resend.emails.send(...)` call per recipient
- Default from: `Alex <alex@experidium.online>`

### Resend Webhooks

- File: `src/app/api/webhooks/resend/route.ts`
- Uses optional SVIX-like signature validation with `RESEND_WEBHOOK_SECRET`
- Maps provider events to local event enum and stores raw payload for analytics/debugging

---

## 9) Analytics Logic

Implemented in `src/lib/analytics.ts`.

Provides:

- KPI rates: delivered, open, click, bounce, complaint
- trend time series (daily sent + event counts)
- domain-level breakdown (`gmail.com`, `yahoo.com`, `outlook/hotmail`, others)
- failure reasons extracted from webhook payload JSON
- outreach-to-business funnel (sent -> events -> contacted -> deals)
- business outcomes (won/open value + close win rate)

Thresholds currently hardcoded:

- bounce warning: `3%`
- complaint warning: `0.1%`

Reply-rate is currently unavailable (`null`) in provider-only mode.

---

## 10) Settings Behavior

Settings page shows:

- env key status indicators for `GROQ_API_KEY`, `RESEND_API_KEY`, `DATABASE_URL`
- sender identity display
- editable AI prompt template (persisted via `/api/settings`)
- send pacing card (display-only note; current send delay is hardcoded in API route)

---

## 11) Scripts and Local Commands

From `package.json`:

- `npm run dev` - start dev server
- `npm run build` - `prisma generate` then Next build
- `npm run start` - start production server
- `npm run lint` - run ESLint
- `npm run db:generate` - Prisma client generate
- `npm run db:push` - push schema
- `npm run db:seed` - run seed script
- `npm run db:studio` - open Prisma Studio
- `npm run db:clear` - wipe all app data rows (FK-safe delete order), keep schema intact
- `npm run db:setup` - generate + push + seed

---

## 12) Environment Variables

### Actively used in code

- `DATABASE_URL`
- `GROQ_API_KEY`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `APOLLO_API_KEY`

### Present in `.env.example`

- `DATABASE_URL`
- `GOOGLE_GENERATIVE_AI_API_KEY` (not used by current code)
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `APOLLO_API_KEY`
- `NEXT_PUBLIC_APP_URL`

Note: current AI implementation uses Groq, so `.env.example` still contains a stale Gemini key name and should be aligned if desired.

---

## 13) Seeded Defaults

`prisma/seed.ts` seeds:

- pipeline stages:
  - Lead
  - Contacted
  - Meeting
  - Proposal
  - Won
  - Lost
- default email template (`id: default-template`) with outreach instructions and output format

---

## 14) UI/Design System Notes

- shadcn component registry is configured in `components.json`
- Tailwind v4 and design tokens are in `src/app/globals.css`
- Layout is responsive with:
  - desktop fixed sidebar
  - mobile top bar + drawer sheet

Contacts page behavior:

- server-rendered status tabs derived from current query scope (`All` + non-empty statuses only)
- URL-driven filters (`q`, `status`, `showLocked`, `page`) for shareable state
- offset pagination at 20 records per page with compact pager
- locked Apollo rows hidden by default with explicit Show/Hide and Retry Enrichment controls

---

## 15) External Workflow Assets

Folder `n8n workflows/` contains exported automation JSON:

- `Before_OutReach.json`
- `leadgen.json`
- `outreach_mail.json`

These include Google Sheets and Apollo-oriented automation nodes and appear to be separate/adjacent automations, not directly imported by the Next.js runtime.

---

## 16) Current Limitations and Observations

- No auth/user system; app is single-tenant by design.
- Send pacing and generation pacing are hardcoded in API routes (2.0s send / 2.1s generate).
- Settings page shows pacing inputs but does not currently persist/apply them.
- CSV parser is simple custom parsing and may not handle all edge-case CSV quoting patterns.
- Contact batch delete in UI performs per-contact API calls sequentially.
- `.env.example` mentions Gemini key while implementation uses Groq.
- Apollo enrichment may leave some rows in unlock-placeholder state when Apollo does not return an email (`skippedNoEmail`); these are now manageable via retry + show/hide controls.

---

## 17) Version Snapshot

- App label in UI footer: `Outreach CRM v1.0`
- Package name: `outreach-dashboard`
- Version: `0.1.0`

