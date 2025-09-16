export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface JobRecord {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  audioDurationSeconds?: number;
  input: {
    templateBlobUrl: string;
    audioBlobUrl?: string;
    params: {
      sync_mode: "loop" | "default";
      temperature: number;
      active_speaker: boolean;
    };
  };
  replicate?: {
    predictionId?: string;
    webhookStatus?: "pending" | "delivered";
    raw?: unknown;
  };
  output?: {
    replicateVideoUrl?: string;
    renderBlobUrl?: string;
    publicPlaybackUrl?: string;
  };
  error?: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
