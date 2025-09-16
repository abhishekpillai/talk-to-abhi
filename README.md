# Talk as Abhi

A playful lipsync MVP where you can upload or record up to 15 seconds of audio and watch Abhi lip-sync it using Replicate's `lipsync-2-pro`. We store everything in Vercel Blob, manage state in Vercel KV, and watermark the render before sharing a short-lived playback link.

## Features

- Landing flow with clear consent copy, daily per-IP rate limiting, and inline mic recorder.
- Audio normalization to mono 16 kHz WAV via `ffmpeg-static` before uploading to Blob.
- Replicate async predictions with webhook handling, watermark burn-in, and Blob persistence.
- Status polling API and dedicated playback page with overlay watermark + share helpers.
- Scheduled cleanup endpoint for Vercel Cron to sweep expired renders.

## Getting started

```bash
npm install
npm run dev
```

The dev server runs on [http://localhost:3000](http://localhost:3000).

### Required environment variables

Create a `.env.local` with the following values (matching your Vercel project secrets):

```
REPLICATE_API_TOKEN=...
REPLICATE_WEBHOOK_SECRET=...
REPLICATE_MODEL=replicate/lipsync-2-pro        # optional, defaults to this value
BLOB_READ_WRITE_TOKEN=...
ABHI_TEMPLATE_BLOB_URL=blob://templates/abhi-v1.mp4
SITE_URL=http://localhost:3000                 # optional override, Vercel auto-populates
CRON_SECRET=super-secure-token                 # optional, protects /api/cleanup
```

> Tip: Upload `abhi-v1.mp4` to the `templates/` folder in your Blob store and grab the resulting `blob://` URL for `ABHI_TEMPLATE_BLOB_URL`.

### Running the pipeline locally

1. Upload the template video to Blob and seed `ABHI_TEMPLATE_BLOB_URL`.
2. Start the dev server: `npm run dev`.
3. Visit `/` to acknowledge the consent checkbox, then either upload audio or record inline.
4. The UI uploads to `/api/upload-audio`, kicks off `/api/start`, and polls `/api/status/:jobId` until the webhook completes.
5. When finished, you get a shareable `/v/:jobId` link with an overlay watermark. Clips auto-expire after 72 hours via `/api/cleanup`.

### Async/webhook setup

- Set the webhook URL in Replicate predictions to `https://<your-domain>/api/replicate-webhook?jobId={jobId}` (already handled in `/api/start`).
- In production, configure Vercel to allow the `/api/replicate-webhook` route to run on the Node.js runtime.
- Replicate will send webhook events with `X-Replicate-Signature`; configure `REPLICATE_WEBHOOK_SECRET` to verify integrity.

### Rate limiting & moderation stubs

- `/api/upload-audio` tracks jobs per IP in Vercel KV (10/day). Adjust the limits in `src/lib/jobs.ts`.
- The landing copy enforces self-moderation. Hook up an ASR or keyword filter before `/api/start` if you need stronger guardrails.

### Cron cleanup

Set up a Vercel Cron job (e.g., daily) to `GET https://<your-domain>/api/cleanup` with header `Authorization: Bearer $CRON_SECRET`. This sweeps Blob renders older than 72 hours so storage stays tidy.

## Testing notes

- The project relies on FFmpeg via `ffmpeg-static`. For local development, make sure native binaries are supported on your platform.
- Webhook flows require either tunnelling (e.g., `ngrok`) or running on Vercel to receive callbacks from Replicate.
- No unit tests are shipped yet; manual QA covers upload → start → status polling → playback.

## Roadmap ideas

- Tighten moderation by piping uploads through an ASR profanity check before calling Replicate.
- Persist a curated gallery in Vercel Postgres with moderation controls.
- Add analytics on completion rate and latency per job to prove the T-metric.
