const { fetchRelevantNews } = require("./gnewsService");

const STOP_WORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "will",
  "your",
  "about",
  "there",
  "their",
  "which",
  "would",
  "could",
  "should",
  "after",
  "before",
  "where",
  "when",
  "what",
  "these",
  "those",
  "into",
  "than",
  "been",
  "being",
  "also",
  "just",
  "only",
  "very",
  "because",
  "claim",
  "article",
  "post",
  "news",
]);

const CONTRADICT_TERMS =
  /\b(false|fake|myth|hoax|debunk|debunked|refute|refuted|misleading|not true|no evidence|denied|incorrect|scam|impossible)\b/i;
const SUPPORT_TERMS =
  /\b(confirmed|verify|verified|evidence|study|official|reported|supports|supporting|according to)\b/i;

function isDebugEnabled() {
  return process.env.DEBUG_ANALYSIS === "true";
}

function debugLog(message) {
  if (isDebugEnabled()) {
    console.log(message);
  }
}

function normalizeText(text) {
  return String(text || "").trim();
}

function statusToLegacyResult(status) {
  if (status === "True" || status === "Likely True") return "Real";
  if (status === "Unverified") return null;
  return "Fake";
}

function tokenizeForMatching(text) {
  return Array.from(
    new Set(
      String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 4)
        .filter((word) => !STOP_WORDS.has(word))
    )
  );
}

function computeArticleOverlap(claimTokens, article) {
  if (!claimTokens.length) {
    return 0;
  }
  const articleText = `${article.title || ""} ${article.description || ""}`.toLowerCase();
  const matchedCount = claimTokens.filter((token) => articleText.includes(token)).length;
  return matchedCount / claimTokens.length;
}

function classifyArticleVerdict(article) {
  const articleText = `${article.title || ""} ${article.description || ""}`;
  if (CONTRADICT_TERMS.test(articleText)) return "contradict";
  if (SUPPORT_TERMS.test(articleText)) return "support";
  return "neutral";
}

function mapSources(articles) {
  return articles.slice(0, 3).map((article) => ({
    title: String(article?.title || "").trim(),
    url: String(article?.url || "").trim(),
  }));
}

function buildUnverifiedResult(articles, explanation) {
  return {
    status: "Unverified",
    result: null,
    confidence: 45,
    explanation,
    source_match: "none",
    sources: mapSources(articles),
    source: "gnews",
  };
}

function scoreFromGNews(claimText, articles) {
  const claimTokens = tokenizeForMatching(claimText);
  const scored = articles
    .map((article) => ({
      article,
      overlap: computeArticleOverlap(claimTokens, article),
      verdict: classifyArticleVerdict(article),
    }))
    .sort((a, b) => b.overlap - a.overlap);

  const relevant = scored.filter((item) => item.overlap >= 0.2);
  const candidate = relevant.length ? relevant : scored.slice(0, 1).filter((item) => item.overlap >= 0.1);

  if (!candidate.length) {
    return buildUnverifiedResult(
      articles,
      "No strong matching evidence was found in current GNews coverage."
    );
  }

  const supportCount = candidate.filter((item) => item.verdict === "support").length;
  const contradictCount = candidate.filter((item) => item.verdict === "contradict").length;
  const maxOverlap = candidate.reduce((max, item) => Math.max(max, item.overlap), 0);
  const sourceMatch = candidate.length >= 2 && maxOverlap >= 0.3 ? "strong" : "weak";
  const hasStrongEvidence = sourceMatch === "strong";

  let status = "Unverified";
  let confidence = sourceMatch === "strong" ? 70 : 62;
  let explanation = `Evidence is mixed across ${candidate.length} relevant GNews article(s).`;

  if (hasStrongEvidence && contradictCount > supportCount) {
    status = "Fake";
    confidence = sourceMatch === "strong" ? 88 : 76;
    explanation = `GNews evidence contradicts this claim across ${candidate.length} relevant article(s).`;
  } else if (hasStrongEvidence && supportCount > contradictCount) {
    status = sourceMatch === "strong" ? "True" : "Likely True";
    confidence = sourceMatch === "strong" ? 86 : 74;
    explanation = `GNews evidence supports this claim across ${candidate.length} relevant article(s).`;
  } else {
    status = "Unverified";
    confidence = 55;
    explanation =
      "Only limited or weakly matching GNews evidence is available; keeping this claim as Unverified.";
  }

  return {
    status,
    result: statusToLegacyResult(status),
    confidence,
    explanation,
    source_match: sourceMatch,
    sources: candidate.slice(0, 3).map((item) => ({
      title: item.article.title,
      url: item.article.url,
    })),
    source: "gnews",
  };
}

async function analyzeFakeNews(text) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    return null;
  }

  let articles = [];
  try {
    articles = await fetchRelevantNews(normalizedText);
  } catch (error) {
    console.warn(`GNews fetch failed, continuing with unverified fallback: ${error.message}`);
    articles = [];
  }

  debugLog(
    `[DEBUG][TEXT] GNews top articles: ${JSON.stringify(
      articles.slice(0, 3).map((article) => ({
        title: article.title,
        url: article.url,
      }))
    )}`
  );

  if (!articles.length) {
    return buildUnverifiedResult(
      [],
      "No relevant GNews articles were found for this claim."
    );
  }

  return scoreFromGNews(normalizedText, articles.slice(0, 3));
}

module.exports = {
  analyzeFakeNews,
};
