const { buildImpactScore } = require("../utils/impactScore");
const { webSearchTool } = require("./webSearchService");

function normalizeText(value) {
  return String(value || "").trim();
}

function inferKeywords(hint = "") {
  const context = normalizeText(hint);
  if (!context) return [];

  const words = Array.from(
    new Set(
      context
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 2)
    )
  );

  return words.slice(0, 6);
}

async function traceImage(file, hint) {
  const keywords = inferKeywords(hint);
  const search = keywords.length
    ? await webSearchTool(keywords.join(" "), { limit: 5, fetchContent: false })
    : { results: [] };
  const results = search.results.map((item) => ({ title: item.title, url: item.url }));
  const impact = buildImpactScore(`${hint || ""} ${keywords.join(" ")}`);

  return {
    keywords,
    similarResults: results,
    searchQuery: keywords.join(" "),
    impactScore: impact.impactScore,
    note: keywords.length
      ? results.length
        ? "These are related web-search results for the supplied claim context, not a reverse-image match."
        : "No related web-search matches were returned for the supplied claim context."
      : "Add a claim or caption to run a related web search. This tool does not perform reverse-image search.",
  };
}

module.exports = {
  traceImage,
};
