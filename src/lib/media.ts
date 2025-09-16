import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

if (!ffmpegPath) {
  throw new Error("ffmpeg binary was not found. Ensure ffmpeg-static is installed correctly.");
}

async function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath!, args);

    const stderr: Buffer[] = [];
    ffmpeg.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));

    ffmpeg.on("error", (error) => {
      reject(error);
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${Buffer.concat(stderr).toString()}`));
      }
    });
  });
}

async function writeTempFile(prefix: string, ext: string, data: Buffer) {
  const dir = path.join(tmpdir(), "talk-as-abhi");
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${prefix}-${randomUUID()}.${ext}`);
  await fs.writeFile(filePath, data);
  return filePath;
}

async function readAndCleanup(tempPaths: string[]) {
  try {
    const data = await fs.readFile(tempPaths[tempPaths.length - 1]!);
    return data;
  } finally {
    await Promise.all(
      tempPaths.map(async (file) => {
        try {
          await fs.unlink(file);
        } catch {
          // ignore cleanup errors
        }
      }),
    );
  }
}

export async function normalizeAudioToMonoWav(buffer: Buffer) {
  const inputPath = await writeTempFile("audio-in", "tmp", buffer);
  const outputPath = inputPath.replace(/\.tmp$/, ".wav");

  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    outputPath,
  ]);

  const normalized = await readAndCleanup([inputPath, outputPath]);
  return normalized;
}

export interface WatermarkOptions {
  text: string;
}

export async function addWatermarkToVideo(buffer: Buffer, options: WatermarkOptions) {
  const inputPath = await writeTempFile("video-in", "mp4", buffer);
  const outputPath = inputPath.replace(/\.mp4$/, "-wm.mp4");

  const watermark = options.text.replace(/:/g, "\\:");

  await runFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vf",
    `drawtext=text='${watermark}':font='DejaVuSans':fontsize=32:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=20:x=(w-text_w)/2:y=h-80`,
    "-c:a",
    "copy",
    outputPath,
  ]);

  const stamped = await readAndCleanup([inputPath, outputPath]);
  return stamped;
}
