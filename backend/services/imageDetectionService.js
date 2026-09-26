const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs/promises");
const path = require("path");

const SIGHTENGINE_API_URL = "https://api.sightengine.com/1.0/check.json";

function statusFromScore(score) {
  if (score >= 0.85) return "AI_GENERATED";
  if (score >= 0.6) return "LIKELY_AI_GENERATED";
  if (score >= 0.4) return "POSSIBLY_AI_GENERATED";
  return "LIKELY_AUTHENTIC";
}

function explanationFor(status, confidence) {
  if (status === "AI_GENERATED" || status === "LIKELY_AI_GENERATED") {
    return `The synthetic-media provider returned an AI-generation score of ${confidence}%. This score concerns the media only, not whether an accompanying claim is true.`;
  }
  if (status === "POSSIBLY_AI_GENERATED") {
    return `The synthetic-media provider returned a mixed AI-generation score of ${confidence}%. The result is inconclusive and does not establish the truth of an accompanying claim.`;
  }
  return `The provider did not report strong AI-generation signals (${confidence}%). This is not proof that the media is authentic or that an accompanying claim is true.`;
}

async function normalizeImageInput(input) {
  if (!input) return null;
  if (input.buffer && Buffer.isBuffer(input.buffer)) return input;
  if (input.path) {
    return {
      buffer: await fs.readFile(input.path),
      originalname: input.originalname || path.basename(input.path),
      mimetype: input.mimetype || "image/jpeg",
    };
  }
  if (typeof input === "string") {
    return {
      buffer: await fs.readFile(input),
      originalname: path.basename(input),
      mimetype: "image/jpeg",
    };
  }
  return null;
}

async function callSightengine(file) {
  const apiUser = String(process.env.SIGHTENGINE_API_USER || "").trim();
  const apiSecret = String(process.env.SIGHTENGINE_API_SECRET || "").trim();
  if (!apiUser || !apiSecret) throw new Error("Sightengine credentials are not configured.");

  const form = new FormData();
  form.append("models", "genai");
  form.append("api_user", apiUser);
  form.append("api_secret", apiSecret);
  form.append("media", file.buffer, {
    filename: file.originalname || "upload.jpg",
    contentType: file.mimetype || "application/octet-stream",
  });
  const response = await axios.post(SIGHTENGINE_API_URL, form, {
    headers: form.getHeaders(),
    timeout: 15000,
    maxContentLength: 10 * 1024 * 1024,
    maxBodyLength: 10 * 1024 * 1024,
  });
  const score = Number(response?.data?.type?.ai_generated);
  if (!Number.isFinite(score)) throw new Error("Sightengine did not return an AI-generation score.");
  return Math.max(0, Math.min(1, score));
}

async function analyzeImage(input) {
  const file = await normalizeImageInput(input);
  if (!file?.buffer) return null;

  try {
    const probability = await callSightengine(file);
    const confidence = Math.round(probability * 100);
    const status = statusFromScore(probability);
    return {
      mediaType: "image",
      syntheticMedia: {
        status,
        probability,
        confidence,
        isAiGenerated: status === "AI_GENERATED" || status === "LIKELY_AI_GENERATED",
        provider: "sightengine",
        providerResults: [{ provider: "sightengine", aiGeneratedScore: probability }],
        signals: [],
      },
      explanation: explanationFor(status, confidence),
    };
  } catch (error) {
    console.warn(`Image forensics unavailable: ${error.message}`);
    return {
      mediaType: "image",
      syntheticMedia: {
        status: "ANALYSIS_UNAVAILABLE",
        probability: null,
        confidence: null,
        isAiGenerated: null,
        provider: "sightengine",
        providerResults: [],
        signals: [],
      },
      explanation: "AI-media analysis could not be completed. This does not indicate that the image is synthetic or authentic.",
    };
  }
}

module.exports = {
  analyzeImage,
  statusFromScore,
};
