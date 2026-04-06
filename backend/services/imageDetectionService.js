const axios = require("axios");
const FormData = require("form-data");
const dotenv = require("dotenv");
const fs = require("fs/promises");
const path = require("path");

const SIGHTENGINE_API_URL = "https://api.sightengine.com/1.0/check.json";
let cachedFallbackCreds = null;
let attemptedFallbackLoad = false;

function isDebugEnabled() {
  return process.env.DEBUG_ANALYSIS === "true";
}

function debugLog(message) {
  if (isDebugEnabled()) {
    console.log(message);
  }
}

function deriveStatus(aiScore) {
  if (aiScore > 0.85) {
    return "AI Generated";
  }
  if (aiScore > 0.6) {
    return "Possibly AI Generated";
  }
  return "Likely Real";
}

function statusToResult(status) {
  if (status === "Likely Real") {
    return "Real";
  }
  if (status === "AI Generated" || status === "Possibly AI Generated") {
    return "Fake";
  }
  return null;
}

function buildDefaultExplanation(status, confidence) {
  if (status === "AI Generated") {
    return `This image is likely AI-generated with ${confidence}% confidence based on synthetic pattern detection.`;
  }
  if (status === "Possibly AI Generated") {
    return `This image shows some AI-like signals with ${confidence}% confidence, but evidence is not conclusive.`;
  }
  return `This image appears likely real with ${confidence}% confidence because strong synthetic indicators were not detected.`;
}

function normalizeCredential(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "");
}

function isUsableCredential(value) {
  const normalized = normalizeCredential(value);
  if (!normalized) return false;
  return !/^your_/i.test(normalized);
}

function areSameCredentials(a, b) {
  return (
    normalizeCredential(a?.apiUser) === normalizeCredential(b?.apiUser) &&
    normalizeCredential(a?.apiSecret) === normalizeCredential(b?.apiSecret)
  );
}

async function loadFallbackCredentialsFromExample() {
  if (attemptedFallbackLoad) {
    return cachedFallbackCreds;
  }
  attemptedFallbackLoad = true;

  try {
    const envExamplePath = path.join(__dirname, "..", ".env.example");
    const raw = await fs.readFile(envExamplePath, "utf8");
    const parsed = dotenv.parse(raw);

    const creds = {
      apiUser: normalizeCredential(parsed.SIGHTENGINE_API_USER),
      apiSecret: normalizeCredential(parsed.SIGHTENGINE_API_SECRET),
    };

    if (isUsableCredential(creds.apiUser) && isUsableCredential(creds.apiSecret)) {
      cachedFallbackCreds = creds;
      return cachedFallbackCreds;
    }
  } catch (error) {
    debugLog(`[DEBUG][SIGHTENGINE] Could not load fallback creds from .env.example: ${error.message}`);
  }

  cachedFallbackCreds = null;
  return null;
}

async function requestSightengine(file, creds) {
  const apiUser = normalizeCredential(creds?.apiUser);
  const apiSecret = normalizeCredential(creds?.apiSecret);

  if (!apiUser || !apiSecret) {
    throw new Error("Sightengine credentials are missing");
  }

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
    maxContentLength: 8 * 1024 * 1024,
    maxBodyLength: 8 * 1024 * 1024,
  });

  const aiScore = Number(response?.data?.type?.ai_generated);
  if (!Number.isFinite(aiScore)) {
    throw new Error("Sightengine did not return ai_generated score");
  }

  debugLog(`[DEBUG][SIGHTENGINE] Raw ai_generated score: ${aiScore}`);
  return Math.max(0, Math.min(1, aiScore));
}

async function callSightengine(file) {
  const primaryCreds = {
    apiUser: process.env.SIGHTENGINE_API_USER,
    apiSecret: process.env.SIGHTENGINE_API_SECRET,
  };

  try {
    return await requestSightengine(file, primaryCreds);
  } catch (error) {
    const status = error?.response?.status;

    if (status === 401) {
      const fallbackCreds = await loadFallbackCredentialsFromExample();
      if (fallbackCreds && !areSameCredentials(primaryCreds, fallbackCreds)) {
        try {
          console.warn(
            "Sightengine auth failed with .env credentials. Retrying with backend/.env.example credentials."
          );
          return await requestSightengine(file, fallbackCreds);
        } catch (fallbackError) {
          const fallbackStatus = fallbackError?.response?.status;
          if (fallbackStatus === 401) {
            throw new Error(
              "Sightengine authentication failed (401). Check SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET in backend/.env (and backend/.env.example fallback)."
            );
          }
          if (fallbackStatus) {
            throw new Error(`Sightengine request failed with status ${fallbackStatus}`);
          }
          throw new Error(`Sightengine request failed: ${fallbackError.message}`);
        }
      }

      throw new Error(
        "Sightengine authentication failed (401). Check SIGHTENGINE_API_USER and SIGHTENGINE_API_SECRET in backend/.env."
      );
    }

    if (status) {
      throw new Error(`Sightengine request failed with status ${status}`);
    }

    throw new Error(`Sightengine request failed: ${error.message}`);
  }
}

async function normalizeImageInput(input) {
  if (!input) {
    return null;
  }

  if (input.buffer && Buffer.isBuffer(input.buffer)) {
    return input;
  }

  if (typeof input === "string") {
    const filePath = input;
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimetype = ext === ".png" ? "image/png" : "image/jpeg";
    return {
      buffer,
      originalname: path.basename(filePath),
      mimetype,
    };
  }

  return null;
}

async function analyzeImage(input) {
  const file = await normalizeImageInput(input);
  if (!file || !file.buffer) return null;

  try {
    const aiScore = await callSightengine(file);
    const status = deriveStatus(aiScore);
    const confidence = Math.round(aiScore * 100);
    const result = statusToResult(status);

    debugLog(
      `[DEBUG][IMAGE] Hard decision from Sightengine -> ai_score=${aiScore}, status="${status}", confidence=${confidence}`
    );

    return {
      status,
      result,
      confidence,
      explanation: buildDefaultExplanation(status, confidence),
      details: { ai_score: aiScore },
      source: "sightengine",
      sources: [],
    };
  } catch (error) {
    console.warn(`Sightengine failed, returning safe fallback: ${error.message}`);
    return {
      status: "Analysis Unavailable",
      result: null,
      confidence: 50,
      explanation: error.message.includes("authentication failed")
        ? "Image verification is unavailable because Sightengine credentials are invalid. Update backend/.env and retry."
        : "We could not complete AI-image scoring right now. Please retry and verify with additional sources.",
      details: { ai_score: null },
      source: "fallback",
      sources: [],
    };
  }
}

module.exports = {
  analyzeImage,
};
