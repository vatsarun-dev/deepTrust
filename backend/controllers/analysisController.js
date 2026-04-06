const fs = require("fs/promises");
const { analyzeWithMultipleSources } = require("../services/enhancedFakeNewsService");
const { analyzeImage } = require("../services/enhancedImageDetectionService");

function mergeResults(textResult, imageResult) {
  const availableResults = [textResult, imageResult].filter(Boolean);

  if (!availableResults.length) {
    return {
      status: "Analysis Unavailable",
      result: null,
      confidence: 50,
      explanation: "No valid analysis result could be produced. Please retry.",
      source_match: null,
      sources: [],
      source: "fallback",
    };
  }

  if (availableResults.length === 1) {
    const single = availableResults[0];
    const isArraySources = Array.isArray(single.sources);
    const defaultSources =
      single.source === "sightengine"
        ? { text: "n/a", image: "sightengine" }
        : { text: single.source || "fallback", image: "n/a" };

    return {
      status: single.status || single.result,
      result: single.result || null,
      confidence: single.confidence,
      explanation: single.explanation,
      source_match: single.source_match || null,
      sources: isArraySources
        ? single.sources
        :
        single.sources && typeof single.sources === "object" && !Array.isArray(single.sources)
          ? single.sources
          : defaultSources,
      source: single.source,
    };
  }

  const fakeVotes = availableResults.filter((item) => item.result === "Fake");
  const averageConfidence = Math.round(
    availableResults.reduce((sum, item) => sum + item.confidence, 0) / availableResults.length
  );

  return {
    status: fakeVotes.length > 0 ? "Misleading" : "Likely True",
    result: fakeVotes.length > 0 ? "Fake" : "Real",
    confidence: averageConfidence,
    explanation: `${textResult?.explanation || ""} ${imageResult?.explanation || ""}`.trim(),
    source_match: textResult ? textResult.source_match || null : null,
    sources: {
      text: textResult ? textResult.sources || [] : [],
      image: imageResult ? imageResult.source : null,
    },
  };
}

async function analyzeContent(req, res, next) {
  let uploadedFilePath = null;

  try {
    const { text } = req.body;
    uploadedFilePath = req.file ? req.file.path : null;

    if ((!text || !String(text).trim()) && !uploadedFilePath) {
      res.status(400);
      throw new Error("Provide text, an image upload, or both for analysis.");
    }

    const [textResult, imageResult] = await Promise.all([
      analyzeWithMultipleSources(text),
      analyzeImage(uploadedFilePath),
    ]);

    const mergedResult = mergeResults(textResult, imageResult);

    res.status(200).json(mergedResult);
  } catch (error) {
    next(error);
  } finally {
    if (uploadedFilePath) {
      try {
        await fs.unlink(uploadedFilePath);
      } catch (cleanupError) {
        console.warn(`Unable to remove uploaded file: ${cleanupError.message}`);
      }
    }
  }
}

module.exports = {
  analyzeContent,
};
