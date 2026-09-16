# Outreach Dashboard

Experidium outreach CRM: import leads, generate Groq drafts, review, send via Resend, and track outcomes.

## Local setup

```bash
npm install
copy .env.example .env   # then fill in real keys
npm run db:setup         # prisma generate + db push + seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Required env vars are listed in `.env.example`: `DATABASE_URL`, `GROQ_API_KEY`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `APOLLO_API_KEY`.

Useful scripts: `npm run lint`, `npm run db:studio`. Do not run `npm run db:clear` unless you intend to wipe all rows.

See `project.md` for architecture, APIs, and schema.
