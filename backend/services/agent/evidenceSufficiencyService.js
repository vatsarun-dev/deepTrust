const QUALITY_VALUE = { high: 1, medium: 0.68, low: 0.35 };

function recencyScore(value) {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return 0.5;
  const ageDays = Math.max(0, (Date.now() - timestamp) / (24 * 60 * 60 * 1000));
  if (ageDays <= 30) return 1;
  if (ageDays <= 365) return 0.8;
  if (ageDays <= 3 * 365) return 0.55;
  return 0.3;
}

function sourceDomain(item) {
  try {
    return new URL(item?.url || "").hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return String(item?.sourceName || "unknown").toLowerCase();
  }
}

function normalizeAssessment(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ["sufficient", "partially_sufficient", "insufficient", "contradictory", "evidence_unavailable"].includes(normalized)
    ? normalized
    : null;
}

function evaluateEvidenceSufficiency(evidence = [], modelAssessment) {
  const items = Array.isArray(evidence) ? evidence.filter(Boolean) : [];
  const assessment = normalizeAssessment(modelAssessment);
  if (!items.length) {
    return {
      status: "evidence_unavailable",
      sufficient: false,
      score: 0,
      modelAssessment: assessment || "evidence_unavailable",
      metrics: { evidenceCount: 0, highQualityCount: 0, sourceDiversity: 0, averageRelevance: 0, averageRecency: 0 },
    };
  }

  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const averageRelevance = average(items.map((item) => Math.max(0, Math.min(1, Number(item.relevanceScore) || 0))));
  const averageQuality = average(items.map((item) => QUALITY_VALUE[item.sourceQuality] || QUALITY_VALUE.low));
  const averageRecency = average(items.map((item) => recencyScore(item.publishedAt || item.retrievedAt)));
  const sourceDiversity = new Set(items.map(sourceDomain)).size;
  const highQualityCount = items.filter((item) => item.sourceQuality === "high").length;
  const diversityScore = Math.min(1, sourceDiversity / 3);
  const score = Math.round((averageRelevance * 0.4 + averageQuality * 0.25 + diversityScore * 0.2 + averageRecency * 0.15) * 100);
  const strongSingleSource = highQualityCount >= 1 && averageRelevance >= 0.62;
  const corroboratedSources = sourceDiversity >= 2 && averageRelevance >= 0.48 && averageQuality >= 0.55;
  const heuristicSufficient = strongSingleSource || corroboratedSources || score >= 70;

  let status = "insufficient";
  if (assessment === "contradictory") status = "contradictory";
  else if (heuristicSufficient && (!assessment || assessment === "sufficient" || assessment === "partially_sufficient")) status = "sufficient";
  else if (assessment === "partially_sufficient" || score >= 42) status = "partially_sufficient";

  return {
    status,
    sufficient: status === "sufficient" || status === "contradictory",
    score,
    modelAssessment: assessment || "not_available",
    metrics: {
      evidenceCount: items.length,
      highQualityCount,
      sourceDiversity,
      averageRelevance: Math.round(averageRelevance * 100) / 100,
      averageRecency: Math.round(averageRecency * 100) / 100,
    },
  };
}

module.exports = {
  evaluateEvidenceSufficiency,
  normalizeAssessment,
};
