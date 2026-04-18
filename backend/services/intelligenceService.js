const { buildImpactScore } = require("../utils/impactScore");

const EMOTIONAL_MANIPULATION_WORDS = [
  "shocking",
  "viral",
  "breaking",
  "must see",
  "terrifying",
  "outrage",
  "panic",
  "urgent",
  "exposed",
  "massive",
];

function normalizeText(value) {
  return String(value || "").trim();
}

function clampScore(value, fallback = 50) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function buildTruthBreakdown({ claim, status, explanation, sources = [] }) {
  const normalizedClaim = normalizeText(claim);
  const topSource = Array.isArray(sources) && sources.length ? sources[0] : null;
  const fact = topSource?.title
    ? `Closest supporting signal: ${topSource.title}`
    : "No external article directly matched the claim strongly enough.";

  let mismatch = "No major mismatch was detected.";
  if (status === "Fake" || status === "Misleading") {
    mismatch = "The claim language overreaches what the available evidence supports.";
  } else if (status === "Unverified") {
    mismatch = "The claim could not be tied to enough reliable corroboration.";
  }

  return {
    claim: normalizedClaim || "No text claim supplied.",
    fact,
    mismatch,
    verdict: status || "Unverified",
    explanation: normalizeText(explanation),
  };
}

function buildEmotionalRisk(text) {
  const normalized = normalizeText(text).toLowerCase();
  let score = 12;
  const tags = [];

  if (/\b(harass|abuse|bully|idiot|stupid|slur|shame|ruin|doxx)\b/.test(normalized)) {
    score += 30;
    tags.push("harassment");
  }
  if (/\b(crying|depressed|panic|anxiety|suicide|distress|trauma|humiliation)\b/.test(normalized)) {
    score += 28;
    tags.push("distress");
  }
  if (/\b(minor|sexual|private|leak|revenge|intimate|threat|blackmail)\b/.test(normalized)) {
    score += 35;
    tags.push("sensitive content");
  }

  if (score >= 70) {
    return { emotionalRisk: "High", score, categories: tags };
  }
  if (score >= 40) {
    return { emotionalRisk: "Medium", score, categories: tags };
  }
  return { emotionalRisk: "Low", score, categories: tags };
}

function buildMultiAiVerification({ textResult, imageResult, sourceMatch }) {
  const aiConfidence = clampScore(textResult?.confidence ?? imageResult?.confidence ?? 50);
  const ruleSignals = [
    sourceMatch === "strong" ? 92 : sourceMatch === "weak" ? 68 : 42,
    textResult?.result === "Fake" ? 82 : textResult?.result === "Real" ? 72 : 48,
    imageResult?.result === "Fake" ? 84 : imageResult?.result === "Real" ? 70 : 50,
  ].filter((value) => Number.isFinite(value));

  const ruleScore = clampScore(
    ruleSignals.reduce((sum, item) => sum + item, 0) / (ruleSignals.length || 1),
    50
  );
  const finalConfidence = clampScore((aiConfidence * 0.55) + (ruleScore * 0.45), aiConfidence);

  return {
    aiConfidence,
    ruleScore,
    finalConfidence,
  };
}

function buildExplanationModes({ claim, explanation, truthBreakdown, impact, emotionalRisk }) {
  const normalizedClaim = normalizeText(claim) || "the submitted content";
  const base = normalizeText(explanation) || "The system found mixed verification signals.";

  return {
    simple: `${base} DeepTrust scored the likely public harm at ${impact.impactScore}/100 and flagged emotional risk as ${emotionalRisk.emotionalRisk}.`,
    technical: `Signal review for "${normalizedClaim}": ${base} Structured breakdown says the primary mismatch is "${truthBreakdown.mismatch}". Multi-layer scoring estimates impact at ${impact.impactScore}/100 with emotional intensity ${impact.emotionalIntensity}/100.`,
    legal: `For "${normalizedClaim}", the available verification signals indicate a verdict of ${truthBreakdown.verdict}. Current evidence summary: ${truthBreakdown.fact}. Potential harm is rated ${impact.riskLevel} with emotional risk ${emotionalRisk.emotionalRisk}; this is informational guidance and not legal advice.`,
  };
}

function pickExplanationMode(explanations, mode) {
  const normalizedMode = normalizeText(mode).toLowerCase();
  if (normalizedMode === "technical") return explanations.technical;
  if (normalizedMode === "legal") return explanations.legal;
  return explanations.simple;
}

function buildComplaintPriority(emotionalRisk, impact) {
  if (emotionalRisk === "High" || impact?.riskLevel === "High") {
    return "Priority";
  }
  if (emotionalRisk === "Medium" || impact?.riskLevel === "Medium") {
    return "Elevated";
  }
  return "Standard";
}

function detectEmotionalManipulation(text) {
  const normalized = normalizeText(text).toLowerCase();
  const matchedWords = EMOTIONAL_MANIPULATION_WORDS.filter((word) => normalized.includes(word));

  return {
    detected: matchedWords.length > 0,
    matchedWords,
  };
}

function buildComplaintTrustScore(complaintCount = 0) {
  const normalizedCount = Math.max(0, Number(complaintCount) || 0);
  return clampScore(100 - (normalizedCount * 18), 100);
}

function buildFinalTrustScore({ aiScore, reputationScore, complaintScore }) {
  const normalizedAi = clampScore(aiScore, 50);
  const normalizedReputation = clampScore(reputationScore, 50);
  const normalizedComplaints = clampScore(complaintScore, 100);

  return clampScore(
    (normalizedAi * 0.6) + (normalizedReputation * 0.3) + (normalizedComplaints * 0.1),
    normalizedAi
  );
}

function buildTrustLabel(trustScore) {
  const score = clampScore(trustScore, 50);

  if (score >= 70) return "Likely Real";
  if (score >= 40) return "Suspicious";
  return "Likely Fake";
}

function buildExplainabilityReasons({
  claim,
  sourceCount = 0,
  complaintCount = 0,
  emotionalIntensity = 0,
}) {
  const reasons = [];
  const emotionalManipulation = detectEmotionalManipulation(claim);

  if (emotionalManipulation.detected || Number(emotionalIntensity) >= 55) {
    reasons.push("Emotional manipulation detected");
  }
  if (!sourceCount) {
    reasons.push("No credible sources found");
  }
  if (Number(complaintCount) >= 2) {
    reasons.push("Reported multiple times");
  }

  return reasons;
}

function buildImpactPrediction({ trustScore, emotionalIntensity = 0 }) {
  const normalizedTrust = clampScore(trustScore, 50);
  const normalizedEmotion = clampScore(emotionalIntensity, 0);

  if (normalizedTrust <= 35 || (normalizedTrust <= 45 && normalizedEmotion >= 60)) {
    return {
      impactLevel: "HIGH",
      impactMessage: "Low trust and strong emotional pressure make this content more likely to spread harm quickly.",
    };
  }

  if (normalizedTrust <= 60 || normalizedEmotion >= 45) {
    return {
      impactLevel: "MEDIUM",
      impactMessage: "This content shows enough uncertainty or emotional pull to deserve careful review before sharing.",
    };
  }

  return {
    impactLevel: "LOW",
    impactMessage: "Current signals suggest limited immediate harm, but verification should still be preserved.",
  };
}

function buildReputationBadge(score) {
  const normalizedScore = clampScore(score, 50);

  if (normalizedScore >= 75) return "Trusted User";
  if (normalizedScore >= 45) return "Neutral";
  return "Low Credibility";
}

module.exports = {
  buildImpactScore,
  buildTruthBreakdown,
  buildEmotionalRisk,
  buildMultiAiVerification,
  buildExplanationModes,
  pickExplanationMode,
  buildComplaintPriority,
  clampScore,
  detectEmotionalManipulation,
  buildComplaintTrustScore,
  buildFinalTrustScore,
  buildTrustLabel,
  buildExplainabilityReasons,
  buildImpactPrediction,
  buildReputationBadge,
};
