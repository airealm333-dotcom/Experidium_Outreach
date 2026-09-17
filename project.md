# Outreach Dashboard - Project Documentation

## 1) Project Overview

Outreach Dashboard is a full-stack outreach CRM built with Next.js App Router. It helps a sales/outreach workflow end-to-end:

- import leads from CSV (Apollo-style exports) or directly from Apollo ICP filter modal
- manage a separate LinkedIn contact list (Apollo import requiring a LinkedIn URL, author assignment, NEW/OUTREACHED status)
- generate personalized cold-email drafts using Groq (Llama 3.3 70B)
- review/edit/approve drafts
- send approved emails through Resend (paced + daily cap via `AppSettings`)
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
- `src/lib` - integrations and core services (`prisma`, `ai`, `resend`, `analytics`, Apollo (`apollo-import-handler.ts` people search/import, `apollo-company-search.ts` company search, `apollo-shared.ts` common helpers used by both), LinkedIn helpers, `team-members.ts` assignable-team-member list — `linkedin-authors.ts` is now a re-export shim over it)
- `prisma/schema.prisma` - full data model
- `prisma/seed.ts` - pipeline stages, default template, `AppSettings` singleton
- `.cursor/rules/` - Cursor agent conventions and outreach invariants
- `.env.example` - required environment variable template
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

### A2) LinkedIn list flow

1. `/linkedin` is a separate contact list filtered to source `linkedin-apollo`.
2. Import uses `POST /api/import/apollo/linkedin` (same Apollo handler, `requireLinkedinUrl: true`).
3. Status set is `NEW` / `OUTREACHED` (`linkedin-status.ts`). Legacy `CONTACTED` rows display as Outreached.
4. Rows can be assigned an `author` (`adithyan`, `adarsh`, `vishnu`).

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
4. Delay and daily cap come from `AppSettings` (defaults **2s** between sends, **100** emails/day). Older fallback stored pacing numbers on the email template subject/body fields.
5. On success it creates `EmailSend`, updates draft to `SENT`, sets contact status `CONTACTED`, and writes an email activity.

### E) Webhook/event flow

1. Resend posts events to `POST /api/webhooks/resend`.
2. Optional signature verification uses `RESEND_WEBHOOK_SECRET`.
3. Event mapped to local enum and deduped with SHA-256 event hash.
4. Event persisted to `EmailEvent`.
5. Contact status auto-updated:
   - `BOUNCED` -> `Contact.status = BOUNCED`
   - `COMPLAINED` -> `Contact.status = UNSUBSCRIBED`

### F) Import Campaign flow (in progress, phased build)

Nested Campaign -> Companies -> People workflow, distinct from the existing one-shot Apollo import dialog on `/contacts`/`/linkedin`. A `Campaign` groups companies/contacts sourced together (e.g. "Fintech companies in APAC") and can be assigned to a team member; a `Company`/`Contact` may belong to multiple campaigns (many-to-many via `CampaignCompany`/`CampaignContact`).

- **Phase 1 (done)**: `/import-campaign` list (create/search/filter-by-assignee campaigns), `/import-campaign/[id]` detail view, `Campaign` CRUD via `/api/campaigns` and `/api/campaigns/[id]`, assignee reassignment.
- **Phase 2 (done)**: live Apollo company search (`src/lib/apollo-company-search.ts`, `POST https://api.apollo.io/api/v1/mixed_companies/search`) and attaching/detaching companies on a campaign via `/api/campaigns/[id]/companies/**`. Shared Apollo helpers (payload cleaning, debug/redaction, slugify, etc.) were pulled out of `apollo-import-handler.ts` into `src/lib/apollo-shared.ts` so both integrations reuse them; `TagInput` was pulled out of `apollo-import-dialog.tsx` into `src/components/apollo-import/tag-input.tsx` for the same reason. Note: Apollo's `organizations` array on this endpoint does not return plain-text `industry`/`country`/`state`/employee count the way the people-search endpoint's nested org object does — those fields come back `null` for most results; this is Apollo's actual response shape, not a bug.
- **Phase 3 (done)**: `apollo-import-handler.ts` split into `searchApolloPeople` (DB-free search+dedupe) and `persistImportRows` (DB writes), with `runApolloImport` now a thin wrapper — `/api/import/apollo` and `/api/import/apollo/linkedin` behavior is unchanged (regression-tested live). `ApolloFilterPayload` gained `organizationIds`/`organizationDomains` for company-scoped search, preserved through all 3 fallback tiers. People search/import via `/api/campaigns/[id]/people/**`: search is DB-free and flags `alreadyContact`/`alreadyInCampaign`; import creates real `Contact` rows (or links pre-existing ones — never duplicates), links them via `CampaignContact`, fills empty `Contact.author` from `Campaign.assignedTo` (never overwrites an existing author), and runs the same bulk-enrichment as the regular import flow. The `/import-campaign/[id]` UI has a "Pick people" action opening a picker dialog (title/seniority/keyword search scoped to the campaign's companies), and a contacts list with per-contact detach.
- **Filter UX hardening (done)**: Locations (company search) and Seniorities (people search) are now closed multi-select dropdowns (`src/components/ui/multi-select.tsx`, built on `@base-ui/react/combobox`) backed by real fixed lookups (`src/lib/countries.ts`, `src/lib/apollo-seniorities.ts`) instead of free text — these two fields have genuine fixed value sets in Apollo's API, so typos/variants can no longer silently return zero results. Titles/Keywords remain free-text `TagInput` (inherently open-ended in Apollo's model). The original one-shot `ApolloImportDialog` (`/contacts`, `/linkedin`) was deliberately left untouched.
- **Industries field removed (done)**: the company search panel originally had a separate "Industries" field sending `organization_industry_tag_ids` — this was never a real, documented Apollo parameter (confirmed both by a live 422 `SEARCH_PARAMS_INVALID` response and by Apollo's own API docs, which have no industry-tag-ID parameter at all). The real, working, documented mechanism for industry-type filtering is `q_organization_keyword_tags` — i.e. the existing **Keywords** field (Apollo's own docs give `mining`/`consulting` as example keyword values). The Industries field and its `organization_industry_tag_ids` mapping were deleted rather than papered over with a fake lookup.
- **People picker modal (done)**: the "Pick people" UI was converted from a `Sheet` (side drawer) to a centered `Dialog` per user preference — file renamed `people-picker-sheet.tsx` -> `people-picker-dialog.tsx`, component `PeoplePickerSheet` -> `PeoplePickerDialog`.
- **Campaign Contacts table (done)**: the campaign detail page's Contacts section (`src/app/import-campaign/[id]/contact-list.tsx`) is now a full table matching the `/linkedin` table's look — Sl No, Name, LinkedIn, Company, Company LinkedIn, Title, inline-editable Author, inline-editable Status (full `ContactStatus` enum, not LinkedIn's simplified set — these are regular Contacts), edit (opens `EditContactDialog`) and remove (detach-from-campaign only, unchanged semantics) actions. `CopyLinkButton`, the author `<select>`, and `InlineUpdateMessage` were extracted out of `linkedin-contacts-table.tsx` into shared components (`src/components/copy-link-button.tsx`, `src/components/contact-author-select.tsx`, `src/components/inline-update-message.tsx`) so both tables reuse them; `linkedin-contacts-table.tsx` itself is unchanged in behavior. New `src/lib/contact-status.ts` and `src/components/contact-status-select.tsx` provide the full-enum inline status editor (re-exports `CONTACT_STATUS_VALUES` from `contacts-url.ts` rather than redefining it).
- **Single campaign-wide "Pick people" (done)**: replaced the per-company "Pick people" button (`CompanyList`) with one button on the Contacts card that searches **every** attached company in one Apollo call — `POST /api/campaigns/[id]/people/search` already accepted a `companyIds: string[]` array and passed all of them as Apollo's `organization_ids`, so this was mostly a frontend change (`PeoplePickerDialog` now takes `companies: PickerCompany[]` instead of a single `company`), plus a new **Company** column in the results table since results can now span multiple orgs. Fixed a real bug this exposed: `POST /api/campaigns/[id]/people` previously stamped every imported row's `CampaignContact.companyId` with one request-wide value, which would have mislabeled people once a batch could span companies — now each row's company is derived from its own `ImportRow.companyName` via the same `company-<slug>` id convention used elsewhere. Verified live: a single search returned people from both of a campaign's attached companies, and importing a mixed batch attributed each contact to its own correct company.
- **Company table + auto-enrichment (done)**: `CompanyList` is now a bordered table (Sl No, Company, Industry, Employees, Country, remove) instead of a plain list. The blank Industry/Employees/Country columns previously seen are Apollo's real behavior for company-search results (`organizations` array lacks that data — see Phase 2 note above), fixed by adding **automatic company enrichment on attach**: `src/lib/apollo-company-enrich.ts` calls the real, live-verified `GET https://api.apollo.io/api/v1/organizations/enrich` (1 Apollo credit per company; no bulk variant exists, so targets are enriched sequentially) and backfills `Company.industry/description/employeeCount/country/state` — no schema change needed, those columns already existed. Wired into `POST /api/campaigns/[id]/companies`: runs automatically right after a company is attached, but **only** for companies that don't already have `industry` set (never re-spends a credit on an already-enriched company, verified live via re-attach). Scoped to Import Campaign companies only — the older one-shot `/contacts`/`/linkedin` Apollo import path is untouched. Also added a "Number of companies to load" control (`perPage`, 1-100) to `CompanySearchPanel` — the backend already accepted this param, it just wasn't exposed in the UI.
- **Company search pagination (done)**: `searchApolloCompanies` now parses Apollo's `pagination` object from the raw response (`total_pages`/`total_entries`, previously discarded) and returns `page`/`totalPages`/`totalEntries` alongside `companies` — flows through `/api/campaigns/[id]/companies/search`'s existing response spread with no route change needed. `CompanySearchPanel` gained Previous/Next controls that re-run the search at a new `page` with the same filters (Apollo's org search appears free of per-page credit cost, unlike enrichment). Selections now persist across pages via a `selectedData: Map<apolloOrgId, ApolloCompanyResult>` accumulator (not just the visible page's array), so picking companies on page 1, paging to page 2, and picking more, then clicking "Add to campaign" adds all of them correctly — verified live that page 1 and page 2 of the same "fintech" search return entirely different companies (Apollo reports 4,263 total pages for that query). Separately, `CompanyList` (the *already-attached* companies table, distinct from the live search-results table above) got its own **client-side display pagination** (`PAGE_SIZE = 10`, Previous/Next) — this list is all-loaded-already DB data, so no additional Apollo calls, just slicing the existing array — verified live on a real 25-company campaign ("Page 1 of 3", Previous correctly disabled on page 1).

---

## 5) Frontend Pages (Navigation)

Defined in `src/components/nav-config.tsx`:

- `/` - Dashboard
- `/contacts` - Contacts list with status tabs, pagination (10/20/50, default 10), search, locked-email visibility toggle, retry enrichment action, select/edit/delete, generate drafts, import from Apollo ICP modal
- `/contacts/[id]` - Contact detail with timeline/actions
- `/pipeline` - Kanban-like deal board with drag/drop stage movement
- `/drafts` - Draft queue and review actions
- `/send-queue` - Approved drafts + send actions + recent sends
- `/analytics` - KPI, trend, domain, funnel, and failure-reason analytics
- `/import` - CSV upload/mapping/import wizard
- `/import-campaign` - Campaign list (create/assign/delete); nested Campaign -> Companies -> People Apollo workflow (Phase 1: CRUD + assignee only; company/people search lands in later phases)
- `/import-campaign/[id]` - Campaign detail/builder
- `/linkedin` - LinkedIn-sourced contacts (author, NEW/OUTREACHED, Apollo import requiring LinkedIn URL)
- `/linkedin/[id]` - LinkedIn contact detail
- `/settings` - API key checks, prompt template editor, sender identity, persistable send pacing

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
- `POST /api/import/apollo/linkedin` - same Apollo ingest with `source=linkedin-apollo` and required LinkedIn URL

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

- `GET /api/settings` - fetch latest prompt template plus send pacing
- `PATCH /api/settings` - create/update prompt template and/or `AppSettings` pacing (`delayBetweenEmailsSeconds`, `maxEmailsPerDay`)

### Analytics

- `GET /api/analytics?range=7d|30d|90d|custom&from=YYYY-MM-DD&to=YYYY-MM-DD`

### Webhooks

- `POST /api/webhooks/resend` - ingest Resend delivery/engagement events

### Campaigns

- `GET /api/campaigns` - list campaigns (`?status=&assignedTo=`) with company/contact counts
- `POST /api/campaigns` - create campaign (`name`, optional `description`, `assignedTo`)
- `GET /api/campaigns/[id]` - campaign detail incl. attached companies and imported contacts
- `PATCH /api/campaigns/[id]` - update `name`/`description`/`status`/`assignedTo`
- `DELETE /api/campaigns/[id]` - delete campaign (cascades join rows only, never the underlying Company/Contact)
- `POST /api/campaigns/[id]/companies/search` - live Apollo company search scoped to this campaign; flags each result `alreadyInCampaign`
- `POST /api/campaigns/[id]/companies` - attach selected Apollo company results (upserts `Company` by `company-<slug>` id, sets `apolloOrganizationId`, then links via `CampaignCompany`); auto-enriches any newly attached company missing `industry` via `apollo-company-enrich.ts` and returns `enrichment: {attempted, updated, errors}`
- `DELETE /api/campaigns/[id]/companies/[companyId]` - detach a company from the campaign (deletes the join row only, never the `Company`)
- `POST /api/campaigns/[id]/people/search` - Apollo people search scoped to the campaign's attached companies (`companyIds` resolved to their `apolloOrganizationId`s); flags each result `alreadyContact`/`alreadyInCampaign`; no writes
- `POST /api/campaigns/[id]/people` - import selected people: creates/links `Contact` rows (via `persistImportRows`), links via `CampaignContact`, fills empty `author` from the campaign's assignee, runs bulk enrichment
- `DELETE /api/campaigns/[id]/people/[contactId]` - detach a contact from the campaign (deletes the join row only, never the `Contact`)

---

## 7) Database Schema Summary (Prisma)

Core models in `prisma/schema.prisma`:

- `Company` - organization data
- `Contact` - lead/prospect entity, unique email, optional unique `apolloPersonId`, optional `author`, `tags[]`, `source`
- `PipelineStage` - configurable deal stages
- `Deal` - pipeline item tied to contact and stage
- `Activity` - notes/tasks/email logs per contact
- `EmailTemplate` - prompt template source for AI generation
- `AppSettings` - singleton (`id: default`) for send delay + daily cap
- `EmailDraft` - generated and reviewable draft
- `EmailSend` - sent-mail record mapped to Resend message ID
- `EmailEvent` - webhook event history
- `Campaign` - a named "Import Campaign" (company/region ICP target), optionally assigned to a team member
- `CampaignCompany` - join table: companies attached to a campaign (many-to-many, `@@unique([campaignId, companyId])`)
- `CampaignContact` - join table: contacts imported via a campaign (many-to-many, `@@unique([campaignId, contactId])`)

Important enums:

- `ContactStatus`: `NEW`, `QUALIFIED`, `CONTACTED`, `OUTREACHED`, `REPLIED`, `BOUNCED`, `UNSUBSCRIBED`
- `DealStatus`: `OPEN`, `WON`, `LOST`
- `DraftStatus`: `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `SENT`
- `EmailEventType`: `DELIVERED`, `OPENED`, `CLICKED`, `BOUNCED`, `COMPLAINED`
- `ActivityType`: `TASK`, `NOTE`, `EMAIL`
- `CampaignStatus`: `DRAFT`, `ACTIVE`, `ARCHIVED`

Notable constraints/relations:

- `Contact.email` unique
- `Contact.apolloPersonId` unique (nullable)
- `Company.apolloOrganizationId` unique (nullable) - set when a company is attached to a campaign via Apollo org search
- `EmailSend.resendMessageId` unique (nullable)
- one draft can map to one send (`EmailSend.draftId` unique)
- cascading deletes on many contact-linked records
- a `Company` or `Contact` can belong to multiple campaigns (many-to-many via the join tables); deleting a `Campaign` cascades only its join rows, never the underlying `Company`/`Contact`

---

## 8) Integrations

### Groq (AI)

- File: `src/lib/ai.ts`
- Model: `llama-3.3-70b-versatile`
- Prompt placeholders:
  - `{{firstName}}`, `{{lastName}}`
  - `{{position}}`
  - `{{companyName}}`, `{{companyIndustry}}`, `{{companySize}}`, `{{companyDescription}}`
  - `{{recentNote}}` (latest NOTE activity, if any)

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
- sender identity display (disabled inputs; from address is still hardcoded in Resend helper)
- editable AI prompt template (persisted via `/api/settings`)
- send pacing form persists `delayBetweenEmailsSeconds` and `maxEmailsPerDay` on `AppSettings` (with legacy template-field fallback if the client has no `appSettings` delegate)

---

## 11) Scripts and Local Commands

First-time local setup:

1. `npm install`
2. Copy `.env.example` to `.env` and fill real keys (never commit `.env`)
3. `npm run db:setup` against a reachable PostgreSQL `DATABASE_URL`
4. `npm run dev`

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
- `GROQ_API_KEY`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`
- `APOLLO_API_KEY`
- `NEXT_PUBLIC_APP_URL`

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
- `AppSettings` singleton (`id: default`) with `delayBetweenEmailsSeconds: 2` and `maxEmailsPerDay: 100`

---

## 14) UI/Design System Notes

- shadcn component registry is configured in `components.json`
- Tailwind v4 and design tokens are in `src/app/globals.css`
- Layout is responsive with:
  - desktop fixed sidebar
  - mobile top bar + drawer sheet

Contacts page behavior:

- server-rendered status tabs derived from current query scope (`All` + non-empty statuses only)
- URL-driven filters (`q`, `status`, `showLocked`, `page`, `pageSize`) for shareable state
- offset pagination with page sizes 10 / 20 / 50 (default 10) and a compact pager
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
- Generate pacing is still hardcoded (~2.1s per contact). Send pacing is stored in `AppSettings` but some routes still use a `prisma as unknown` delegate fallback.
- Sender name/email on Settings are display-only; Resend from-address is hardcoded.
- CSV parser is simple custom parsing and may not handle all edge-case CSV quoting patterns.
- Contact batch delete in UI performs per-contact API calls sequentially.
- Schema is synced with `db:push` (no checked-in Prisma migration history).
- Apollo enrichment may leave some rows in unlock-placeholder state when Apollo does not return an email (`skippedNoEmail`); these are now manageable via retry + show/hide controls.
- Import Campaign's Apollo company search (`mixed_companies/search`) returns `null` for `industry`/`country`/`state`/employee count on most results — Apollo's `organizations` array (public prospecting results) carries less metadata than `accounts` (companies already saved in the connected Apollo account); this is a live API behavior, not a bug.
- The nested campaign flow (search companies -> pick people per company) can multiply Apollo API calls versus the original one-shot import dialog; there's no call-budget/rate-limit UI feedback yet beyond the existing 429-retry-once behavior in `apollo-enrich.ts`.

---

## 17) Version Snapshot

- App label in UI footer: `Outreach CRM v1.0`
- Package name: `outreach-dashboard`
- Version: `0.1.0`

