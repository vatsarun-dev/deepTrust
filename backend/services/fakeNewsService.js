const { fetchRelevantNews } = require("./gnewsService");
const {
  analyzeWithAI,
  mapVerdictToStatus,
  mapVerdictToResult,
} = require("./aiService");

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
    description: String(article?.description || "").trim(),
    url: String(article?.url || "").trim(),
    source: String(article?.source || article?.source?.name || "").trim(),
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

  console.log(`\n${'='.repeat(70)}`);
  console.log(`[ANALYSIS] Processing claim: "${normalizedText}"`);
  console.log('='.repeat(70));

  // Step 1: Fetch from GNews
  let articles = [];
  try {
    console.log(`\n[GNEWS] Fetching articles...`);
    articles = await fetchRelevantNews(normalizedText);
    
    console.log(`\n[GNEWS] ✅ Found ${articles.length} articles\n`);
    
    if (articles.length > 0) {
      console.log('📰 ARTICLES FROM GNEWS:');
      console.log('─'.repeat(70));
      articles.forEach((article, idx) => {
        console.log(`\n${idx + 1}. TITLE: ${article.title}`);
        console.log(`   SOURCE: ${article.source}`);
        console.log(`   DESCRIPTION: ${article.description}`);
        console.log(`   URL: ${article.url}`);
      });
      console.log('\n' + '─'.repeat(70));
    } else {
      console.log(`\n⚠️  No articles found from GNews`);
    }
  } catch (error) {
    console.warn(`\n[GNEWS] ❌ Failed: ${error.message}`);
    articles = [];
  }

  // Step 2: Use AI to analyze
  let aiAnalysis = null;
  try {
    console.log(`\n[AI] Analyzing with AI...`);
    aiAnalysis = await analyzeWithAI(normalizedText, articles.slice(0, 3));
    console.log(`[AI] ✅ Verdict: ${aiAnalysis?.verdict}, Confidence: ${aiAnalysis?.confidence}%`);
  } catch (error) {
    console.error(`\n[AI] ❌ Failed: ${error.message}`);
  }

  // Step 3: Return result
  if (aiAnalysis) {
    let fakePercentage;
    if (aiAnalysis.verdict === "TRUE") {
      fakePercentage = 100 - aiAnalysis.confidence;
    } else if (aiAnalysis.verdict === "FALSE") {
      fakePercentage = aiAnalysis.confidence;
    } else if (aiAnalysis.verdict === "MISLEADING") {
      fakePercentage = Math.max(60, aiAnalysis.confidence);
    } else {
      fakePercentage = 50;
    }
    
    console.log(`\n[RESULT] Fake %: ${fakePercentage}% (${aiAnalysis.verdict})`);
    console.log('='.repeat(70) + '\n');
    
    return {
      status: mapVerdictToStatus(aiAnalysis.verdict, aiAnalysis.confidence),
      result: mapVerdictToResult(aiAnalysis.verdict),
      confidence: fakePercentage,
      explanation: aiAnalysis.reasoning,
      source_match: articles.length >= 2 ? "strong" : articles.length === 1 ? "weak" : "none",
      sources: mapSources(articles),
      source: articles.length > 0 ? "ai+gnews" : "ai",
      articles_found: articles.length,
      ai_analysis: {
        key_facts: aiAnalysis.keyFacts,
        red_flags: aiAnalysis.redFlags,
        sources_assessment: aiAnalysis.sourcesAssessment,
      },
    };
  }

  console.log(`\n[FALLBACK] AI unavailable`);
  console.log('='.repeat(70) + '\n');
  return buildUnverifiedResult([], "AI analysis unavailable.");
}

module.exports = {
  analyzeFakeNews,
};
