const Complaint = require("../models/Complaint");
const { buildImpactScore } = require("../utils/impactScore");

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4);
}

function titleToPattern(title) {
  const tokens = Array.from(new Set(tokenize(title))).slice(0, 3);
  return tokens.join(" ");
}

async function fetchTrendingFakes() {
  const complaintResultsRaw = await Complaint.find().sort({ createdAt: -1 }).limit(12).lean().catch(() => []);
  const complaintResults = Array.isArray(complaintResultsRaw) ? complaintResultsRaw : [];

  const grouped = new Map();

  complaintResults.forEach((complaint) => {
    const pattern = titleToPattern(complaint.description) || complaint.complaintType || "complaint signal";
    const existing = grouped.get(pattern) || {
      pattern,
      topic: complaint.complaintType || pattern,
      mentions: 0,
      sources: [],
      examples: [],
    };
    existing.mentions += 1;
    existing.examples.push(complaint.description);
    grouped.set(pattern, existing);
  });

  return Array.from(grouped.values())
    .map((item) => {
      const impact = buildImpactScore(item.examples.join(" "));
      return {
        topic: item.topic,
        repeatedPattern: item.pattern,
        mentions: item.mentions,
        riskLevel: impact.riskLevel,
        impactScore: impact.impactScore,
        evidenceCount: item.sources.length,
        sources: item.sources.slice(0, 3),
      };
    })
    .sort((a, b) => b.mentions - a.mentions || b.impactScore - a.impactScore)
    .slice(0, 6);
}

module.exports = {
  fetchTrendingFakes,
};
