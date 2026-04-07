const { buildComplaintDraft } = require("../services/complaintAIService");
const { isDatabaseReady } = require("../config/db");
const {
  buildImpactScore,
  buildTruthBreakdown,
  buildEmotionalRisk,
  buildComplaintPriority,
} = require("../services/intelligenceService");
const { fetchTrendingFakes } = require("../services/trendService");
const { traceImage } = require("../services/imageTraceService");
const ReputationProfile = require("../models/ReputationProfile");

function normalizeText(value) {
  return String(value || "").trim();
}

async function getTrendingFakes(req, res, next) {
  try {
    const items = await fetchTrendingFakes();
    res.status(200).json({ success: true, items });
  } catch (error) {
    next(error);
  }
}

async function imageTrace(req, res, next) {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error("Image file is required for reverse trace.");
    }

    const result = await traceImage(req.file, normalizeText(req.body.hint));
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

async function generateDefenseKit(req, res, next) {
  try {
    const claim = normalizeText(req.body.claim);
    const explanation = normalizeText(req.body.explanation);
    const verdict = normalizeText(req.body.verdict) || "Unverified";
    const sourceLinks = Array.isArray(req.body.sourceLinks) ? req.body.sourceLinks : [];

    const truthBreakdown = buildTruthBreakdown({
      claim,
      status: verdict,
      explanation,
      sources: sourceLinks,
    });
    const impact = buildImpactScore(claim);
    const emotional = buildEmotionalRisk(`${claim} ${explanation}`);

    const draft = await buildComplaintDraft({
      issueType: impact.topic === "personal_attack" ? "Fake News / Defamation" : "Harassment / Cyber Abuse",
      description: `${claim}\n\nVerification summary: ${explanation}\n\nTruth breakdown: ${truthBreakdown.mismatch}`,
      platform: normalizeText(req.body.platform) || "Social Platform",
      name: normalizeText(req.body.name) || "DeepTrust User",
      email: normalizeText(req.body.email) || "user@example.com",
      evidence: sourceLinks,
    });

    res.status(200).json({
      success: true,
      complaintText: draft?.draft?.body || "No complaint draft available.",
      actions: draft?.recommendedActions || [],
      evidenceSummary: `${truthBreakdown.fact} Emotional risk: ${emotional.emotionalRisk}. Impact risk: ${impact.riskLevel}.`,
      priority: buildComplaintPriority(emotional.emotionalRisk, impact),
    });
  } catch (error) {
    next(error);
  }
}

async function reputationCheck(req, res, next) {
  try {
    if (!isDatabaseReady()) {
      res.status(503);
      throw new Error("Database is temporarily unavailable. Reputation profile storage is offline right now.");
    }

    const name = normalizeText(req.body.name);
    const contentText = normalizeText(req.body.text);
    const notes = normalizeText(req.body.notes);

    if (!name) {
      res.status(400);
      throw new Error("Name is required for reputation protection.");
    }

    const normalizedName = name.toLowerCase();
    const profile = await ReputationProfile.findOneAndUpdate(
      { normalizedName },
      {
        name,
        normalizedName,
        referenceImageName: req.file?.originalname || "",
        notes,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const mentionedByName = contentText.toLowerCase().includes(normalizedName);
    const impact = buildImpactScore(`${name} ${contentText}`);
    const emotional = buildEmotionalRisk(contentText);

    res.status(200).json({
      success: true,
      profileId: profile._id,
      matchedName: mentionedByName,
      emotionalRisk: emotional.emotionalRisk,
      impactScore: impact.impactScore,
      riskLevel: mentionedByName || emotional.emotionalRisk === "High" ? "High" : impact.riskLevel,
      summary: mentionedByName
        ? `${name} appears directly inside the checked content.`
        : `${name} was stored for future checks; no direct name match was found in this submission.`,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTrendingFakes,
  imageTrace,
  generateDefenseKit,
  reputationCheck,
};
