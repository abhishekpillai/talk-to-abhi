import { put } from "@vercel/blob";

import { jsonResponse } from "@/lib/http";
import { getJob, setJobStatus, getPlaybackUrl } from "@/lib/jobs";
import { addWatermarkToVideo } from "@/lib/media";
import { fetchBuffer } from "@/lib/network";
import { extractReplicateOutput } from "@/lib/replicate";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  const job = await getJob(jobId);
  if (!job) {
    return jsonResponse({ success: false, error: "Job not found" }, { status: 404 });
  }

  if (!job.replicate?.predictionId) {
    return jsonResponse({ success: false, error: "No prediction ID found" }, { status: 400 });
  }

  try {
    // Fetch current prediction status from Replicate
    const token = requireEnv("REPLICATE_API_TOKEN");
    const response = await fetch(`https://api.replicate.com/v1/predictions/${job.replicate.predictionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return jsonResponse({ success: false, error: "Failed to fetch prediction status" }, { status: 500 });
    }

    const prediction = await response.json();
    const status = prediction.status?.toLowerCase();

    if (status === "succeeded" || status === "completed") {
      const outputUrl = extractReplicateOutput(prediction);
      if (!outputUrl) {
        await setJobStatus(jobId, "failed", {
          error: "Replicate did not return an output URL",
        });
        return jsonResponse({ success: true, data: { status: "failed", reason: "No output URL" } });
      }

      // Download and watermark the video
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

      return jsonResponse({
        success: true,
        data: {
          status: "completed",
          renderBlobUrl: renderBlob.url,
          replicateStatus: prediction.status
        }
      });

    } else if (status === "failed" || status === "canceled") {
      const errorMessage = prediction.error ?? "Prediction failed";
      await setJobStatus(jobId, "failed", {
        error: typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage),
      });
      return jsonResponse({
        success: true,
        data: {
          status: "failed",
          error: errorMessage,
          replicateStatus: prediction.status
        }
      });

    } else {
      // Still processing
      return jsonResponse({
        success: true,
        data: {
          status: "processing",
          replicateStatus: prediction.status
        }
      });
    }

  } catch (error) {
    return jsonResponse({
      success: false,
      error: `Sync failed: ${(error as Error).message}`
    }, { status: 500 });
  }
}