const { buildImpactScore } = require("../utils/impactScore");

function normalizeText(value) {
  return String(value || "").trim();
}

function inferKeywords(file, hint = "") {
  const baseName = normalizeText(file?.originalname || hint || "uploaded image")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ");

  const words = Array.from(
    new Set(
      baseName
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 2)
    )
  );

  const fallback = ["viral", "image", "claim"];
  return (words.length ? words : fallback).slice(0, 6);
}

async function searchDuckDuckGo(keywords) {
  const query = encodeURIComponent(keywords.join(" "));

  try {
    const response = await fetch(`https://duckduckgo.com/html/?q=${query}`, {
      method: "GET",
      headers: {
        "User-Agent": "DeepTrust/1.0",
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const matches = [...html.matchAll(/result__a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi)];

    return matches.slice(0, 5).map((match) => ({
      title: String(match[2] || "").replace(/<[^>]+>/g, "").trim(),
      url: String(match[1] || "").trim(),
    }));
  } catch {
    return [];
  }
}

async function traceImage(file, hint) {
  const keywords = inferKeywords(file, hint);
  const results = await searchDuckDuckGo(keywords);
  const impact = buildImpactScore(`${hint || ""} ${keywords.join(" ")}`);

  return {
    keywords,
    similarResults: results,
    searchQuery: keywords.join(" "),
    impactScore: impact.impactScore,
    note: results.length
      ? "Potentially similar web results were found for manual reverse-trace review."
      : "No search matches were returned; use the extracted keywords for manual investigation.",
  };
}

module.exports = {
  traceImage,
};
