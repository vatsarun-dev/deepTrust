const fs = require("fs/promises");
const { analyzeFakeNews } = require("../services/fakeNewsService");
const { analyzeImage } = require("../services/imageDetectionService");
const Complaint = require("../models/Complaint");
const ReputationProfile = require("../models/ReputationProfile");
const { isDatabaseReady } = require("../config/db");
const {
  buildImpactScore,
  buildTruthBreakdown,
  buildEmotionalRisk,
  buildMultiAiVerification,
  buildExplanationModes,
  pickExplanationMode,
  buildComplaintTrustScore,
  buildFinalTrustScore,
  buildTrustLabel,
  buildExplainabilityReasons,
  buildImpactPrediction,
  buildReputationBadge,
  clampScore,
} = require("../services/intelligenceService");

function normalizeText(value) {
  return String(value || "").trim();
}

function tokenizeClaim(text) {
  return Array.from(
    new Set(
      normalizeText(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 4)
    )
  ).slice(0, 8);
}

function countMatchingComplaints(claimText, complaints = []) {
  const tokens = tokenizeClaim(claimText);
  if (!tokens.length) return 0;

  return complaints.filter((complaint) => {
    const description = normalizeText(complaint?.description).toLowerCase();
    const matches = tokens.filter((token) => description.includes(token)).length;
    return matches >= Math.min(2, tokens.length);
  }).length;
}

async function loadReporterProfile({ reporterName, reporterEmail }) {
  if (!isDatabaseReady()) {
    return null;
  }

  const normalizedName = normalizeText(reporterName).toLowerCase();
  const email = normalizeText(reporterEmail).toLowerCase();

  if (email) {
    const byEmail = await ReputationProfile.findOne({ email }).lean().catch(() => null);
    if (byEmail) return byEmail;
  }

  if (normalizedName) {
    return ReputationProfile.findOne({ normalizedName }).lean().catch(() => null);
  }

  return null;
}

async function enrichTrustDecision(mergedResult, claimText, reporter) {
  const textSources = Array.isArray(mergedResult?.sources)
    ? mergedResult.sources
    : Array.isArray(mergedResult?.sources?.text)
      ? mergedResult.sources.text
      : [];

  const profile = await loadReporterProfile(reporter);

  let complaintCount = 0;
  if (isDatabaseReady()) {
    const recentComplaints = await Complaint.find()
      .sort({ createdAt: -1 })
      .limit(40)
      .lean()
      .catch(() => []);
    complaintCount = countMatchingComplaints(claimText, recentComplaints);
  }

  const aiScore = mergedResult?.multiLayerVerification?.finalConfidence ?? mergedResult?.confidence ?? 50;
  const reputationScore = profile?.reputationScore ?? 50;
  const complaintScore = buildComplaintTrustScore(complaintCount);
  const trustScore = buildFinalTrustScore({
    aiScore,
    reputationScore,
    complaintScore,
  });
  const trustLabel = buildTrustLabel(trustScore);
  const reasons = buildExplainabilityReasons({
    claim: `${claimText} ${mergedResult?.explanation || ""}`,
    sourceCount: textSources.length,
    complaintCount,
    emotionalIntensity: mergedResult?.impact?.emotionalIntensity ?? 0,
  });
  const impactPrediction = buildImpactPrediction({
    trustScore,
    emotionalIntensity: mergedResult?.impact?.emotionalIntensity ?? 0,
  });

  return {
    ...mergedResult,
    trustScore,
    trustLabel,
    statusLabel: trustLabel,
    reasons,
    impactLevel: impactPrediction.impactLevel,
    impactMessage: impactPrediction.impactMessage,
    reporterReputation: {
      reputationScore: clampScore(reputationScore, 50),
      badge: buildReputationBadge(reputationScore),
      complaintScore,
      complaintCount,
    },
  };
}

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
    const enrichedResult = await enrichTrustDecision(mergedResult, text, {
      reporterName: req.body.reporterName,
      reporterEmail: req.body.reporterEmail,
    });

    res.status(200).json(enrichedResult);
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
