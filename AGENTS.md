# Repository Guidelines

## Project Structure & Module Organization
- `src/app/` holds Next.js App Router routes. API handlers live under `src/app/api/`, while UI pages such as `/` and `/v/[jobId]` sit beside them.
- Shared UI lives in `src/components/`; reusable server/client helpers (env, jobs, media, network, replicate) are under `src/lib/`.
- Static assets (icons, social images) belong in `public/`. Add new fonts or global styles in `src/app/globals.css`.
- Configuration files (Next.js, Tailwind, TypeScript, ESLint) remain in the repo root.

## Build, Test, and Development Commands
- `npm install` — install dependencies once per environment.
- `npm run dev` — start the local Next.js dev server with Turbopack at http://localhost:3000.
- `npm run lint` — run ESLint across the project; ensure this passes before committing.
- `npm run build` / `npm start` — compile and run the production build (CI parity).

## Coding Style & Naming Conventions
- TypeScript everywhere; prefer named functions and explicit return types in shared libs.
- React components use PascalCase (`TalkAsAbhiHero`), files use kebab-case (`upload-audio`), and route handlers live in `route.ts` files.
- We rely on ESLint (Next.js config) and Tailwind CSS utilities; keep indentation at two spaces and favor concise inline comments only when necessary.

## Testing Guidelines
- No automated tests yet; validate flows manually: upload audio → `/api/start` → check `/api/status/{jobId}` → watch `/v/{jobId}`.
- When adding tests, colocate them near the feature or use a `__tests__` directory; name files `*.test.ts(x)` and integrate with `npm test`.

## Commit & Pull Request Guidelines
- Follow the existing history: short, imperative subject lines (e.g., “Relax KV rate limit handling”).
- Each PR should explain scope, deployment considerations (e.g., new env vars), and include screenshots or logs for UX/API changes.
- Reference related issues or tickets, note required secrets, and mention any manual QA steps performed.

## Security & Configuration Tips
- Keep secrets (`REPLICATE_API_TOKEN`, `BLOB_READ_WRITE_TOKEN`, `KV_REST_API_URL`, etc.) in `.env.local` locally and Vercel environment variables in production; never commit them.
- After altering FFmpeg usage or Blob storage rules, document the change in README and verify the cleanup cron (`/api/cleanup`) still works with its `Authorization: Bearer <CRON_SECRET>` header.
