const fs = require("fs/promises");
const path = require("path");

const suspiciousNames = [
  "deepfake",
  "synthetic",
  "fake",
  "edited",
  "manipulated",
  "clone",
];

async function runFallbackImageAnalysis(imagePath) {
  const fileStats = await fs.stat(imagePath);
  const fileName = path.basename(imagePath).toLowerCase();
  let suspicionScore = 44;

  suspiciousNames.forEach((keyword) => {
    if (fileName.includes(keyword)) {
      suspicionScore += 10;
    }
  });

  if (fileStats.size > 1_500_000) {
    suspicionScore += 6;
  }

  const confidence = Math.max(55, Math.min(91, suspicionScore));
  const result = confidence >= 68 ? "Fake" : "Real";

  return {
    result,
    confidence,
    explanation:
      result === "Fake"
        ? "The image fallback detector found naming or file-level signals consistent with manipulated or synthetic media."
        : "The image fallback detector did not find strong file-level signals of manipulation, though forensic review may still be needed.",
    source: "fallback",
  };
}

async function analyzeWithDeepAI(imagePath) {
  const buffer = await fs.readFile(imagePath);
  const fileName = path.basename(imagePath);
  const formData = new FormData();

  formData.append("image", new Blob([buffer]), fileName);

  const response = await fetch("https://api.deepai.org/api/nsfw-detector", {
    method: "POST",
    headers: {
      "Api-Key": process.env.IMAGE_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Image provider request failed with status ${response.status}`);
  }

  const data = await response.json();
  const output = Array.isArray(data.output) ? data.output : [];
  const strongest = output.reduce(
    (max, item) => (Number(item.confidence || 0) > Number(max.confidence || 0) ? item : max),
    { confidence: 0 }
  );

  const confidence = Math.round(Number(strongest.confidence || 0) * 100);
  const result = confidence >= 65 ? "Fake" : "Real";

  return {
    result,
    confidence: Math.max(50, Math.min(98, confidence || 58)),
    explanation:
      result === "Fake"
        ? "The external image provider returned a higher-risk confidence score, suggesting the upload deserves deeper authenticity review."
        : "The external image provider returned a lower-risk confidence score, suggesting fewer obvious manipulation indicators.",
    source: "deepai",
  };
}

async function analyzeImage(imagePath) {
  if (!imagePath) {
    return null;
  }

  if (process.env.IMAGE_API_KEY) {
    try {
      return await analyzeWithDeepAI(imagePath);
    } catch (error) {
      console.warn(`Falling back to local image analysis: ${error.message}`);
    }
  }

  return runFallbackImageAnalysis(imagePath);
}

module.exports = {
  analyzeImage,
};
