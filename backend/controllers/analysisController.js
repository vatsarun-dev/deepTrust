const fs = require("fs/promises");
const { analyzeFakeNews } = require("../services/fakeNewsService");
const { analyzeImage } = require("../services/imageDetectionService");
const {
  buildImpactScore,
  buildTruthBreakdown,
  buildEmotionalRisk,
  buildMultiAiVerification,
  buildExplanationModes,
  pickExplanationMode,
} = require("../services/intelligenceService");

function mergeResults(textResult, imageResult, explanationMode, claimText) {
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
      truthBreakdown: single.truthBreakdown,
      impact: single.impact,
      emotionalRisk: single.emotionalRisk,
      emotionalSignals: single.emotionalSignals,
      explanationModes: single.explanationModes,
      multiLayerVerification: single.multiLayerVerification,
    };
  }

  const fakeVotes = availableResults.filter((item) => item.result === "Fake");
  const averageConfidence = Math.round(
    availableResults.reduce((sum, item) => sum + item.confidence, 0) / availableResults.length
  );
  const impact = buildImpactScore(claimText);
  const emotional = buildEmotionalRisk(
    `${claimText || ""} ${textResult?.explanation || ""} ${imageResult?.explanation || ""}`
  );
  const truthBreakdown = buildTruthBreakdown({
    claim: claimText,
    status: fakeVotes.length > 0 ? "Misleading" : "Likely True",
    explanation: `${textResult?.explanation || ""} ${imageResult?.explanation || ""}`.trim(),
    sources: textResult?.sources || [],
  });
  const explanationModes = buildExplanationModes({
    claim: claimText,
    explanation: `${textResult?.explanation || ""} ${imageResult?.explanation || ""}`.trim(),
    truthBreakdown,
    impact,
    emotionalRisk: emotional,
  });
  const multiLayerVerification = buildMultiAiVerification({
    textResult,
    imageResult,
    sourceMatch: textResult?.source_match,
  });

  return {
    status: fakeVotes.length > 0 ? "Misleading" : "Likely True",
    result: fakeVotes.length > 0 ? "Fake" : "Real",
    confidence: multiLayerVerification.finalConfidence || averageConfidence,
    explanation: pickExplanationMode(explanationModes, explanationMode),
    source_match: textResult ? textResult.source_match || null : null,
    sources: {
      text: textResult ? textResult.sources || [] : [],
      image: imageResult ? imageResult.source : null,
    },
    source: "multi-layer",
    truthBreakdown,
    impact,
    emotionalRisk: emotional.emotionalRisk,
    emotionalSignals: emotional.categories,
    explanationModes,
    multiLayerVerification,
  };
}

async function analyzeContent(req, res, next) {
  let uploadedFilePath = null;

  try {
    const { text, explanationMode } = req.body;
    uploadedFilePath = req.file ? req.file.path : null;

    if ((!text || !String(text).trim()) && !uploadedFilePath) {
      res.status(400);
      throw new Error("Provide text, an image upload, or both for analysis.");
    }

    const [textResult, imageResult] = await Promise.all([
      analyzeFakeNews(text, { mode: explanationMode }),
      analyzeImage(uploadedFilePath, { mode: explanationMode, contextText: text }),
    ]);

    const mergedResult = mergeResults(textResult, imageResult, explanationMode, text);

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
