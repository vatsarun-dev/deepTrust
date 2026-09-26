const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { analyzeImage, statusFromScore } = require("./imageDetectionService");

const execFileAsync = promisify(execFile);
const FRAME_POSITIONS = [0.03, 0.25, 0.5, 0.75, 0.97];

async function inspectVideo(filePath) {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      filePath,
    ],
    { windowsHide: true, timeout: 15000 },
  );
  const duration = Number(JSON.parse(stdout)?.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0)
    throw new Error("Video duration could not be determined.");
  return duration;
}

async function extractFrames(filePath, duration) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "deeptrust-frames-"),
  );
  const framePaths = [];
  try {
    for (let index = 0; index < FRAME_POSITIONS.length; index += 1) {
      const output = path.join(directory, `frame-${index + 1}.jpg`);
      const timestamp = Math.max(
        0,
        Math.min(duration - 0.05, duration * FRAME_POSITIONS[index]),
      );
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-ss",
          String(timestamp),
          "-i",
          filePath,
          "-frames:v",
          "1",
          "-q:v",
          "3",
          output,
        ],
        {
          windowsHide: true,
          timeout: 30000,
        },
      );
      framePaths.push(output);
    }
    return { directory, framePaths };
  } catch (error) {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => null);
    throw error;
  }
}

async function analyzeVideo(file) {
  let frameDirectory = null;
  try {
    const duration = await inspectVideo(file.path);
    const extraction = await extractFrames(file.path, duration);
    frameDirectory = extraction.directory;
    const frameResults = await Promise.all(
      extraction.framePaths.map((framePath) => analyzeImage(framePath)),
    );
    const available = frameResults.filter((result) =>
      Number.isFinite(result?.syntheticMedia?.probability),
    );
    if (!available.length) {
      return {
        mediaType: "video",
        duration,
        syntheticMedia: {
          status: "ANALYSIS_UNAVAILABLE",
          probability: null,
          confidence: null,
          isAiGenerated: null,
          provider: "sightengine",
          providerResults: [],
          frameSignals: [],
          consistencySignals: [],
        },
        explanation:
          "No sampled video frames could be scored by the media-forensics provider.",
      };
    }

    const probability =
      available.reduce(
        (sum, result) => sum + result.syntheticMedia.probability,
        0,
      ) / available.length;
    const confidence = Math.round(probability * 100);
    const status = statusFromScore(probability);
    return {
      mediaType: "video",
      duration,
      sampledFrameCount: extraction.framePaths.length,
      syntheticMedia: {
        status,
        probability,
        confidence,
        isAiGenerated:
          status === "AI_GENERATED" || status === "LIKELY_AI_GENERATED",
        provider: "sightengine",
        providerResults: available.map((result, index) => ({
          provider: "sightengine",
          frame: index + 1,
          aiGeneratedScore: result.syntheticMedia.probability,
        })),
        frameSignals: [],
        consistencySignals: [],
      },
      explanation: `The result aggregates ${available.length} sampled frames. The provider returned an AI-generation score of ${confidence}% for the sampled media; it does not verify the accompanying claim.`,
    };
  } catch (error) {
    console.warn(`Video forensics unavailable: ${error.message}`);
    return {
      mediaType: "video",
      syntheticMedia: {
        status: "ANALYSIS_UNAVAILABLE",
        probability: null,
        confidence: null,
        isAiGenerated: null,
        provider: "sightengine",
        providerResults: [],
        frameSignals: [],
        consistencySignals: [],
      },
      explanation:
        "Video analysis could not be completed on this server. Video AI-generation status is unavailable rather than inferred.",
    };
  } finally {
    if (frameDirectory)
      await fs
        .rm(frameDirectory, { recursive: true, force: true })
        .catch(() => null);
  }
}

module.exports = {
  analyzeVideo,
};
