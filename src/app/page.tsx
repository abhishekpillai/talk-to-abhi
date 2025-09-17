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

      <section className="flex flex-col gap-12">
        {/* Prominent Video Section */}
        <div className="w-full">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">🎬 Watch the Magic Happen</h2>
            <p className="text-white/70">See the original Abhi and watch your creation come to life</p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 max-w-6xl mx-auto">
            {/* Original Abhi Video */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white/90 text-center">Original Abhi</h3>
              <div className="rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 overflow-hidden shadow-2xl" style={{height: "400px"}}>
                <video
                  controls
                  muted
                  preload="metadata"
                  className="w-full h-full object-cover"
                  src="https://y2gvxtii819fey1g.public.blob.vercel-storage.com/templates/abhi-v1.mp4"
                >
                  <div className="text-center text-white/60 h-full flex flex-col items-center justify-center">
                    <div className="text-6xl mb-4">🎭</div>
                    <p className="text-lg">Template Video</p>
                  </div>
                </video>
              </div>
            </div>

            {/* Generated Video */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white/90 text-center">Your Creation</h3>
              <div className="rounded-2xl bg-gradient-to-br from-emerald-800/30 to-blue-800/30 border border-emerald-400/20 overflow-hidden shadow-2xl" style={{height: "400px"}}>
                {job?.status === "completed" && job.output?.publicPlaybackUrl ? (
                  <video
                    controls
                    className="w-full h-full object-cover"
                    src={job.output.publicPlaybackUrl}
                  />
                ) : job?.status === "processing" ? (
                  <div className="text-center text-emerald-300 animate-pulse h-full flex flex-col items-center justify-center">
                    <div className="text-6xl mb-4">⚡</div>
                    <p className="text-lg font-medium">{PROCESSING_MESSAGES[processingMessageIndex]}</p>
                  </div>
                ) : (
                  <div className="text-center text-white/60 h-full flex flex-col items-center justify-center">
                    <div className="text-6xl mb-4">🎬</div>
                    <p className="text-lg">Your video will appear here</p>
                    <p className="text-sm text-white/40 mt-2">Record your voice below to get started</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Completion Actions */}
          {job?.status === "completed" && job.output?.publicPlaybackUrl && (
            <div className="mt-8 text-center space-y-6 max-w-4xl mx-auto">
              <h3 className="text-2xl font-bold text-emerald-300">🎉 Your Abhi clip is ready!</h3>
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  type="button"
                  className="rounded-full bg-white/10 hover:bg-white/20 border border-white/20 px-6 py-3 text-sm font-medium text-white transition-all transform hover:scale-105"
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
                  className="rounded-full bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 px-6 py-3 text-sm font-medium text-blue-300 transition-all transform hover:scale-105"
                >
                  🐦 Share on X
                </a>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Check out this AI magic: ${job.output.publicPlaybackUrl}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-green-500/20 hover:bg-green-500/30 border border-green-400/30 px-6 py-3 text-sm font-medium text-green-300 transition-all transform hover:scale-105"
                >
                  💬 Send on WhatsApp
                </a>
              </div>
              <p className="text-sm text-white/50">⏰ Clips auto-delete in 72 hours for privacy</p>
            </div>
          )}
        </div>

        {/* Recording Section */}
        <div className="max-w-3xl mx-auto w-full">
          <Recorder onAudioReady={handleRecorderAudio} />

          {hasRecording && (
            <div className="mt-6 space-y-4">
              <label className="flex items-start gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-white/90 max-w-md mx-auto">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-emerald-400/50 bg-transparent accent-emerald-400"
                />
                <span className="text-sm font-medium">
                  ✅ I understand this is parody and I&apos;ll keep it respectful
                </span>
              </label>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={classNames(
                  "w-full max-w-md mx-auto block rounded-2xl bg-gradient-to-r from-emerald-500 to-blue-500 px-8 py-4 text-xl font-bold text-white transition-all transform hover:scale-105 shadow-lg",
                  !canSubmit && "cursor-not-allowed opacity-50 transform-none",
                )}
              >
                {isSubmitting ? "🚀 Creating Magic..." : "🎬 Generate My Abhi Clip!"}
              </button>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-400/40 bg-red-400/10 p-4 mt-6 max-w-md mx-auto">
              <p className="text-red-300 font-medium text-center">❌ {error}</p>
            </div>
          )}

          {statusMessage && !error && (
            <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4 mt-6 max-w-md mx-auto">
              <p className={classNames("font-medium text-center", statusTone)}>{statusMessage}</p>
            </div>
          )}
        </div>

        {/* How it Works - Only during processing or after recording */}
        {(job?.status === "processing" || hasRecording) && (
          <div className="max-w-4xl mx-auto w-full">
            <div className="rounded-3xl border border-blue-400/20 bg-blue-400/5 p-8 backdrop-blur">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">✨ How the Magic Works</h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div className="text-center space-y-3">
                  <span className="text-emerald-400 text-4xl block">🎤</span>
                  <p className="text-sm text-white/80">We capture your voice and clean it up for AI processing</p>
                </div>
                <div className="text-center space-y-3">
                  <span className="text-blue-400 text-4xl block">🤖</span>
                  <p className="text-sm text-white/80">Replicate&apos;s AI analyzes your speech patterns</p>
                </div>
                <div className="text-center space-y-3">
                  <span className="text-purple-400 text-4xl block">🎭</span>
                  <p className="text-sm text-white/80">The AI maps your words to Abhi&apos;s facial movements</p>
                </div>
                <div className="text-center space-y-3">
                  <span className="text-yellow-400 text-4xl block">🎬</span>
                  <p className="text-sm text-white/80">Final video gets a watermark and is ready to share!</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="mt-12 border-t border-white/10 pt-8 pb-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-white/60">
            © {new Date().getFullYear()} Talk as Abhi • Built with ❤️ for consensual AI fun
          </p>
          <div className="flex justify-center gap-6 text-xs">
            <a
              href="https://x.com/abhiondemand"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-blue-400 transition-colors flex items-center gap-1"
            >
              <span>🐦</span> Follow on X
            </a>
            <a
              href="https://linkedin.com/in/abhipillai1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-blue-600 transition-colors flex items-center gap-1"
            >
              <span>💼</span> Connect on LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
