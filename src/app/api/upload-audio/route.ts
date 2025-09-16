import { put } from "@vercel/blob";
import { nanoid } from "nanoid";

import { jsonResponse } from "@/lib/http";
import {
  RateLimitExceededError,
  assertBlobConfigured,
  createJob,
  getPlaybackUrl,
  trackJobForIp,
  upsertJob,
} from "@/lib/jobs";
import { normalizeAudioToMonoWav } from "@/lib/media";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]!.trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function POST(req: Request) {
  try {
    assertBlobConfigured();
  } catch (error) {
    return jsonResponse(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }

  const ip = getClientIp(req);
  try {
    await trackJobForIp(ip);
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return jsonResponse(
        { success: false, error: "Daily limit reached. Try again tomorrow." },
        { status: 429 },
      );
    }

    console.error("KV rate limit error", error);
    return jsonResponse(
      { success: false, error: "We couldn't verify the rate limit. Try again shortly." },
      { status: 500 },
    );
  }

  const form = await req.formData();
  const audio = form.get("audio");
  const consent = form.get("consent")?.toString();
  const declaredDuration = Number(form.get("duration"));

  if (consent !== "true") {
    return jsonResponse(
      { success: false, error: "Consent acknowledgement is required." },
      { status: 400 },
    );
  }

  if (!(audio instanceof File)) {
    return jsonResponse(
      { success: false, error: "Audio file is required." },
      { status: 400 },
    );
  }

  if (audio.size === 0) {
    return jsonResponse(
      { success: false, error: "Audio file is empty." },
      { status: 400 },
    );
  }

  if (audio.size > MAX_FILE_SIZE_BYTES) {
    return jsonResponse(
      { success: false, error: "Audio must be 5MB or smaller." },
      { status: 400 },
    );
  }

  let templateBlobUrl: string;
  try {
    templateBlobUrl = requireEnv("ABHI_TEMPLATE_BLOB_URL");
  } catch (error) {
    return jsonResponse(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }

  const jobId = nanoid(8);
  const baseParams = {
    sync_mode: "loop" as const,
    temperature: 0.7,
    active_speaker: true,
  };

  let normalizedBuffer: Buffer;
  const audioBuffer = Buffer.from(await audio.arrayBuffer());

  try {
    normalizedBuffer = await normalizeAudioToMonoWav(audioBuffer);
  } catch {
    return jsonResponse(
      {
        success: false,
        error:
          "Failed to normalize audio. Please upload WAV/MP3 audio under 15 seconds.",
      },
      { status: 422 },
    );
  }
  await createJob({
    id: jobId,
    input: {
      templateBlobUrl,
      params: baseParams,
    },
  });

  try {
    const uploadResult = await put(`audios/${jobId}.wav`, normalizedBuffer, {
      access: "private",
      contentType: "audio/wav",
      token: requireEnv("BLOB_READ_WRITE_TOKEN"),
    });

    await upsertJob(jobId, {
      input: {
        templateBlobUrl,
        params: baseParams,
        audioBlobUrl: uploadResult.url,
      },
      audioDurationSeconds: Number.isFinite(declaredDuration)
        ? Number(declaredDuration)
        : undefined,
      output: {
        publicPlaybackUrl: getPlaybackUrl(jobId),
      },
    });

    return jsonResponse(
      {
        success: true,
        data: { jobId, audioBlobUrl: uploadResult.url },
      },
      { status: 201 },
    );
  } catch (error) {
    return jsonResponse(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
