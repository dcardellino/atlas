# Atlas

A calm, editorial **personal life OS**. Speak or type a single sentence — Atlas
persists the raw text, classifies it with AI, and files it as a task, routine,
journal entry, or note in the right life area. One system for everything, and
nothing dies in the inbox.

- **Magic moment:** a spoken sentence → correctly sorted in under 5 s.
- **Single-user**, mobile-first PWA. The data model and RLS are multi-user ready.
- **No data loss:** raw capture text is always stored before classification, so an
  AI outage never swallows an entry.

## Stack

- **Next.js 16** (App Router, React 19, TypeScript) — deployed on Vercel
- **Supabase** — Postgres, Auth (email/password), Storage, Row-Level Security
- **Anthropic** (Claude) — capture classification
- **Tailwind CSS 3** — design tokens from `docs/design.md` (the single styling source)
- **Vitest** — unit + integration tests
- **Telegram** — push notifications (reminders, daily summary)
- **Google Calendar** — read-only day view

## Prerequisites

- Node.js 24.x (see `engines` in `package.json`)
- A Supabase project ([supabase.com](https://supabase.com))
- The Supabase CLI ([install](https://supabase.com/docs/guides/cli)) for migrations
- An Anthropic API key
- (Optional) a Telegram bot and a Google Calendar OAuth client

## Setup

```bash
git clone git@github.com:dcardellino/atlas.git
cd atlas
npm install
cp .env.local.example .env.local   # then fill in the values below
```

### Environment variables

Copy `.env.local.example` to `.env.local` and fill it in. Values map 1:1 to
PRD § Technical Architecture > Required Environment Variables.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — **server only**, never exposed to the client |
| `ANTHROPIC_API_KEY` | Anthropic API key for classification |
| `ANTHROPIC_MODEL` | Classification model (default `claude-haiku-4-5`) |
| `CAPTURE_TZ` | User timezone for resolving relative due dates (e.g. `Europe/Berlin`) |
| `CAPTURE_PEPPER` | Secret used to hash iOS-Shortcut API tokens |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (from @BotFather) |
| `TELEGRAM_CHAT_ID` | Your Telegram chat id |
| `GOOGLE_CALENDAR_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | Read-only Google Calendar OAuth |
| `CRON_SECRET` | Shared bearer secret for `/api/cron/*` |

### Database migrations

Migrations live in `supabase/migrations/` and are applied **manually** — there is
no migration CI. Apply them with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

> **Note:** the Preview and Production deployments share one Supabase database, so
> `supabase db push` affects both. Review each migration before pushing. Migrations
> `0007_corrections.sql` (reclassification log) and `0008_api_token_lifecycle.sql`
> (token revoke/expiry) are new in Phase 4 and must be pushed before those features
> work in a deployed environment.

Auth is single-user: disable self-signup in the Supabase dashboard (or restrict it
to your own email) and create your user there.

### Run

```bash
npm run dev        # http://localhost:3000
npm run test       # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # production build
```

Sign in, and the four default life areas (Familie, Fitness, Haus, Side-Projects)
are seeded on first login.

## iOS Shortcut (voice capture on the go)

The fastest capture path is an iOS Shortcut that dictates a sentence and POSTs it
to `/api/capture` with a bearer token. Create a token under **Settings →
Shortcut-Tokens** (the plaintext is shown exactly once), then follow
[`ios-shortcut/README.md`](ios-shortcut/README.md).

## Scheduled jobs (crons)

Vercel Hobby throttles cron jobs to ~daily, so a GitHub Actions workflow
(`.github/workflows/cron.yml`) drives them at real frequency, authenticated with
`CRON_SECRET`:

- `/api/cron/reminders` — every 15 min, sends due task reminders via Telegram
- `/api/cron/calendar-sync` — every 15 min, refreshes the read-only calendar cache
- `/api/cron/daily-summary` — ~06:00 Europe/Berlin, sends the day's overview

Set the `CRON_SECRET` and `CRON_BASE_URL` repository secrets for the workflow.

## Deployment

Deploy on [Vercel](https://vercel.com). Set every environment variable from the
table above in the Vercel project settings, then run `supabase db push` against
the shared database for any pending migrations.

## Self-hosting exit

Atlas deliberately keeps a self-hosting exit open: the stack is a standard
Next.js app plus a Supabase Postgres database. Because personal data (journal,
family) lives on the managed stack, the schema, RLS and Storage are portable to a
self-hosted Supabase / Postgres instance if you ever want to move off the managed
providers.

## Project docs

- `docs/product-roadmap.md` — phased build plan and task checklist
- `docs/prd.md` — requirements, data model, API, edge cases
- `docs/product-vision.md` — vision, voice & tone, success metrics
- `docs/design.md` — design tokens and rules (**the** styling source)
