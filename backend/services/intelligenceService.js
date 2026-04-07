const { buildImpactScore } = require("../utils/impactScore");

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

module.exports = {
  buildImpactScore,
  buildTruthBreakdown,
  buildEmotionalRisk,
  buildMultiAiVerification,
  buildExplanationModes,
  pickExplanationMode,
  buildComplaintPriority,
  clampScore,
};
