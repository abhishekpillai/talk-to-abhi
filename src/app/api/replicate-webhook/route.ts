import { put } from "@vercel/blob";

import { jsonResponse } from "@/lib/http";
import { getJob, getPlaybackUrl, setJobStatus, upsertJob } from "@/lib/jobs";
import { addWatermarkToVideo } from "@/lib/media";
import { fetchBuffer } from "@/lib/network";
import { extractReplicateOutput, verifyReplicateSignature } from "@/lib/replicate";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  if (!jobId) {
    return jsonResponse({ success: false, error: "jobId query param required" }, { status: 400 });
  }

  const bodyText = await req.text();
  const signature = req.headers.get("x-replicate-signature");

  if (!verifyReplicateSignature(bodyText, signature)) {
    return jsonResponse({ success: false, error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return jsonResponse(
      { success: false, error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const job = await getJob(jobId);
  if (!job) {
    return jsonResponse({ success: false, error: "Job not found" }, { status: 404 });
  }

  await upsertJob(jobId, {
    replicate: {
      ...(job.replicate ?? {}),
      webhookStatus: "delivered",
      raw: payload,
    },
  });

  const status = (payload?.status as string | undefined)?.toLowerCase();

  if (status === "succeeded" || status === "completed") {
    const outputUrl = extractReplicateOutput(payload);
    if (!outputUrl) {
      await setJobStatus(jobId, "failed", {
        error: "Replicate did not return an output URL",
      });
      return jsonResponse({ success: true });
    }

    try {
      const replicateVideo = await fetchBuffer(outputUrl);
      const stamped = await addWatermarkToVideo(replicateVideo, {
        text: "AI-generated · Consensual Parody · TalkAsAbhi.com",
      });
      const renderBlob = await put(`renders/${jobId}.mp4`, stamped, {
        access: "public",
        contentType: "video/mp4",
        token: requireEnv("BLOB_READ_WRITE_TOKEN"),
      });

      await setJobStatus(jobId, "completed", {
        output: {
          replicateVideoUrl: outputUrl,
          renderBlobUrl: renderBlob.url,
          publicPlaybackUrl: getPlaybackUrl(jobId),
        },
        error: null,
      });
    } catch (error) {
      await setJobStatus(jobId, "failed", {
        error: (error as Error).message,
      });
      return jsonResponse({ success: false, error: (error as Error).message }, { status: 500 });
    }

    return jsonResponse({ success: true });
  }

  if (status === "failed" || status === "canceled") {
    const errorMessage = payload?.error ?? "Prediction failed";
    await setJobStatus(jobId, "failed", {
      error: typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage),
    });
    return jsonResponse({ success: true });
  }

  // For processing events we simply acknowledge so polling continues.
  return jsonResponse({ success: true });
}
