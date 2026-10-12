# Interview Platform

Front-end coding interview platform: JS/TS function questions, React component questions, in-browser test runner, official solutions, discuss threads, subscriptions, and one-time question packs.

## Stack
- Next.js 16 App Router + React 19 + TypeScript
- Tailwind CSS v4
- Supabase Auth + Postgres
- Prisma ORM
- Monaco editor + Sandpack (React preview)
- Billing via gateway abstraction (Stripe + LemonSqueezy)

## Quick Start
1. `npm install`
2. Copy `.env.example` to `.env` and fill required values
3. `npm run prisma:migrate`
4. `npm run prisma:seed`
5. `npm run dev`

## Auth
- Production: Supabase magic-link via `/auth`.
- Dev fallback user: `demo@interview.dev` (seeded) when Supabase env vars are absent.

## Billing
- Gateway interface: `lib/billing/gateway.ts`.
- Implementations: `lib/billing/stripe-gateway.ts`, `lib/billing/lemonsqueezy-gateway.ts`.
- Configure provider price IDs on plans/packs in the DB.

## Tests
- `npm test` — unit (vitest)
- `npm run test:dom` — DOM (jsdom)
- `npm run test:integration` — integration
- `npm run test:db` — reset test DB

## Adding Questions
New questions live in the private content repo and are imported with `scripts/import-questions.ts`. See [docs/adding-questions.md](docs/adding-questions.md).

## Data Scripts

Backup all app data as JSON:
```bash
npx tsx prisma/backup-data.ts
```
Outputs to `backups/<timestamp>/`. Run before risky migrations.

Full Postgres dump:
```bash
pg_dump "$DIRECT_URL" --format=custom --no-owner -f backup.dump
```

Rebuild denormalized render cache after editing question content directly:
```bash
npx tsx prisma/backfill-render-data.ts
```

Fresh rebuild:
```bash
npm run prisma:migrate
npm run prisma:seed
npx tsx prisma/backfill-render-data.ts
```
