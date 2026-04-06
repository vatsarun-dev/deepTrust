const fs = require("fs/promises");
const { analyzeFakeNews } = require("../services/fakeNewsService");
const { analyzeImage } = require("../services/imageDetectionService");

function mergeResults(textResult, imageResult) {
  const availableResults = [textResult, imageResult].filter(Boolean);

  if (!availableResults.length) {
    return null;
  }

  if (availableResults.length === 1) {
    return {
      result: availableResults[0].result,
      confidence: availableResults[0].confidence,
      explanation: availableResults[0].explanation,
      source: availableResults[0].source,
    };
  }

  const fakeVotes = availableResults.filter((item) => item.result === "Fake");
  const averageConfidence = Math.round(
    availableResults.reduce((sum, item) => sum + item.confidence, 0) / availableResults.length
  );

  return {
    result: fakeVotes.length > 0 ? "Fake" : "Real",
    confidence: averageConfidence,
    explanation: `${textResult.explanation} ${imageResult.explanation}`.trim(),
    sources: {
      text: textResult ? textResult.source : null,
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
      analyzeFakeNews(text),
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
