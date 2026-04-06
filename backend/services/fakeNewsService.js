const HUGGING_FACE_MODEL_URL =
  "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli";

const REQUEST_TIMEOUT_MS = 12000;
const MAX_RETRIES = 2;

const suspiciousPatterns = [
  { regex: /\b(shocking|unbelievable|you won't believe|jaw-dropping)\b/i, score: 18 },
  { regex: /\b(breaking|urgent|must read|exposed)\b/i, score: 14 },
  { regex: /\b(guaranteed|proven|everyone knows|the truth they hide)\b/i, score: 16 },
  { regex: /\b(share this now|spread this|before it gets deleted)\b/i, score: 20 },
  { regex: /\b(secret cure|miracle cure|doctors hate this)\b/i, score: 22 },
  { regex: /\b(100%|no doubt|undeniable proof|confirmed by everyone)\b/i, score: 16 },
  { regex: /[!?]{2,}/, score: 10 },
];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(text) {
  return String(text || "").trim();
}

function runFallbackAnalysis(text) {
  const normalizedText = normalizeText(text);
  const lowerText = normalizedText.toLowerCase();
  let suspicionScore = 22;

  suspiciousPatterns.forEach((pattern) => {
    if (pattern.regex.test(lowerText)) {
      suspicionScore += pattern.score;
    }
  });

  if (normalizedText.length < 60) {
    suspicionScore += 8;
  }

  if (normalizedText.length > 600) {
    suspicionScore -= 5;
  }

  if (/\b(always|never|everyone|nobody|all|none)\b/i.test(normalizedText)) {
    suspicionScore += 10;
  }

  if (/\b(allegedly|according to|reportedly|claimed|claims|may|might)\b/i.test(normalizedText)) {
    suspicionScore -= 6;
  }

  if (/["'][^"']+["']/.test(normalizedText)) {
    suspicionScore -= 4;
  }

  if (/\b(http|www\.|source:|study|report|data)\b/i.test(normalizedText)) {
    suspicionScore -= 8;
  }

  const boundedScore = Math.max(8, Math.min(95, suspicionScore));
  const confidence = Math.max(50, boundedScore);
  const result = boundedScore >= 62 ? "Fake" : "Real";
  const explanation =
    result === "Fake"
      ? "The text contains sensational phrasing, pressure tactics, or exaggerated certainty that commonly appears in misleading posts."
      : "The text appears more measured and includes fewer manipulation signals in the local analysis.";

  return {
    result,
    confidence,
    explanation,
    source: "fallback",
  };
}

async function postToHuggingFace(text, attempt = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(HUGGING_FACE_MODEL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        inputs: text,
        parameters: {
          candidate_labels: [
            "fabricated news",
            "misleading claim",
            "clickbait or sensationalized",
            "credible reporting",
          ],
          hypothesis_template: "This text is {}.",
        },
        options: {
          wait_for_model: true,
          use_cache: false,
        },
      }),
    });

    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);

    if (attempt < MAX_RETRIES) {
      await delay(700 * (attempt + 1));
      return postToHuggingFace(text, attempt + 1);
    }

    if (error.name === "AbortError") {
      throw new Error("HuggingFace request timed out");
    }

    throw new Error(`HuggingFace network error: ${error.message}`);
  }
}

function parseHuggingFacePairs(data) {
  let pairs = [];

  if (Array.isArray(data)) {
    pairs = data.map((item) => ({
      label: String(item?.label || "").toLowerCase(),
      score: Number(item?.score || 0),
    }));
  } else if (data && Array.isArray(data.labels) && Array.isArray(data.scores)) {
    pairs = data.labels.map((label, index) => ({
      label: String(label).toLowerCase(),
      score: Number(data.scores[index] || 0),
    }));
  } else if (data && typeof data.error === "string") {
    throw new Error(`HuggingFace error: ${data.error}`);
  } else {
    throw new Error(`Unexpected HuggingFace response format: ${JSON.stringify(data)}`);
  }

  pairs = pairs.filter((item) => item.label && Number.isFinite(item.score));

  if (!pairs.length) {
    throw new Error("HuggingFace returned no usable classification scores");
  }

  return pairs;
}

async function analyzeWithHuggingFace(text) {
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    const response = await postToHuggingFace(text, attempt);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");

      if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
        attempt += 1;
        await delay(900 * attempt);
        continue;
      }

      throw new Error(
        `HuggingFace request failed with status ${response.status}${errorText ? `: ${errorText}` : ""}`
      );
    }

    const data = await response.json();

    if (data && typeof data.error === "string" && /loading/i.test(data.error) && attempt < MAX_RETRIES) {
      const waitSeconds = Number(data.estimated_time || 1);
      attempt += 1;
      await delay(Math.min(Math.ceil(waitSeconds * 1000), 5000));
      continue;
    }

    const pairs = parseHuggingFacePairs(data);

    const fakeSignals = pairs.filter((item) =>
      ["fabricated news", "misleading claim", "clickbait or sensationalized"].includes(item.label)
    );
    const realSignal = pairs.find((item) => item.label === "credible reporting");

    const fakeScore = fakeSignals.reduce((sum, item) => sum + item.score, 0);
    const realScore = realSignal ? realSignal.score : 0;
    const result = fakeScore >= realScore ? "Fake" : "Real";
    const confidence = Math.round(Math.max(fakeScore, realScore) * 100);
    const explanation =
      result === "Fake"
        ? "The external text model found stronger alignment with fabricated, misleading, or sensational reporting patterns."
        : "The external text model found stronger alignment with more credible reporting language.";

    return {
      result,
      confidence: Math.max(50, Math.min(99, confidence)),
      explanation,
      source: "huggingface",
    };
  }

  throw new Error("HuggingFace request did not return a usable result");
}

function blendResults(huggingFaceResult, fallbackResult) {
  const weightedConfidence = Math.round(
    huggingFaceResult.confidence * 0.75 + fallbackResult.confidence * 0.25
  );
  const agreement = huggingFaceResult.result === fallbackResult.result;

  return {
    result: agreement ? huggingFaceResult.result : huggingFaceResult.result,
    confidence: agreement ? weightedConfidence : Math.max(55, weightedConfidence - 6),
    explanation: agreement
      ? `${huggingFaceResult.explanation} Local heuristics point in the same direction.`
      : `${huggingFaceResult.explanation} Local heuristics were less certain, so this should be treated as a risk estimate rather than a fact check.`,
    source: "huggingface",
  };
}

async function analyzeFakeNews(text) {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return null;
  }

  const fallbackResult = runFallbackAnalysis(normalizedText);

  if (process.env.AI_API_KEY) {
    try {
      const huggingFaceResult = await analyzeWithHuggingFace(normalizedText);
      return blendResults(huggingFaceResult, fallbackResult);
    } catch (error) {
      console.warn(`Falling back to local text analysis: ${error.message}`);
    }
  }

  return fallbackResult;
}

module.exports = {
  analyzeFakeNews,
};
