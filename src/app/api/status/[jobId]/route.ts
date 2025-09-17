import { jsonResponse } from "@/lib/http";
import { getJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getJob(jobId);
  if (!job) {
    return jsonResponse({ success: false, error: "Job not found" }, { status: 404 });
  }

  const { replicate, ...rest } = job;

  return jsonResponse({
    success: true,
    data: {
      ...rest,
      replicate: replicate
        ? {
            predictionId: replicate.predictionId,
            webhookStatus: replicate.webhookStatus,
          }
        : undefined,
    },
  });
}
