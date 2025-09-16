import crypto from "node:crypto";

import { env, requireEnv } from "./env";

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

export interface ReplicatePrediction {
  id: string;
  status: string;
  output?: string | string[] | null;
  error?: string | null;
  urls?: {
    get: string;
  };
  [key: string]: unknown;
}

export interface CreatePredictionOptions {
  jobId: string;
  audioUrl: string;
  videoUrl: string;
  params: {
    sync_mode: "loop" | "default";
    temperature: number;
    active_speaker: boolean;
  };
  webhookUrl: string;
}

export async function createPrediction(options: CreatePredictionOptions) {
  const token = requireEnv("REPLICATE_API_TOKEN");
  const model = env.REPLICATE_MODEL ?? "replicate/lipsync-2-pro";

  const response = await fetch(`${REPLICATE_API_BASE}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: {
        video: options.videoUrl,
        audio: options.audioUrl,
        sync_mode: options.params.sync_mode,
        temperature: options.params.temperature,
        active_speaker: options.params.active_speaker,
      },
      webhook: options.webhookUrl,
      webhook_events_filter: ["completed", "failed"],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Replicate request failed: ${response.status} ${response.statusText} ${err}`);
  }

  const prediction = (await response.json()) as ReplicatePrediction;
  return prediction;
}

export function extractReplicateOutput(prediction: ReplicatePrediction) {
  const { output } = prediction;
  if (!output) return null;
  if (Array.isArray(output)) {
    return output[output.length - 1] ?? null;
  }
  if (typeof output === "string") {
    return output;
  }
  return null;
}

export function verifyReplicateSignature(body: string, signature: string | null) {
  const secret = env.REPLICATE_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const digest = `sha256=${hmac.digest("hex")}`;

  if (digest.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}
