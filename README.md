## Optima Seller AI

Mobile-first SaaS app to help African merchants sell better with AI-generated sales messages and chat tools (French-first).

**Stack**
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase Auth + Postgres (optional in demo)
- Server Actions for mock AI + persistence hooks

## Running locally

Install deps then run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Windows note (native bindings blocked)

If Windows blocks native `.node` / `.exe` files in `node_modules` (WDAC/AppLocker/Smart App Control), Next.js may fail to start/build because `@next/swc-*` (and sometimes `@esbuild/*`) cannot execute.

- Prefer whitelisting the project folder in your policy/antivirus, or disable the policy for development.
- `Unblock-File` may help if the files are only marked as downloaded from the internet (Mark-of-the-Web).

## Supabase setup (recommended)

1) Create a Supabase project
2) Run `supabase/schema.sql` in the SQL editor
3) Copy `.env.example` to `.env.local` and fill:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Without env vars, the UI remains fully clickable in demo mode, but auth and persistence are disabled.

## Deploy on Vercel

1) Push this repo to GitHub
2) Import in Vercel
3) Add Environment Variables (Project Settings → Environment Variables):

- `NEXT_PUBLIC_SITE_URL` (e.g. `https://your-app.vercel.app`) (recommended)
- `NEXT_PUBLIC_SUPABASE_URL` (optional for demo, required for auth/persistence)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional for demo, required for auth/persistence)
- `OPTIMA_AI_BACKEND_URL` (required for production AI; Railway base URL, no trailing slash)
- `OPTIMA_AI_BACKEND_SECRET` (required; min 16 chars)
- `OPENROUTER_API_KEY` (optional; only used when running AI locally or as an emergency fallback)
- `OPENROUTER_MODEL` (optional; only used for local mode)
- `OPENROUTER_SITE_URL` (optional)
- `OPENROUTER_APP_NAME` (optional)

Build command: `npm run build`

## AI backend (Railway)

The real AI brain runs on Railway and exposes:
- `GET /health`
- `POST /v1/chat/reply` (full orchestration)
- `POST /v1/llm/chat` and `POST /v1/llm/embed` (OpenRouter proxy)

Backend production start command: `node dist/index.cjs` (after build).

## Pages

- `/` Landing
- `/pricing` Pricing
- `/signup` and `/login` Auth
- `/reset-password` Password reset (via email link)
- `/auth/callback` Supabase email/magic link callback
- `/onboarding` 3-step onboarding
- `/app` Dashboard
- `/app/generator` AI generator (mock responses, ready for real API)
- `/app/crm` Mini CRM pipeline (drag/drop + notes)
