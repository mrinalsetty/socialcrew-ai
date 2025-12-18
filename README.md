# SocialCrew AI — Frontend

A Next.js 15 app (React 19) that triggers the CrewAI backend to generate social content and renders the resulting JSON/Markdown outputs. It supports local spawning of the Python backend and production proxying to a remote backend via `BACKEND_URL`.

## Prerequisites

- Node.js 18+ (recommended)
- `pnpm`, `npm`, or `yarn`

## Install & Run (Local Dev)

```bash
cd frontend
# install deps
pnpm install
# run dev server (Turbopack)
pnpm dev
# open the UI
# http://localhost:3000
```

The main page lets you enter a topic and run the backend workflow. Logs stream via SSE, and two outputs are displayed side-by-side:

- Content Creator: pretty-printed `social_posts.json`
- Social Analyst: markdown from `analytics_summary.md`

## Environment Configuration

Local development:

- Put provider keys in `../backend/.env` (the streaming route reads and merges this file). Example keys:
  - `GROQ_API_KEY` and `GROQ_MODEL`
  - or `OPENAI_API_KEY` and `OPENAI_MODEL`
  - Optional: `TOPIC` to override default (“AI LLMs”)

Production (e.g., Vercel):

- Set `BACKEND_URL` to point at a hosted backend with two endpoints:
  - `GET /run` (SSE stream; accepts `?topic=...`)
  - `GET /file/:name` (serves generated files like `social_posts.json`, `analytics_summary.md`)

When `BACKEND_URL` is set, the frontend proxies to those endpoints instead of spawning Python locally.

## API Routes

- `POST /api/run-backend` → spawns the backend once and returns `{ ok, code, stdout, stderr }`.
- `GET /api/run-backend/stream?topic=...` → SSE stream; merges `../backend/.env` and runs the backend locally, or proxies to `BACKEND_URL`.
- `GET /api/posts` → reads `../backend/social_posts.json` and returns JSON (fallback example if missing).
- `GET /api/file/:name` → reads or proxies files (`.md`, `.json`, `.txt`) from the backend folder.
- `GET /api/md/:name` → returns a markdown file from `../backend`.

## Build & Start (Production)

```bash
cd frontend
pnpm build
pnpm start
```

## Troubleshooting

- For local runs, ensure the Python backend is runnable and that `../backend/.env` contains valid provider keys.
- Watch the logs panel (“Show logs”) for SSE output during runs.
- On Vercel, set `BACKEND_URL` to your backend service and verify `/run` and `/file/:name` are reachable.
