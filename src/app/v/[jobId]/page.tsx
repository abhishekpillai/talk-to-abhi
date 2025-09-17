import { getDownloadUrl } from "@vercel/blob";
import { Metadata } from "next";
import { notFound } from "next/navigation";

import { CopyButton } from "@/components/copy-button";
import { getJob } from "@/lib/jobs";
import { getBaseUrl } from "@/lib/url";

export const runtime = "nodejs";
export const revalidate = 0;

interface PlaybackPageProps {
  params: { jobId: string };
}

export async function generateMetadata({ params }: PlaybackPageProps): Promise<Metadata> {
  const baseUrl = getBaseUrl();
  return {
    title: `Talk as Abhi · Clip ${params.jobId}`,
    openGraph: {
      title: `Talk as Abhi · Clip ${params.jobId}`,
      url: `${baseUrl}/v/${params.jobId}`,
    },
  };
}

export default async function PlaybackPage({ params }: PlaybackPageProps) {
  const job = await getJob(params.jobId);
  if (!job) {
    notFound();
  }

  const watermarkText = "AI-generated · Consensual Parody · TalkAsAbhi.com";

  if (job.status !== "completed") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 py-12 text-center text-white">
        <h1 className="text-3xl font-semibold">Clip still cooking</h1>
        <p className="text-white/70">
          We’re waiting for Replicate to finish rendering this clip. Refresh in a few moments.
        </p>
      </main>
    );
  }

  if (!job.output?.renderBlobUrl) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 py-12 text-center text-white">
        <h1 className="text-3xl font-semibold">Clip unavailable</h1>
        <p className="text-white/70">
          This render is missing or has expired. Generate a new one on the homepage.
        </p>
      </main>
    );
  }

  const downloadUrl = await getDownloadUrl(job.output.renderBlobUrl);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-12 text-white">
      <header className="flex flex-col gap-2 text-left">
        <p className="text-xs uppercase tracking-[0.2em] text-white/60">Talk as Abhi</p>
        <h1 className="text-4xl font-semibold text-white">Here’s your clip ✨</h1>
        <p className="max-w-2xl text-sm text-white/60">
          Share responsibly. Clips auto-delete after 72 hours.
        </p>
      </header>

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/30 p-4 shadow-2xl">
        <video
          controls
          playsInline
          className="aspect-video w-full rounded-2xl border border-white/10 bg-black"
          src={downloadUrl}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
          <span className="rounded-full bg-black/70 px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/80">
            {watermarkText}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
        <a
          href={`/`}
          className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:border-white/40"
        >
          Make another clip
        </a>
        <CopyButton
          text={`${getBaseUrl()}/v/${params.jobId}`}
          label="Copy link"
          className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:border-white/40"
        />
      </div>

      <footer className="mt-auto border-t border-white/10 pt-6 text-xs text-white/50">
        {watermarkText}
      </footer>
    </main>
  );
}
