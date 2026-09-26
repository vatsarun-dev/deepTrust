const fs = require("fs/promises");
const { runGeneralAgent } = require("../services/agent/generalAgentService");
const { analyzeImage } = require("../services/imageDetectionService");
const { analyzeVideo } = require("../services/videoAnalysisService");
const { validateUploadedMedia, uploadToImageKit } = require("../services/mediaStorageService");
const { isDatabaseReady } = require("../config/db");
const Verification = require("../models/Verification");

function clean(value) {
  return String(value || "").trim();
}

function unverifiedWithoutClaim() {
  return {
    claim: "",
    claimType: "not_provided",
    verdict: "NOT_APPLICABLE",
    confidence: null,
    confidenceMethod: "No text claim was submitted.",
    summary: "No claim was submitted, so only media authenticity was analyzed.",
    claimBreakdown: [],
    supportingEvidence: [],
    contradictingEvidence: [],
    evidence: [],
    uncertainties: [],
    explanation: {
      simple: "No claim was submitted, so only media authenticity was analyzed.",
      technical: "Claim verification was not run because the request did not include text.",
    },
    recommendedNextSteps: ["Add the accompanying caption or claim to evaluate whether this media supports it."],
  };
}

function selectExplanation(claimVerification, mode) {
  const normalized = clean(mode).toLowerCase();
  if (normalized === "technical") return claimVerification.explanation?.technical || claimVerification.summary;
  if (normalized === "advice" || normalized === "legal") {
    return claimVerification.recommendedNextSteps?.join(" ") || claimVerification.summary;
  }
  return claimVerification.explanation?.simple || claimVerification.summary;
}

function consistencyFor(claimText, claimVerification, mediaVerification) {
  if (!claimText || !mediaVerification) {
    return { status: "NOT_APPLICABLE", relationship: "NOT_APPLICABLE", reason: "A claim and media are both required for a consistency assessment." };
  }
  const status = mediaVerification.syntheticMedia?.status;
  if (["AI_GENERATED", "LIKELY_AI_GENERATED", "POSSIBLY_AI_GENERATED"].includes(status)) {
    return {
      status: "UNCERTAIN",
      relationship: "MEDIA_SHOULD_NOT_BE_USED_AS_EVIDENCE",
      reason: "The media has synthetic-generation signals, so it should not be used as proof of the accompanying claim. Claim verification remains independent.",
    };
  }
  if (claimVerification.verdict === "UNVERIFIED") {
    return {
      status: "UNCERTAIN",
      relationship: "INSUFFICIENT_CONTEXT",
      reason: "The claim remains unverified, and media authenticity alone cannot establish the event or context described.",
    };
  }
  return {
    status: "UNCERTAIN",
    relationship: "AUTHENTICITY_DOES_NOT_ESTABLISH_CONTEXT",
    reason: "The available media-forensics result assesses synthetic-generation signals, not whether the media depicts the specific event in the claim.",
  };
}

async function saveVerification(record) {
  if (!isDatabaseReady()) {
    console.warn("[DB] Verification history skipped: database unavailable.");
    return { saved: false, reason: "database_unavailable" };
  }
  try {
    await Verification.create(record);
    console.log("[DB] Verification history saved.");
    return { saved: true, reason: null };
  } catch (error) {
    console.warn(`[DB] Verification history save failed: ${error.message}`);
    return { saved: false, reason: "write_failed" };
  }
}

async function analyzeContent(req, res, next) {
  const uploadedFile = req.files?.media?.[0] || req.files?.image?.[0] || null;
  const text = clean(req.body?.text);

  try {
    if (!text && !uploadedFile) {
      res.status(400);
      throw new Error("Provide text, an image, a video, or text with media for analysis.");
    }

    let mediaInfo = null;
    if (uploadedFile) mediaInfo = await validateUploadedMedia(uploadedFile);

    const [claimVerification, mediaAnalysis, storedMedia] = await Promise.all([
      text
        ? runGeneralAgent(text, { hasMedia: Boolean(uploadedFile), mediaType: mediaInfo?.kind || null })
        : Promise.resolve(unverifiedWithoutClaim()),
      uploadedFile
        ? mediaInfo.kind === "video"
          ? analyzeVideo(uploadedFile)
          : analyzeImage(uploadedFile)
        : Promise.resolve(null),
      uploadedFile ? uploadToImageKit(uploadedFile, mediaInfo.kind) : Promise.resolve(null),
    ]);

    const mediaVerification = mediaAnalysis
      ? {
        ...mediaAnalysis,
        type: mediaInfo.kind,
        url: storedMedia?.url || null,
        storage: storedMedia?.storage || "not_configured",
        uploadError: storedMedia?.uploadError || null,
      }
      : null;
    const claimMediaConsistency = consistencyFor(text, claimVerification, mediaVerification);
    const explanationMode = clean(req.body?.explanationMode).toLowerCase() || "simple";
    const isDegraded = claimVerification.mode === "unavailable";
    const response = {
      status: isDegraded ? "degraded" : "success",
      aiAvailable: !isDegraded,
      code: isDegraded ? (claimVerification.limitations?.[0] || "GEMINI_UNAVAILABLE") : null,
      retryable: isDegraded,
      query: claimVerification.query || text,
      intent: claimVerification.intent || "not_provided",
      answer: claimVerification.answer || claimVerification.summary,
      claimVerification,
      mediaVerification,
      claimMediaConsistency,
      evidence: claimVerification.evidence || [],
      toolsUsed: claimVerification.toolsUsed || [],
      ragUsed: Boolean(claimVerification.ragUsed),
      limitations: claimVerification.limitations || [],
      explanation: {
        mode: explanationMode,
        text: selectExplanation(claimVerification, explanationMode),
      },
      nextSteps: claimVerification.recommendedNextSteps || [],
      // Compatibility fields for older consumers of this endpoint.
      verdictStatus: claimVerification.verdict,
      confidence: claimVerification.confidence,
      explanationText: selectExplanation(claimVerification, explanationMode),
      sources: claimVerification.evidence || [],
      source: "gemini-agent",
    };

    const persistence = await saveVerification({
      user: req.user?._id,
      claim: text,
      claimVerification,
      media: storedMedia ? { type: mediaInfo.kind, ...storedMedia } : null,
      mediaVerification,
      claimMediaConsistency,
      evidence: claimVerification.evidence || [],
      explanation: response.explanation,
    });
    response.persistence = persistence;
    res.status(200).json(response);
  } catch (error) {
    next(error);
  } finally {
    if (uploadedFile?.path) await fs.unlink(uploadedFile.path).catch(() => null);
  }
}

module.exports = {
  analyzeContent,
  consistencyFor,
};
