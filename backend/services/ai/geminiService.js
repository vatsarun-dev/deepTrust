const dns = require("dns");
try { dns.setDefaultResultOrder("ipv4first"); } catch {}
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env"), override: true });
const { GoogleGenAI } = require("@google/genai");

const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;
const MAX_BACKOFF_MS = 8000;

const geminiAvailability = {
  rateLimitedUntil: null,
  lastErrorCode: null,
};

class GeminiServiceError extends Error {
  constructor(message, code = "gemini_unavailable", details = {}) {
    super(message);
    this.name = "GeminiServiceError";
    this.code = code;
    this.status = details.status || null;
    this.retryAfter = details.retryAfter || null;
    this.retryable = Boolean(details.retryable);
  }
}

function getApiKey() {
  return String(process.env.GEMINI_API_KEY || "").trim();
}

function getModelName() {
  return String(process.env.GEMINI_MODEL || "gemini-3.8-flash").trim();
}

function getEmbeddingModelName() {
  return String(process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004").trim();
}

function getGeminiStatus() {
  const apiKey = getApiKey();
  const now = Date.now();
  const rateLimited = Number.isFinite(geminiAvailability.rateLimitedUntil)
    && geminiAvailability.rateLimitedUntil > now;
  if (!rateLimited && geminiAvailability.rateLimitedUntil) {
    geminiAvailability.rateLimitedUntil = null;
  }
  return {
    configured: Boolean(apiKey),
    available: Boolean(apiKey) && !rateLimited,
    model: getModelName(),
    reason: rateLimited ? "rate_limited" : geminiAvailability.lastErrorCode,
    retryAfter: rateLimited ? new Date(geminiAvailability.rateLimitedUntil).toISOString() : null,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoff(attempt) {
  const exponential = RETRY_BASE_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 300;
  return Math.min(MAX_BACKOFF_MS, exponential + jitter);
}

function retryAfterTimestamp(value) {
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Date.now() + seconds * 1000;
  const date = Date.parse(String(value || ""));
  if (Number.isFinite(date) && date > Date.now()) return date;
  return Date.now() + 60 * 1000;
}

function parseHttpStatus(error) {
  if (error?.status && typeof error.status === "number") return error.status;
  if (error?.code && typeof error.code === "number") return error.code;
  if (error?.response?.status) return error.response.status;
  const statusMatch = String(error?.message || "").match(/\b(400|401|403|404|429|500|502|503|504)\b/);
  if (statusMatch) return parseInt(statusMatch[1], 10);
  return null;
}

function codeForHttpStatus(status) {
  if (status === 401 || status === 403) return "authentication_failed";
  if (status === 404) return "model_unavailable";
  if (status === 400) return "invalid_argument";
  if (status === 408 || status === 504) return "timeout";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "request_failed";
}

function extractMessageText(response) {
  if (!response) return "";
  if (typeof response.text === "string") return response.text.trim();
  if (typeof response.text === "function") return response.text().trim();
  const candidateText = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof candidateText === "string") return candidateText.trim();
  return "";
}

function parseJsonObject(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw) throw new GeminiServiceError("Gemini returned an empty response.", "invalid_response");

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new GeminiServiceError("Gemini did not return a JSON object.", "invalid_response");
  }

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new GeminiServiceError("Gemini returned malformed JSON.", "invalid_response");
  }
}

async function createJsonCompletion({ system, user, temperature = 0, maxTokens = 1800 }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    geminiAvailability.lastErrorCode = "missing_api_key";
    throw new GeminiServiceError("GEMINI_API_KEY is not configured.", "missing_api_key");
  }

  const status = getGeminiStatus();
  if (status.reason === "rate_limited" && status.retryAfter) {
    throw new GeminiServiceError(
      `Gemini is rate limited until ${status.retryAfter}.`,
      "rate_limited",
      { retryAfter: status.retryAfter, retryable: true },
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const primaryModel = getModelName();
  const fallbackModels = [primaryModel, "gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"].filter(
    (m, i, arr) => m && arr.indexOf(m) === i
  );

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    for (const modelCandidate of fallbackModels) {
      const startTime = Date.now();
      console.log(`[GEMINI][REQUEST] Attempt ${attempt + 1}/${MAX_RETRIES + 1} using model ${modelCandidate}`);

      try {
        const response = await ai.models.generateContent({
          model: modelCandidate,
          contents: user,
          config: {
            systemInstruction: system,
            temperature,
            maxOutputTokens: maxTokens,
            responseMimeType: "application/json",
          },
        });

        const text = extractMessageText(response);
        const parsed = parseJsonObject(text);
        geminiAvailability.lastErrorCode = null;
        console.log(`[GEMINI][SUCCESS] Request completed in ${Date.now() - startTime}ms using ${modelCandidate}`);
        return parsed;
      } catch (error) {
        lastError = error;
        const httpStatus = parseHttpStatus(error);
        const code = codeForHttpStatus(httpStatus);
        const causeMsg = error?.cause?.code || error?.cause?.message || "";
        console.log(`[GEMINI][ERROR] Code: ${code}, Status: ${httpStatus || "N/A"}, Message: ${error.message?.slice(0, 200)}${causeMsg ? ` (Cause: ${causeMsg})` : ""}`);

        if (code === "rate_limited") {
          const retryAfterHeader = error?.headers?.get?.("retry-after") || error?.retryAfter;
          const blockedUntil = retryAfterTimestamp(retryAfterHeader);
          geminiAvailability.rateLimitedUntil = blockedUntil;
          geminiAvailability.lastErrorCode = code;

          if (attempt < MAX_RETRIES) {
            const delay = Math.max(computeBackoff(attempt), blockedUntil - Date.now());
            console.log(`[GEMINI][RETRY] Rate limited (429). Retrying in ${Math.round(delay)}ms...`);
            await sleep(Math.min(delay, MAX_BACKOFF_MS));
            break; // Break inner model loop, retry outer loop
          }
          throw new GeminiServiceError(
            `Gemini request was rate limited (429). Retry after ${new Date(blockedUntil).toISOString()}.`,
            code,
            { status: 429, retryAfter: new Date(blockedUntil).toISOString(), retryable: true }
          );
        }

        if (code === "authentication_failed" || code === "invalid_argument") {
          geminiAvailability.lastErrorCode = code;
          throw new GeminiServiceError(
            `Gemini authentication/configuration error: ${error.message}`,
            code,
            { status: httpStatus || 401, retryable: false }
          );
        }

        if (code === "model_unavailable" || code === "provider_unavailable") {
          // Fall through to next model candidate in inner loop
          continue;
        }

        const isRetryable = code === "timeout" || code === "request_failed";
        if (isRetryable && attempt < MAX_RETRIES) {
          const delay = computeBackoff(attempt);
          console.log(`[GEMINI][RETRY] Transient error (${code}). Retrying in ${Math.round(delay)}ms...`);
          await sleep(delay);
          break; // Break inner loop to retry outer loop
        }

        geminiAvailability.lastErrorCode = code;
        throw new GeminiServiceError(
          `Gemini request failed: ${error.message || "Unknown error"}`,
          code,
          { status: httpStatus, retryable: isRetryable }
        );
      }
    }
  }

  geminiAvailability.lastErrorCode = "request_failed";
  throw new GeminiServiceError(
    `Gemini request failed after ${MAX_RETRIES} retries: ${lastError?.message || "Unknown error"}`,
    "request_failed",
    { retryable: true }
  );
}

async function createEmbeddings(inputs) {
  const values = Array.isArray(inputs) ? inputs.filter(Boolean) : [];
  if (!values.length) return [];

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new GeminiServiceError("GEMINI_API_KEY is not configured.", "missing_api_key");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = getEmbeddingModelName();

  try {
    const vectors = [];
    for (const text of values) {
      const response = await ai.models.embedContent({
        model,
        contents: text,
      });
      const embedding = response?.embedding?.values;
      if (Array.isArray(embedding)) {
        vectors.push(embedding);
      }
    }

    if (vectors.length !== values.length) {
      throw new GeminiServiceError("Gemini returned incomplete embeddings.", "invalid_response");
    }

    return vectors;
  } catch (error) {
    console.log(`[GEMINI][ERROR] Embedding error: ${error.message}`);
    throw new GeminiServiceError(`Embedding generation failed: ${error.message}`, "embedding_failed");
  }
}

module.exports = {
  GeminiServiceError,
  createJsonCompletion,
  createEmbeddings,
  getGeminiStatus,
  _resetGeminiAvailability() {
    geminiAvailability.rateLimitedUntil = null;
    geminiAvailability.lastErrorCode = null;
  },
};
