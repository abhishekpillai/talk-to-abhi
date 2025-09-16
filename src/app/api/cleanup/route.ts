import { del, list } from "@vercel/blob";

import { jsonResponse } from "@/lib/http";
import { env, requireEnv } from "@/lib/env";

export const runtime = "nodejs";

const RENDER_PREFIX = "renders/";
const EXPIRATION_HOURS = 72;

export async function GET(req: Request) {
  const secret = env.CRON_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization") ?? "";
    const expected = `Bearer ${secret}`;
    if (authHeader !== expected) {
      return jsonResponse({ success: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const now = Date.now();
    const cutoff = now - EXPIRATION_HOURS * 60 * 60 * 1000;
    const expired: string[] = [];

    let cursor: string | undefined;
    do {
      const result = await list({
        token: requireEnv("BLOB_READ_WRITE_TOKEN"),
        prefix: RENDER_PREFIX,
        cursor,
      });
      for (const blob of result.blobs) {
        if (blob.uploadedAt.getTime() < cutoff) {
          expired.push(blob.url);
        }
      }
      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);

    if (expired.length > 0) {
      await del(expired, { token: requireEnv("BLOB_READ_WRITE_TOKEN") });
    }

    return jsonResponse({
      success: true,
      data: {
        deleted: expired.length,
      },
    });
  } catch (error) {
    return jsonResponse(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
