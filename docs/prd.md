# **Talk as Abhi**

## **1\. Overview**

“Talk as Abhi” is a playful, viral MVP that lets friends, family, or colleagues upload or record their own audio and see Abhi’s face lip-synced to it.

It showcases the new lipsync-2-pro model from Replicate, emphasizes **consensual parody**, and provides a lightweight tech demo that could seed both social engagement and deeper commercial exploration.

---

## **2\. Goals**

* **Fun & Virality:** create a shareable, lighthearted experience that drives organic word-of-mouth.

* **Technical Spike:** validate Replicate’s lipsync-2-pro performance (latency, quality, API ergonomics).

* **Consent & Guardrails:** demonstrate safe boundaries for using personal likeness (clear consent flow, watermarks).

* **Team Learning:** gain hands-on experience with async jobs, webhooks, and media pipeline for future localization/dubbing apps.

---

## **3\. Core User Experience**

**Primary Flow (Web MVP)**

1. **Abhi records a 10–15s talking-head template video** (neutral background, frontal face, clean lighting).

2. **Visitor uploads or records an audio clip** (≤15s, WAV/MP3).

3. Backend:

   * Normalize audio (mono WAV).

   * Call Replicate API lipsync-2-pro with Abhi’s template video \+ visitor’s audio.

   * Handle async job via webhook → return video URL.

4. **User receives a short clip**: Abhi lip-syncs their audio.

5. Video is **watermarked**: “AI-generated · Consensual Parody · TalkAsAbhi.com”.

---

## **4\. Feature Requirements**

### **Must-Have**

* **Video upload (fixed Abhi template)** stored securely (vercel blob?).

* **Audio upload/record** (≤15s, 5 MB cap).

* **Replicate integration:**

  * Use async predictions (POST /v1/predictions) with webhook.

  * Inputs: { video, audio, sync\_mode, temperature, active\_speaker }.

* **Job status UI** (queued → processing → complete).

* **Playback page** with shareable link \+ watermark.

* **Consent disclaimers:**

  * Landing page clearly says: “Abhi consented to his likeness being used here. Do not use without consent.”

  * Checkbox: “I understand this is parody and agree to terms.”

### **Nice-to-Have**

* **Inline recording** (mic capture).

* **Social share buttons** (copy link, Twitter, WhatsApp).

* **Auto-expiry**: delete generated videos after 24–48h to manage costs.

* **Mini-gallery**: curated best clips (optional, manual approval).

## **2\) Tech Stack (Vercel-first)**

* **App framework:** Next.js 14 (App Router)

* **Runtime:** Vercel (Edge \+ Node as needed)

* **File storage:** **Vercel Blob** (temp storage for uploads & outputs)

* **Job state:**

  * **Recommended:** **Vercel KV** (fast, simple TTL for ephemeral jobs)

  * **Optional:** **Vercel Postgres** (if you want durable audit/gallery later)

* **Secrets/config:** Vercel environment variables \+ **Edge Config** (feature flags)

* **Background/ops:** **Vercel Cron** for cleanup and cost control

* **Model runtime:** Replicate async predictions \+ webhook

TL;DR: You **do not** need Supabase to ship this MVP. Blob \+ KV on Vercel is enough. Add Postgres if/when you want durable history, analytics, or a public gallery.

---

## **3\) Data & Storage Plan**

### **Files (Vercel Blob)**

* **blob://templates/abhi-v1.mp4** – the fixed face template (10–15s)

* **blob://audios/{jobId}.wav** – normalized visitor audio (mono WAV, 16–48 kHz)

* **blob://renders/{jobId}.mp4** – final video pulled from Replicate output URL

* **Lifecycle:** default 48–72h retention for renders; daily cron removes expired files

**Why Blob?** Native, zero-config, signed client uploads (via upload tokens), easy server writes, CDN-backed.

### **Job tracking**

**Option A (Recommended for MVP): Vercel KV**

* Store **ephemeral** job state with a TTL (e.g., 72h)

* Keys:

  * job:{id} → JSON payload (status, urls, timestamps) with ex TTL

  * user-rate-limit:{ip} → integers for basic throttling

* Pros: ultra-simple, cheap, supports atomic updates; perfect for MVP

* Cons: not ideal for long-term analytics or relational queries

**Option B (Add later): Vercel Postgres**

* Tables for durable audit, moderation queue, and opt-in gallery

* Pros: long-term history, joins, reporting

* Cons: more schema/ops overhead now

**Recommendation:** **Start with KV**. Add **Postgres** only when you need history/gallery/analytics.

---

## **4\) Minimal Data Models**

### **KV:** 

### **job:{id}**

{

  "id": "ks8p9f",

  "status": "queued | processing | completed | failed",

  "createdAt": "2025-09-15T13:01:02Z",

  "updatedAt": "2025-09-15T13:03:31Z",

  "input": {

    "templateBlobUrl": "blob://templates/abhi-v1.mp4",

    "audioBlobUrl": "blob://audios/ks8p9f.wav",

    "params": { "sync\_mode": "loop", "temperature": 0.7, "active\_speaker": true }

  },

  "replicate": {

    "predictionId": "pr\_abc123",

    "webhookStatus": "delivered | pending"

  },

  "output": {

    "replicateVideoUrl": "https://replicate.delivery/.../out.mp4",

    "renderBlobUrl": "blob://renders/ks8p9f.mp4",

    "publicPlaybackUrl": "https://talkasabhi.com/v/ks8p9f"

  },

  "error": null

}

Set KV TTL (ex) to 72 hours on job:{id}.

---

## **5\) API & Routes (Next.js App Router)**

### **POST** 

### **/api/upload-audio**

###  **(Node runtime)**

* **Auth:** none (rate-limit by IP; optional captcha)

* **Body:** file (FormData) or base64; server normalizes to mono WAV

* **Writes:** Blob → blob://audios/{jobId}.wav

* **Response:** { jobId, audioBlobUrl }

### **POST** 

### **/api/start**

###  **(Node runtime)**

* **Body:** { jobId }

* **Server:**

  * Looks up audio blob

  * Calls Replicate **async** prediction with:

{

  "video": "\<blob download URL for abhi-v1.mp4\>",

  "audio": "\<blob download URL for audios/{jobId}.wav\>",

  "sync\_mode": "loop",

  "temperature": 0.7,

  "active\_speaker": true,

  "webhook": "https://talkasabhi.com/api/replicate-webhook?jobId={jobId}"

}

* 

  * Saves predictionId \+ sets status=processing in KV

* **Response:** { jobId, status: "processing" }

### **POST** 

### **/api/replicate-webhook**

###  **(Node runtime)**

* **Auth:** verify Replicate signature (if provided) or origin allowlist

* **Query:** jobId

* **Body:** full prediction payload

* **On completed:**

  * Extract output video URL

  * **Fetch → upload** to Blob → blob://renders/{jobId}.mp4

  * Update KV: status=completed, store renderBlobUrl

* **On failed:** update KV: status=failed, error

### **GET** 

### **/api/status/{jobId}**

* Returns KV payload (status, playback URL if ready)

### **GET** 

### **/v/{jobId}**

* Playback page: streamed MP4 with **“AI-generated · Consensual Parody”** overlay/watermark baked into the video (preferred) or CSS overlay (faster but removable—bake it if possible).

**Note:** If you prefer not to download the Replicate file to Blob, you can proxy-stream it—but writing to Blob avoids broken links and gives you lifecycle control.

---

## **6\) Frontend Flow**

1. **Landing** with consent copy \+ checkbox

    “Abhi consented to his likeness here. Upload only audio you have rights to. Be kind. No hate or illegal content.”

2. **Audio capture/upload** (15s cap) → POST /api/upload-audio

3. **Generate**: call /api/start → poll /api/status/{jobId} (or SSE/WebSocket if you want)

4. **Playback**: show video at /v/{jobId} with share/copy link

5. **Auto-expiry banner**: “Clips auto-delete in 48–72 hours”

---

## **7\) Moderation & Safety (lightweight for MVP)**

* **Before start:** basic **keyword filter** on speech-to-text (use a fast local or hosted ASR; or skip ASR and start with a profanity list on filename/metadata \+ user attestation)

* **Rate limit:** user-rate-limit:{ip} in KV (e.g., 10 jobs/day)

* **Always watermark** output; disable download if you want (but assume users can screen-record)

* **Takedown email** in footer

---

## **8\) Costs & Limits**

* **Replicate**: ≈ **$1.25 / 15s clip** (compute only; your actual price depends on their current tier)

* **Blob/KV**: minimal at MVP scale

* **Guardrails for cost:**

  * Hard **15s** audio limit

  * **Per-IP daily cap** (KV)

  * **Auto-expiry** via Vercel Cron cleanup

---

## **9\) Operational Jobs**

* **Cron: /api/cleanup** (daily)

  * List Blob renders older than 72h → delete

  * Scan KV for job:\* expired keys (KV TTL handles this automatically; cron is a safety net)

---

## **10\) Implementation Notes**

* Prefer **Node runtime** for routes that hit Replicate or do file I/O (Blob supports both Edge/Node; Node is simpler here).

* Normalize audio server-side (FFmpeg or a lightweight lib) to mono WAV; keep it short to avoid cold-start pain.

* Watermark by **re-muxing** with FFmpeg on your server route (fast overlay) *or* ask Replicate output and then do a quick overlay before saving to Blob.

* Use **signed Blob upload URLs** for client-side audio upload if you want to bypass server for large files (not necessary for 15s).

---

## **11\) What if we** 

## **do**

##  **want Supabase?**

You don’t need it for MVP, but Supabase is great if you want:

* Durable **Postgres** \+ Row Level Security

* Built-in **auth** (user accounts, galleries)

* **Storage** as an S3-like bucket (vs. Blob)

* Realtime updates

If you go that route later, migrate job state to Postgres and keep Blob (or move files to Supabase Storage). For now, **Blob \+ KV** stays the fastest path.

---

## **12\) Success Metrics (unchanged, clarified for KV)**

* **T-metric:** ≥70% jobs complete \< 3 minutes (15s input)

* **Throughput:** 50+ successful clips in first week

* **Quality:** ≥4/5 lip-sync rating (simple 1–5 emoji survey on playback page)

* **Safety:** 0 verified abuse incidents; ≤2% moderation blocks false-positive rate

---

## **13\) Cut-and-Paste Task List**

* Setup Next.js (App Router) on Vercel; add **Blob**, **KV**, **Cron** integrations

* Upload abhi-v1.mp4 to Blob (blob://templates/abhi-v1.mp4)

* Build /api/upload-audio (normalize to WAV, store in Blob)

* Build /api/start (create Replicate prediction, save KV job)

* Build /api/replicate-webhook (verify, pull output, watermark, save to Blob, update KV)

* Build /api/status/{jobId}

* Build /v/{jobId} playback page with share \+ feedback

* Add consent copy, rate limits, and basic moderation check

* Add Cron cleanup for Blob and rely on KV TTL

* Ship internal beta

---

## **6\. Risks & Guardrails**

* **Abuse potential:** ensure this only works with Abhi’s pre-recorded face (locked template).

* **Moderation:** disallow offensive audio (basic speech-to-text \+ banned words filter).

* **Legal/Policy:** strong disclaimers, watermark, no storage beyond 24–48h without user opt-in.

* **Performance:** monitor latency; Replicate queue \+ GPU availability may impact UX.

---

## **8\. Roadmap**

**Phase 1:**

* Implement upload, Replicate integration, watermarking, and playback.

* Ship internal demo to Array team \+ friends.

**Phase 2:**

* Add inline recording, share links, auto-expiry.

* Collect feedback on latency, UX, fun factor.

**Phase 3 (Future):**

* Extend to “Talk as \[Other Consenting Friend\]” → multi-face template library.

* Explore monetization: $0.99 per clip or “fun packs.”