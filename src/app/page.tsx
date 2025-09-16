"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface StatusPayload {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  output?: {
    publicPlaybackUrl?: string;
    renderBlobUrl?: string;
  };
  error?: string | null;
  createdAt?: string;
  updatedAt?: string;
  audioDurationSeconds?: number;
}

const MAX_AUDIO_SECONDS = 15;

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatStatusCopy(status: StatusPayload["status"]) {
  switch (status) {
    case "queued":
      return "Queued — we'll kick off your clip in seconds";
    case "processing":
      return "Processing — Abhi is lip-syncing your track";
    case "completed":
      return "Done!";
    case "failed":
      return "Something went wrong";
    default:
      return status;
  }
}

interface RecorderProps {
  disabled: boolean;
  onAudioReady: (file: File, duration: number) => void;
}

function Recorder({ disabled, onAudioReady }: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
    };
  }, []);

  const finalizeRecording = useCallback(
    (reason?: "timeout" | "manual") => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return;
      recorder.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      chunksRef.current = [];
      if (blob.size === 0) return;

      const file = new File([blob], "recording.webm", { type: "audio/webm" });
      onAudioReady(file, elapsed);
      if (reason === "timeout") {
        // Provide subtle feedback at the button label. Handled on parent.
      }
    },
    [elapsed, onAudioReady],
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      setElapsed(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        finalizeRecording();
      };

      recorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= MAX_AUDIO_SECONDS) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
              mediaRecorderRef.current.stop();
            }
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;
            finalizeRecording("timeout");
          }
          return next;
        });
      }, 1000);
    } catch (error) {
      console.error("microphone error", error);
      alert("We couldn't access your microphone. Please allow mic access or upload a file instead.");
    }
  }, [finalizeRecording]);

  const handleToggle = useCallback(() => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      finalizeRecording("manual");
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, finalizeRecording]);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-white/80">Inline Recorder</p>
          <p className="text-xs text-white/60">
            Tap record and speak up to {MAX_AUDIO_SECONDS} seconds. We&apos;ll auto-stop the mic.
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={classNames(
            "rounded-full px-4 py-2 text-sm font-semibold transition-all",
            isRecording
              ? "bg-red-500 text-white hover:bg-red-400"
              : "bg-white/20 text-white hover:bg-white/30",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {isRecording ? "Stop" : "Record"}
        </button>
      </div>
      <div className="flex items-center gap-2 text-xs text-white/70">
        <span className={classNames("inline-block h-2 w-2 rounded-full", isRecording ? "bg-red-500" : "bg-white/40")} />
        {isRecording ? `${elapsed}s recording…` : "Mic idle"}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [consent, setConsent] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [declaredDuration, setDeclaredDuration] = useState<number | null>(null);
  const [job, setJob] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Upload your audio to get started");

  const canSubmit = consent && !!selectedFile && !isSubmitting;

  const handleRecorderAudio = useCallback((file: File, duration: number) => {
    setSelectedFile(file);
    setDeclaredDuration(duration);
    setError(null);
    setStatusMessage(`Captured ${Math.min(duration, MAX_AUDIO_SECONDS)}s from your mic.`);
  }, []);

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Audio must be ≤ 5MB.");
      return;
    }
    setSelectedFile(file);
    setDeclaredDuration(null);
    setError(null);
    setStatusMessage(`Loaded ${file.name}`);
  }, []);

  useEffect(() => {
    if (!job?.id) return;
    if (job.status === "completed" || job.status === "failed") {
      return;
    }
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/status/${job.id}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        if (!payload?.data) return;
        setJob(payload.data);
      } catch (err) {
        console.error(err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (!job) return;
    setStatusMessage(formatStatusCopy(job.status));
    if (job.status === "failed" && job.error) {
      setError(job.error);
    }
  }, [job]);

  const handleSubmit = useCallback(async () => {
    if (!selectedFile || !consent) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("audio", selectedFile);
      formData.append("consent", "true");
      if (declaredDuration) {
        formData.append("duration", declaredDuration.toString());
      }

      const uploadResponse = await fetch("/api/upload-audio", {
        method: "POST",
        body: formData,
      });

      const uploadJson = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadJson?.error ?? "Upload failed");
      }

      const { jobId } = uploadJson.data as { jobId: string };

      const startResponse = await fetch("/api/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId }),
      });
      const startJson = await startResponse.json();
      if (!startResponse.ok) {
        throw new Error(startJson?.error ?? "Failed to start generation");
      }

      setJob({
        id: jobId,
        status: startJson.data.status,
      } as StatusPayload);
      setStatusMessage("Processing — Abhi is lip-syncing your track");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [consent, declaredDuration, selectedFile]);

  const statusTone = useMemo(() => {
    if (!job) return "text-white/80";
    if (job.status === "failed") return "text-red-400";
    if (job.status === "completed") return "text-emerald-300";
    return "text-white/80";
  }, [job]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-4 py-12 sm:px-8">
      <header className="flex flex-col gap-4 text-left">
        <div className="inline-flex w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-white/80">
          Consensual parody lab
        </div>
        <h1 className="text-balance text-4xl font-semibold text-white sm:text-5xl">
          Talk as Abhi
        </h1>
        <p className="max-w-2xl text-lg text-white/70">
          Upload or record a short audio clip and watch Abhi lip-sync it using Replicate’s lipsync-2-pro. Fun, viral, and 100% consensual.
        </p>
        <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/70">
          <p>
            Abhi consented to this demo. Only upload audio you have the right to use. No hate speech, illegal content, or harassment. Clips auto-delete within 72 hours.
          </p>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <div className="flex flex-col gap-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center transition hover:border-white/40">
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileInput}
              className="hidden"
            />
            <span className="text-lg font-semibold text-white">Upload audio</span>
            <span className="text-xs text-white/60">MP3, WAV, M4A · up to {MAX_AUDIO_SECONDS}s / 5MB</span>
          </label>

          <Recorder disabled={!consent || isSubmitting} onAudioReady={handleRecorderAudio} />

          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/30 bg-transparent"
            />
            <span>
              I understand this is parody, I have consent to use the likeness/audio, and I agree to keep it respectful.
            </span>
          </label>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={classNames(
              "w-full rounded-2xl bg-emerald-400 px-6 py-4 text-center text-base font-semibold text-emerald-950 transition",
              !canSubmit && "cursor-not-allowed opacity-50",
            )}
          >
            {isSubmitting ? "Uploading…" : "Generate my Abhi clip"}
          </button>

          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : (
            <p className={classNames("text-sm", statusTone)}>{statusMessage}</p>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold text-white">Status</h2>
            <ol className="mt-4 space-y-3 text-sm text-white/70">
              <li className={classNames(job ? "text-white" : "text-white/50")}>Upload audio</li>
              <li className={classNames(job?.status === "processing" ? "text-white" : "text-white/50")}>Generate with Replicate</li>
              <li className={classNames(job?.status === "completed" ? "text-white" : "text-white/50")}>Watch & share</li>
            </ol>
            {job?.status === "failed" && job.error ? (
              <p className="mt-4 rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-200">
                {job.error}
              </p>
            ) : null}
            {job?.status === "completed" && job.output?.publicPlaybackUrl ? (
              <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
                <p className="font-semibold">Clip ready</p>
                <a
                  href={job.output.publicPlaybackUrl}
                  className="inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200"
                >
                  View playback →
                </a>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:border-white/40"
                    onClick={() => {
                      navigator.clipboard.writeText(job.output!.publicPlaybackUrl!);
                    }}
                  >
                    Copy link
                  </button>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      "I just made Abhi talk with my own audio — try it at TalkAsAbhi.com",
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:border-white/40"
                  >
                    Share on X
                  </a>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      job.output.publicPlaybackUrl,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:border-white/40"
                  >
                    Send on WhatsApp
                  </a>
                </div>
                <p className="text-xs text-white/50">Clips auto-delete in 72 hours.</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-sm text-white/70">
            <h2 className="text-base font-semibold text-white">How it works</h2>
            <ul className="mt-3 space-y-2 list-disc pl-5">
              <li>We normalize your audio to mono WAV and upload it securely to Vercel Blob.</li>
              <li>Replicate’s lipsync-2-pro creates the talking-head video with Abhi’s consented template.</li>
              <li>We watermark the output (AI-generated · Consensual Parody · TalkAsAbhi.com) before sharing.</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} Talk as Abhi. Built for fun, shipped with care.</span>
        <span>
          Need a takedown? Email <a className="underline" href="mailto:hello@talkasabhi.com">hello@talkasabhi.com</a>
        </span>
      </footer>
    </main>
  );
}
