# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` — start local Next.js dev server with Turbopack at http://localhost:3000
- `npm run build` — compile production build (always run before committing significant changes)
- `npm run lint` — run ESLint (must pass before committing)
- `npm start` — run production build locally

## Project Architecture

This is a Next.js 15 app using the App Router that creates lip-sync videos with Replicate's lipsync-2-pro model. The application follows an async pipeline:

1. **Audio Upload** (`/api/upload-audio`) - Normalizes audio to mono 16kHz WAV via ffmpeg-static, uploads to Vercel Blob, creates job in Vercel KV
2. **Processing Start** (`/api/start`) - Initiates Replicate prediction with webhook callback
3. **Webhook Handling** (`/api/replicate-webhook`) - Receives completion, watermarks video, stores final render
4. **Playback** (`/v/[jobId]`) - Shows video with overlay watermark and share options
5. **Cleanup** (`/api/cleanup`) - Cron endpoint to remove expired content (72hr TTL)

### Key Architecture Components

- **Job Management** (`src/lib/jobs.ts`) - Core job lifecycle with Vercel KV storage, rate limiting (10 jobs/day/IP), 72hr TTL
- **Media Processing** (`src/lib/media.ts`) - FFmpeg audio normalization and video watermarking
- **Replicate Integration** (`src/lib/replicate.ts`) - Async prediction handling with webhook verification
- **Environment Config** (`src/lib/env.ts`) - Zod-validated environment variables

### Directory Structure

- `src/app/` - Next.js App Router (API routes under `/api/`, pages like `/` and `/v/[jobId]`)
- `src/lib/` - Shared utilities (jobs, media, replicate, env validation, networking)
- `src/components/` - Reusable React components
- `public/` - Static assets

## Required Environment Variables

The application requires these environment variables (see README.md for full details):

```
REPLICATE_API_TOKEN=...
REPLICATE_WEBHOOK_SECRET=...
BLOB_READ_WRITE_TOKEN=...
ABHI_TEMPLATE_BLOB_URL=blob://templates/abhi-v1.mp4
KV_REST_API_URL=...         # Auto-configured on Vercel
KV_REST_API_TOKEN=...       # Auto-configured on Vercel
SITE_URL=...                # Optional, auto-detected on Vercel
CRON_SECRET=...             # Optional, protects /api/cleanup
```

## Code Conventions

- TypeScript everywhere with strict mode enabled
- React components use PascalCase, files use kebab-case
- API routes in `route.ts` files following Next.js App Router conventions
- Two-space indentation, ESLint (Next.js config) + Tailwind CSS
- Path aliases: `@/*` maps to `src/*`

## Testing & Validation

No automated tests currently. Manual testing flow:
1. Upload/record audio on homepage
2. Check processing via `/api/status/[jobId]` polling
3. Verify playback at `/v/[jobId]` with watermarks
4. Confirm cleanup cron functionality

## Development Notes

- FFmpeg processing requires `ffmpeg-static` package (platform-specific binaries)
- Webhook testing needs tunneling (ngrok) or Vercel deployment for Replicate callbacks
- Rate limiting and job state managed entirely in Vercel KV
- All blob storage operations use Vercel Blob with 72hr auto-expiry
- Audio normalization happens client-side before upload to ensure consistent input format

## Security Considerations

- Never commit secrets - use `.env.local` locally and Vercel environment variables in production
- Webhook endpoints verify signatures using `REPLICATE_WEBHOOK_SECRET`
- Rate limiting prevents abuse (10 jobs/day per IP via Vercel KV)
- All renders include watermarks indicating AI-generated, consensual parody content