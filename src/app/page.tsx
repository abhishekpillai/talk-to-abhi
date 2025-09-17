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

const PROCESSING_MESSAGES = [
  "🎭 Teaching Abhi your words...",
  "🎯 Syncing those lips perfectly...",
  "✨ Adding some AI magic...",
  "🚀 Almost there...",
  "🎬 Putting the finishing touches..."
];

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
  onAudioReady: (file: File, duration: number) => void;
}

function Recorder({ onAudioReady }: RecorderProps) {
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
    <div className="flex flex-col gap-4 rounded-3xl border-2 border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 p-6 backdrop-blur">
      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-2">Record Your Voice</h3>
        <p className="text-sm text-white/70">
          Speak for up to {MAX_AUDIO_SECONDS} seconds - I&apos;ll lip-sync to your words! 🎭
        </p>
      </div>
      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={handleToggle}
          className={classNames(
            "rounded-full px-6 py-3 text-lg font-bold transition-all transform hover:scale-105",
            isRecording
              ? "bg-red-500 text-white hover:bg-red-400 shadow-lg shadow-red-500/25"
              : "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/25",
          )}
        >
          {isRecording ? "🛑 Stop Recording" : "🎤 Start Recording"}
        </button>
        <div className="flex items-center gap-3 text-sm font-medium">
          <span className={classNames(
            "inline-block h-3 w-3 rounded-full transition-all",
            isRecording ? "bg-red-500 animate-pulse" : "bg-emerald-400"
          )} />
          <span className={classNames(
            "transition-colors",
            isRecording ? "text-red-300" : "text-emerald-300"
          )}>
            {isRecording ? `Recording... ${elapsed}s` : "Ready to record"}
          </span>
        </div>
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
  const [statusMessage, setStatusMessage] = useState("Record your voice to get started");
  const [processingMessageIndex, setProcessingMessageIndex] = useState(0);

  const canSubmit = consent && !!selectedFile && !isSubmitting;
  const hasRecording = !!selectedFile;

  const handleRecorderAudio = useCallback((file: File, duration: number) => {
    setSelectedFile(file);
    setDeclaredDuration(duration);
    setError(null);
    setStatusMessage(`🎉 Captured ${Math.min(duration, MAX_AUDIO_SECONDS)}s of audio! Check the box below and let's make magic happen.`);
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
    if (job.status === "processing") {
      const interval = setInterval(() => {
        setProcessingMessageIndex((prev) => (prev + 1) % PROCESSING_MESSAGES.length);
      }, 3000);
      return () => clearInterval(interval);
    } else {
      setStatusMessage(formatStatusCopy(job.status));
      if (job.status === "failed" && job.error) {
        setError(job.error);
      }
    }
  }, [job]);

  useEffect(() => {
    if (job?.status === "processing") {
      setStatusMessage(PROCESSING_MESSAGES[processingMessageIndex]);
    }
  }, [job?.status, processingMessageIndex]);

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
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-4 text-center">
        <div className="mx-auto inline-flex w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold uppercase tracking-widest text-emerald-300">
          🎭 Consensual AI Fun
        </div>
        <h1 className="text-balance text-5xl font-bold text-white sm:text-6xl">
          Talk as Abhi
        </h1>
        <p className="mx-auto max-w-2xl text-xl text-white/80">
          Record yourself saying anything and watch me lip-sync it! 100% consensual parody magic ✨
        </p>
      </header>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Recorder onAudioReady={handleRecorderAudio} />

          {hasRecording && (
            <>
              <label className="flex items-start gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-white/90">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-emerald-400/50 bg-transparent accent-emerald-400"
                />
                <span className="text-sm font-medium">
                  ✅ I understand this is parody and I'll keep it respectful
                </span>
              </label>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={classNames(
                  "w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-500 px-8 py-4 text-xl font-bold text-white transition-all transform hover:scale-105 shadow-lg",
                  !canSubmit && "cursor-not-allowed opacity-50 transform-none",
                )}
              >
                {isSubmitting ? "🚀 Creating Magic..." : "🎬 Generate My Abhi Clip!"}
              </button>
            </>
          )}

          {error && (
            <div className="rounded-2xl border border-red-400/40 bg-red-400/10 p-4">
              <p className="text-red-300 font-medium">❌ {error}</p>
            </div>
          )}

          {statusMessage && !error && (
            <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4">
              <p className={classNames("font-medium", statusTone)}>{statusMessage}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div className="rounded-3xl border-2 border-white/10 bg-black/30 p-6 backdrop-blur">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">🎬 Video Preview</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/80 text-center">Original Abhi</h3>
                <div className="aspect-video rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border border-white/10">
                  <div className="text-center text-white/60">
                    <div className="text-4xl mb-2">🎭</div>
                    <p className="text-sm">Template Video</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white/80 text-center">Your Creation</h3>
                <div className="aspect-video rounded-xl bg-gradient-to-br from-emerald-800/30 to-blue-800/30 flex items-center justify-center border border-emerald-400/20">
                  {job?.status === "completed" && job.output?.publicPlaybackUrl ? (
                    <div className="w-full h-full">
                      <video
                        controls
                        className="w-full h-full rounded-xl"
                        src={job.output.publicPlaybackUrl}
                      />
                    </div>
                  ) : job?.status === "processing" ? (
                    <div className="text-center text-emerald-300 animate-pulse">
                      <div className="text-4xl mb-2">⚡</div>
                      <p className="text-sm font-medium">Processing...</p>
                    </div>
                  ) : (
                    <div className="text-center text-white/60">
                      <div className="text-4xl mb-2">🎬</div>
                      <p className="text-sm">Your video will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {job?.status === "completed" && job.output?.publicPlaybackUrl && (
              <div className="mt-6 space-y-4 text-center">
                <h3 className="text-lg font-bold text-emerald-300">🎉 Your Abhi clip is ready!</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    className="rounded-full bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 text-sm font-medium text-white transition-all"
                    onClick={() => {
                      navigator.clipboard.writeText(job.output!.publicPlaybackUrl!);
                    }}
                  >
                    📋 Copy Link
                  </button>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      "I just made Abhi say my words using AI! 🤖✨ Try it yourself at TalkAsAbhi.com",
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 px-4 py-2 text-sm font-medium text-blue-300 transition-all"
                  >
                    🐦 Share on X
                  </a>
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `Check out this AI magic: ${job.output.publicPlaybackUrl}`,
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-green-500/20 hover:bg-green-500/30 border border-green-400/30 px-4 py-2 text-sm font-medium text-green-300 transition-all"
                  >
                    💬 Send on WhatsApp
                  </a>
                </div>
                <p className="text-xs text-white/50">⏰ Clips auto-delete in 72 hours for privacy</p>
              </div>
            )}
          </div>

          {(job?.status === "processing" || hasRecording) && (
            <div className="rounded-3xl border border-blue-400/20 bg-blue-400/5 p-6 backdrop-blur">
              <h2 className="text-lg font-bold text-white mb-4 text-center">✨ How the Magic Works</h2>
              <div className="space-y-3 text-sm text-white/80">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 text-xl">🎤</span>
                  <span>We capture your voice and clean it up for AI processing</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-blue-400 text-xl">🤖</span>
                  <span>Replicate's AI analyzes your speech patterns</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-purple-400 text-xl">🎭</span>
                  <span>The AI maps your words to Abhi's facial movements</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400 text-xl">🎬</span>
                  <span>Final video gets a watermark and is ready to share!</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="mt-12 border-t border-white/10 pt-8 pb-4">
        <div className="text-center space-y-2">
          <p className="text-sm text-white/60">
            © {new Date().getFullYear()} Talk as Abhi • Built with ❤️ for consensual AI fun
          </p>
          <p className="text-xs text-white/40">
            Questions? Email <a className="underline hover:text-white/60 transition-colors" href="mailto:hello@talkasabhi.com">hello@talkasabhi.com</a>
          </p>
        </div>
      </footer>
    </main>
  );
}
