const { fetchRelevantNews, getGNewsAvailabilityStatus } = require("./gnewsService");
const { analyzeWithPuter } = require("./puterService");
const {
  buildImpactScore,
  buildTruthBreakdown,
  buildEmotionalRisk,
  buildMultiAiVerification,
  buildExplanationModes,
  pickExplanationMode,
} = require("./intelligenceService");

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

function buildUnverifiedResult(articles, explanation, confidence = 45, source = "gnews") {
  return {
    status: "Unverified",
    result: null,
    confidence,
    explanation,
    source_match: "none",
    sources: mapSources(articles),
    source,
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

function enrichTextResult(result, claimText, mode) {
  if (!result) {
    return null;
  }

  const impact = buildImpactScore(claimText);
  const truthBreakdown = buildTruthBreakdown({
    claim: claimText,
    status: result.status,
    explanation: result.explanation,
    sources: result.sources,
  });
  const emotional = buildEmotionalRisk(`${claimText} ${result.explanation}`);
  const explanationModes = buildExplanationModes({
    claim: claimText,
    explanation: result.explanation,
    truthBreakdown,
    impact,
    emotionalRisk: emotional,
  });
  const multiLayerVerification = buildMultiAiVerification({
    textResult: result,
    sourceMatch: result.source_match,
  });

  return {
    ...result,
    explanation: pickExplanationMode(explanationModes, mode),
    explanationModes,
    truthBreakdown,
    impact,
    emotionalRisk: emotional.emotionalRisk,
    emotionalSignals: emotional.categories,
    multiLayerVerification,
  };
}

async function analyzeFakeNews(text, options = {}) {
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

  const gnewsAvailability = getGNewsAvailabilityStatus();
  debugLog(`[DEBUG][GNEWS] Availability: ${JSON.stringify(gnewsAvailability)}`);

  debugLog(
    `[DEBUG][TEXT] GNews top articles: ${JSON.stringify(
      articles.slice(0, 3).map((article) => ({
        title: article.title,
        url: article.url,
      }))
    )}`
  );

  if (!articles.length) {
    if (gnewsAvailability.reason === "quota_exhausted" && gnewsAvailability.quotaBlocked) {
      const puterFallback = await analyzeWithPuter(normalizedText, []);
      if (puterFallback) {
        return enrichTextResult({
          ...puterFallback,
          explanation: `${puterFallback.explanation} (GNews quota reached until ${gnewsAvailability.blockedUntil || "next reset at 00:00 UTC"}.)`,
        }, normalizedText, options.mode);
      }

      const resetAt = gnewsAvailability.blockedUntil || "next reset at 00:00 UTC";
      return enrichTextResult(buildUnverifiedResult(
        [],
        `GNews daily request limit reached. Verification is temporarily unavailable until ${resetAt}.`,
        0,
        "gnews-quota"
      ), normalizedText, options.mode);
    }

    if (gnewsAvailability.reason === "missing_api_key") {
      const puterFallback = await analyzeWithPuter(normalizedText, []);
      if (puterFallback) {
        return enrichTextResult({
          ...puterFallback,
          explanation: `${puterFallback.explanation} (GNews API key is missing, so this result used Puter.js only.)`,
        }, normalizedText, options.mode);
      }

      return enrichTextResult(buildUnverifiedResult(
        [],
        "GNews API key is missing in backend configuration, so claim verification cannot run.",
        0,
        "gnews-config"
      ), normalizedText, options.mode);
    }

    const puterFallback = await analyzeWithPuter(normalizedText, []);
    if (puterFallback) {
      return enrichTextResult(puterFallback, normalizedText, options.mode);
    }

    const unavailabilityReason = gnewsAvailability.reason
      ? ` (GNews status: ${gnewsAvailability.reason})`
      : "";
    return enrichTextResult(buildUnverifiedResult(
      [],
      `No relevant GNews articles were found for this claim${unavailabilityReason}.`
    ), normalizedText, options.mode);
  }

  const gnewsScored = scoreFromGNews(normalizedText, articles.slice(0, 3));
  if (gnewsScored.status !== "Unverified") {
    return enrichTextResult(gnewsScored, normalizedText, options.mode);
  }

  const puterWithEvidence = await analyzeWithPuter(normalizedText, articles.slice(0, 3));
  if (!puterWithEvidence) {
    return enrichTextResult(gnewsScored, normalizedText, options.mode);
  }

  return enrichTextResult({
    ...puterWithEvidence,
    sources: gnewsScored.sources?.length ? gnewsScored.sources : puterWithEvidence.sources,
    source_match: gnewsScored.source_match || puterWithEvidence.source_match,
  }, normalizedText, options.mode);
}

module.exports = {
  analyzeFakeNews,
};
