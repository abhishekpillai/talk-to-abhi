import { getDownloadUrl } from "@vercel/blob";

import { jsonResponse } from "@/lib/http";
import {
  assertBlobConfigured,
  assertTemplateConfigured,
  getJob,
  setJobStatus,
} from "@/lib/jobs";
import { createPrediction } from "@/lib/replicate";
import { getBaseUrl } from "@/lib/url";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    assertBlobConfigured();
    assertTemplateConfigured();
  } catch (error) {
    return jsonResponse(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);
  const jobId = body?.jobId as string | undefined;

  if (!jobId) {
    return jsonResponse(
      { success: false, error: "jobId is required" },
      { status: 400 },
    );
  }

  const job = await getJob(jobId);
  if (!job) {
    return jsonResponse(
      { success: false, error: "Job not found" },
      { status: 404 },
    );
  }

  if (!job.input.audioBlobUrl) {
    return jsonResponse(
      { success: false, error: "Audio upload missing for job" },
      { status: 400 },
    );
  }

  try {
    const audioUrl = await getDownloadUrl(job.input.audioBlobUrl);

    const templateUrl = await getDownloadUrl(job.input.templateBlobUrl);

    const baseUrl = getBaseUrl();
    const webhookUrl = baseUrl.startsWith('http://localhost')
      ? undefined // Skip webhook in local development
      : `${baseUrl}/api/replicate-webhook?jobId=${jobId}`;

    const prediction = await createPrediction({
      jobId,
      audioUrl,
      videoUrl: templateUrl,
      params: job.input.params,
      webhookUrl,
    });

    await setJobStatus(jobId, "processing", {
      replicate: {
        predictionId: prediction.id,
        webhookStatus: "pending",
        raw: prediction,
      },
    });

    return jsonResponse({
      success: true,
      data: { jobId, status: "processing" as const },
    });
  } catch (error) {
    await setJobStatus(jobId, "failed", {
      error: (error as Error).message,
    }).catch(() => undefined);

    return jsonResponse(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
