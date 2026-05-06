# Outreach Message Generation: Technical Reference

This document explains exactly how outreach messages (email drafts) are generated in this codebase, from UI trigger to saved draft rows.

---

## 1) Entry points (where generation starts)

Generation is triggered from two client components:

- `src/app/contacts/generate-button.tsx`
  - Bulk generation for selected contacts.
  - Sends `POST /api/generate` with `{ contactIds: string[] }`.
- `src/app/contacts/[id]/contact-actions.tsx`
  - Single-contact generation from contact detail page.
  - Sends `POST /api/generate` with `{ contactIds: [contactId] }`.

Both flows call the same backend route, so generation behavior is centralized.

---

## 2) Main backend route

Primary implementation lives in:

- `src/app/api/generate/route.ts`

### 2.1 Request contract

- Method: `POST`
- Body:

```json
{
  "contactIds": ["contact_id_1", "contact_id_2"]
}
```

Validation rules:

- `contactIds` must exist
- must be an array
- must contain at least one id

Otherwise response is `400` with:

```json
{ "error": "contactIds array is required" }
```

### 2.2 High-level execution steps

1. Load latest email template:
   - `prisma.emailTemplate.findFirst({ orderBy: { createdAt: "desc" } })`
2. Load target contacts with company relation:
   - `prisma.contact.findMany({ where: { id: { in: contactIds } }, include: { company: true } })`
3. For each contact (sequential loop):
   - Build prompt from template + contact/company data (`buildPrompt(...)`)
   - Call Groq model (`generateEmailCopy(...)`)
   - Persist draft to DB as `PENDING_REVIEW`
4. Sleep `2100ms` between contacts to reduce rate-limit pressure
5. Return summary payload (`generated`, `failed`, per-contact result/error entries)

### 2.3 Generation pacing

In `src/app/api/generate/route.ts`:

- `const DELAY_BETWEEN_CALLS_MS = 2100;`

This delay is applied between contacts in one request.

### 2.4 Persistence details

Each successful generation creates one `EmailDraft` row:

- `contactId`: target contact
- `subject`: parsed model output
- `body`: parsed model output
- `status`: `"PENDING_REVIEW"`
- `generatedBy`: `"groq-llama-3.3-70b"`

---

## 3) AI layer and prompt assembly

Core logic:

- `src/lib/ai.ts`

### 3.1 Model + call configuration

- SDK: `groq-sdk`
- Model: `llama-3.3-70b-versatile`
- API key env var: `GROQ_API_KEY`
- Temperature: `0.7`
- User message content = `prompt + output requirements`

Injected output requirements force:

- Plain text only
- No HTML
- No markdown
- No code fences
- No styling tags

### 3.2 Prompt template variable replacement

`buildPrompt(template, contact, company)` replaces:

- `{{firstName}}`
- `{{lastName}}`
- `{{position}}` (fallback: `"Decision Maker"`)
- `{{companyName}}` (fallback: `"their company"`)
- `{{companyIndustry}}` (fallback: `"technology"`)
- `{{companySize}}` (fallback: `"unknown"`)
- `{{companyDescription}}` (fallback: `"a growing business"`)

This is simple string replacement, not a DSL engine.

### 3.3 Output parsing

After model response:

- Regex for subject: `/Subject:\s*(.*)/i`
- Regex for body: `/Body:\s*([\s\S]*)/i`

If patterns are missing:

- subject fallback: `"Follow up"`
- body fallback: full model text

Both fields are normalized by `toPlainText(...)`, which strips:

- fenced code blocks
- HTML tags
- common HTML entities
- excessive blank lines and trailing spaces

### 3.4 Error mapping

`generateEmailCopy` recognizes rate-limit signatures (`429`, `rate_limit`) and throws a user-friendly error.

At route level (`/api/generate`):

- if one contact fails with a quota/rate-limit signal, remaining contacts are marked as skipped and loop stops early.
- non-quota errors are recorded for the affected contact and processing continues.

---

## 4) Template source of truth

Template storage uses `EmailTemplate.promptTemplate`.

Relevant files:

- `src/app/settings/settings-form.tsx` (UI editor)
- `src/app/api/settings/route.ts` (GET/PATCH persistence)
- `prisma/seed.ts` (default template seed)

### 4.1 Editing behavior

Settings UI sends:

- `PATCH /api/settings` with `{ promptTemplate: string }`

Route behavior:

- if a template exists, update that row
- otherwise create `"Default Cold Email"`

### 4.2 Seed fallback

`prisma/seed.ts` creates/upserts `EmailTemplate` with id `default-template` and a default cold-email prompt.

If DB is reset and seeded, this becomes the starting template.

---

## 5) Data dependencies that affect message quality

The generated message quality is directly tied to contact/company data completeness.

Primary data fields used:

- Contact:
  - `firstName`
  - `lastName`
  - `position`
- Company:
  - `name`
  - `industry`
  - `employeeCount`
  - `description`

Upstream data providers impacting these fields:

- CSV import route: `src/app/api/import/route.ts`
- Apollo import route: `src/app/api/import/apollo/route.ts`
- Manual edits via contacts UI / contacts API

If these fields are missing, fallback values are injected and personalization quality drops accordingly.

---

## 6) Database model touchpoints

From `prisma/schema.prisma`, generation touches:

- `EmailTemplate` (prompt source)
- `Contact` (+ related `Company`) as personalization input
- `EmailDraft` as output artifact

Important enum:

- `DraftStatus`: `PENDING_REVIEW | APPROVED | REJECTED | SENT`

Generated drafts always start as `PENDING_REVIEW`.

---

## 7) Response shape from `/api/generate`

Success response format:

```json
{
  "generated": 3,
  "failed": 1,
  "total": 4,
  "results": [
    { "contactId": "...", "draftId": "...", "subject": "..." }
  ],
  "errors": [
    { "contactId": "...", "name": "First Last", "error": "..." }
  ]
}
```

Error strings are truncated to 200 chars before returning.

---

## 8) Non-obvious implementation details

1. **Sequential generation, not parallel**
   - Contacts are processed one-by-one with explicit sleeps.
   - This lowers burst pressure but increases end-to-end latency.

2. **Template selection in generation route uses `createdAt`**
   - `/api/generate` picks template by latest `createdAt`.
   - `/api/settings` GET reads by latest `updatedAt`.
   - In normal use (single active template), behavior is effectively aligned, but this is worth knowing if multiple templates exist.

3. **Settings pacing values are not applied to generation delay**
   - `delayBetweenEmailsSeconds` exists in settings storage.
   - Generation still uses hardcoded `DELAY_BETWEEN_CALLS_MS = 2100`.

4. **No strict schema validation on AI output**
   - Parser expects `Subject:` and `Body:` but gracefully falls back.
   - Malformed output still yields a draft unless upstream call fails.

---

## 9) Environment and runtime requirements

Required for generation:

- `DATABASE_URL` (to read template/contacts and write drafts)
- `GROQ_API_KEY` (to call Groq)

Notes:

- `.env.example` currently lists `GOOGLE_GENERATIVE_AI_API_KEY`, but active generation implementation uses Groq (`GROQ_API_KEY` in code).

---

## 10) End-to-end sequence (concise)

1. User clicks Generate button in contacts UI.
2. Browser posts `contactIds` to `POST /api/generate`.
3. Route loads latest template + selected contacts/company.
4. For each contact:
   - `buildPrompt(...)`
   - `generateEmailCopy(...)` against Groq
   - save `EmailDraft(PENDING_REVIEW)`
5. Route returns summary payload.
6. UI redirects user to `/drafts` for review/approval.

---

## 11) Quick troubleshooting checklist

If generation fails:

1. Verify `GROQ_API_KEY` exists and is valid.
2. Ensure at least one `EmailTemplate` row exists (`npm run db:seed` if empty).
3. Confirm contacts exist for submitted `contactIds`.
4. Check server logs for quota/rate-limit errors.
5. If many failures are quota-related, retry with fewer contacts per batch.

