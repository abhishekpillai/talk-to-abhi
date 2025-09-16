import { kv } from "@vercel/kv";

import { env, requireEnv } from "./env";
import type { JobRecord, JobStatus } from "./types";

const JOB_PREFIX = "job";
const RATE_LIMIT_PREFIX = "user-rate-limit";
const JOB_TTL_SECONDS = 60 * 60 * 72; // 72 hours
const RATE_LIMIT_TTL_SECONDS = 60 * 60 * 24; // 24 hours
const DAILY_JOB_CAP = 10;

function isKvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export class RateLimitExceededError extends Error {
  constructor(message = "Daily limit reached") {
    super(message);
    this.name = "RateLimitExceededError";
  }
}

export function jobKey(id: string) {
  return `${JOB_PREFIX}:${id}`;
}

export async function getJob(id: string) {
  const job = await kv.get<JobRecord>(jobKey(id));
  return job ?? null;
}

export async function createJob(initial: Pick<JobRecord, "id" | "input">) {
  const now = new Date().toISOString();
  const job: JobRecord = {
    id: initial.id,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    input: initial.input,
    error: null,
  };

  await kv.set(jobKey(job.id), job, { ex: JOB_TTL_SECONDS });
  return job;
}

export async function upsertJob(id: string, update: Partial<JobRecord>) {
  const existing = await getJob(id);
  if (!existing) {
    throw new Error(`Job ${id} not found`);
  }
  const merged: JobRecord = {
    ...existing,
    ...update,
    input: {
      ...existing.input,
      ...update.input,
      params: {
        ...existing.input.params,
        ...(update.input?.params ?? {}),
      },
    },
    replicate: {
      ...existing.replicate,
      ...update.replicate,
    },
    output: {
      ...existing.output,
      ...update.output,
    },
    updatedAt: new Date().toISOString(),
  };

  await kv.set(jobKey(id), merged, { ex: JOB_TTL_SECONDS });
  return merged;
}

export async function setJobStatus(
  id: string,
  status: JobStatus,
  extra?: Partial<JobRecord>,
) {
  return upsertJob(id, { ...extra, status });
}

export function getPlaybackUrl(id: string) {
  if (env.SITE_URL) {
    return `${env.SITE_URL.replace(/\/$/, "")}/v/${id}`;
  }
  const host = process.env.VERCEL_URL;
  if (host) {
    return `https://${host.replace(/\/$/, "")}/v/${id}`;
  }
  return `http://localhost:3000/v/${id}`;
}

function rateLimitKey(ip: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `${RATE_LIMIT_PREFIX}:${date}:${ip}`;
}

export async function trackJobForIp(ip: string) {
  if (!ip || ip === "unknown") return;
  if (!isKvConfigured()) return;

  const key = rateLimitKey(ip);
  const count = await kv.incr(key);
  if (count === 1) {
    await kv.expire(key, RATE_LIMIT_TTL_SECONDS);
  }
  if (count > DAILY_JOB_CAP) {
    throw new RateLimitExceededError();
  }
}

export async function resetJobTtl(id: string) {
  await kv.expire(jobKey(id), JOB_TTL_SECONDS);
}

export function assertBlobConfigured() {
  requireEnv("BLOB_READ_WRITE_TOKEN");
}

export function assertTemplateConfigured() {
  requireEnv("ABHI_TEMPLATE_BLOB_URL");
}
