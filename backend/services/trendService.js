const Complaint = require("../models/Complaint");
const { fetchRelevantNews } = require("./gnewsService");
const { buildImpactScore } = require("../utils/impactScore");

const TREND_QUERIES = [
  "fake election claim",
  "viral AI image hoax",
  "health misinformation",
  "celebrity deepfake rumor",
  "financial scam misinformation",
];

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
  const [newsResults, complaintResultsRaw] = await Promise.all([
    Promise.all(TREND_QUERIES.map((query) => fetchRelevantNews(query).catch(() => []))),
    Complaint.find().sort({ createdAt: -1 }).limit(12).lean().catch(() => []),
  ]);
  const complaintResults = Array.isArray(complaintResultsRaw) ? complaintResultsRaw : [];

  const grouped = new Map();

  newsResults.flat().forEach((article) => {
    const pattern = titleToPattern(article.title) || "unknown signal";
    const existing = grouped.get(pattern) || {
      pattern,
      topic: pattern,
      mentions: 0,
      sources: [],
      examples: [],
    };
    existing.mentions += 1;
    if (article.url && !existing.sources.find((item) => item.url === article.url)) {
      existing.sources.push({ title: article.title, url: article.url });
    }
    if (article.title) {
      existing.examples.push(article.title);
    }
    grouped.set(pattern, existing);
  });

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
