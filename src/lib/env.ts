import { z } from "zod";

const envSchema = z.object({
  REPLICATE_API_TOKEN: z
    .string()
    .min(1, "REPLICATE_API_TOKEN is required")
    .optional(),
  REPLICATE_MODEL: z.string().min(1).optional(),
  REPLICATE_WEBHOOK_SECRET: z.string().min(1).optional(),
  BLOB_READ_WRITE_TOKEN: z
    .string()
    .min(1, "BLOB_READ_WRITE_TOKEN is required to read/write Blob")
    .optional(),
  ABHI_TEMPLATE_BLOB_URL: z.string().url().optional(),
  SITE_URL: z.string().url().optional(),
  CRON_SECRET: z.string().min(1).optional(),
});

const parsed = envSchema.parse({
  REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
  REPLICATE_MODEL: process.env.REPLICATE_MODEL,
  REPLICATE_WEBHOOK_SECRET: process.env.REPLICATE_WEBHOOK_SECRET,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  ABHI_TEMPLATE_BLOB_URL: process.env.ABHI_TEMPLATE_BLOB_URL,
  SITE_URL:
    process.env.SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  CRON_SECRET: process.env.CRON_SECRET,
});

type Env = z.infer<typeof envSchema>;

export function requireEnv<T extends keyof Env>(key: T): NonNullable<Env[T]> {
  const value = parsed[key];
  if (!value) {
    throw new Error(`${key} is not configured`);
  }
  return value as NonNullable<Env[T]>;
}

export const env = parsed;
