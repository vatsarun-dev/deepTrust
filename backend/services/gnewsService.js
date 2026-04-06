const GNEWS_API_URL = "https://gnews.io/api/v4/search";
const MAX_ARTICLES = 3;
const REQUEST_TIMEOUT_MS = 10000;
let lastGnewsWarningAt = 0;

const gnewsAvailability = {
  available: true,
  reason: null,
  status: null,
  blockedUntil: null,
  message: null,
};

function isDebugEnabled() {
  return process.env.DEBUG_ANALYSIS === "true";
}

function debugLog(message) {
  if (isDebugEnabled()) {
    console.log(message);
  }
}

function nextUtcMidnightTimestamp() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
  return next;
}

function formatUtcTimestamp(timestamp) {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString().replace(".000Z", "Z");
}

function setAvailabilityState(nextState) {
  gnewsAvailability.available = nextState.available;
  gnewsAvailability.reason = nextState.reason || null;
  gnewsAvailability.status = nextState.status || null;
  gnewsAvailability.blockedUntil = nextState.blockedUntil || null;
  gnewsAvailability.message = nextState.message || null;
}

function isQuotaBlockedNow() {
  return (
    gnewsAvailability.reason === "quota_exhausted" &&
    Number.isFinite(gnewsAvailability.blockedUntil) &&
    Date.now() < gnewsAvailability.blockedUntil
  );
}

function clearExpiredQuotaState() {
  if (
    gnewsAvailability.reason === "quota_exhausted" &&
    Number.isFinite(gnewsAvailability.blockedUntil) &&
    Date.now() >= gnewsAvailability.blockedUntil
  ) {
    setAvailabilityState({
      available: true,
      reason: null,
      status: null,
      blockedUntil: null,
      message: null,
    });
  }
}

function isQuotaLimitError(status, errorText) {
  if (status !== 403) {
    return false;
  }

  const details = String(errorText || "").toLowerCase();
  return (
    details.includes("request limit") ||
    details.includes("next reset") ||
    details.includes("change-plan")
  );
}

function getGNewsAvailabilityStatus() {
  clearExpiredQuotaState();
  const blockedUntilIso = formatUtcTimestamp(gnewsAvailability.blockedUntil);
  return {
    available: gnewsAvailability.available,
    reason: gnewsAvailability.reason,
    status: gnewsAvailability.status,
    blockedUntil: blockedUntilIso,
    quotaBlocked: isQuotaBlockedNow(),
    message: gnewsAvailability.message,
  };
}

function normalizeQuery(query) {
  return String(query || "").trim();
}

function sanitizeForGNewsQuery(text) {
  return String(text || "")
    .replace(/["'`\u201C\u201D\u2018\u2019\u00AB\u00BB]/g, " ")
    .replace(/[(){}\[\]]/g, " ")
    .replace(/[+\-!|&:^~*?\\/]/g, " ")
    .replace(/[.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(text) {
  return Array.from(
    new Set(
      String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 4)
        .filter(
          (word) =>
            ![
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
            ].includes(word)
        )
    )
  );
}

function buildSearchQueries(rawQuery) {
  const normalized = normalizeQuery(rawQuery);
  const compact = sanitizeForGNewsQuery(normalized);
  const keywords = extractKeywords(compact);

  const phrase = compact.split(" ").slice(0, 12).join(" ");
  const keywordQuery = keywords.slice(0, 6).join(" ");
  const strictKeywordQuery = keywords.slice(0, 4).join(" ");

  const candidates = [compact, phrase, keywordQuery, strictKeywordQuery].filter(Boolean);
  return Array.from(new Set(candidates));
}

function mapArticles(data) {
  const articles = Array.isArray(data?.articles) ? data.articles : [];
  return articles.slice(0, MAX_ARTICLES).map((article) => ({
    title: String(article?.title || "").trim(),
    description: String(article?.description || "").trim(),
    source: String(article?.source?.name || "").trim(),
    url: String(article?.url || "").trim(),
  }));
}

async function requestGNews(searchQuery, apiKey, controller) {
  const searchParams = new URLSearchParams({
    q: searchQuery,
    apikey: apiKey,
    max: String(MAX_ARTICLES),
    lang: "en",
    sortby: "relevance",
  });

  return fetch(`${GNEWS_API_URL}?${searchParams.toString()}`, {
    method: "GET",
    signal: controller.signal,
  });
}

async function fetchRelevantNews(query) {
  clearExpiredQuotaState();

  const normalizedQuery = normalizeQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) {
    setAvailabilityState({
      available: false,
      reason: "missing_api_key",
      status: null,
      blockedUntil: null,
      message: "GNEWS_API_KEY is not configured.",
    });
    return [];
  }

  if (isQuotaBlockedNow()) {
    debugLog(
      `[DEBUG][GNEWS] Quota cache active until ${formatUtcTimestamp(
        gnewsAvailability.blockedUntil
      )}. Skipping outbound request.`
    );
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const searchQueries = buildSearchQueries(normalizedQuery);
    const merged = [];
    const seenUrls = new Set();

    debugLog(`[DEBUG][GNEWS] Starting fetch for claim: "${normalizedQuery}"`);
    debugLog(`[DEBUG][GNEWS] Candidate queries: ${JSON.stringify(searchQueries)}`);

    for (const searchQuery of searchQueries) {
      if (!searchQuery) {
        continue;
      }

      const response = await requestGNews(searchQuery, apiKey, controller);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");

        if (response.status === 400) {
          continue;
        }

        if (isQuotaLimitError(response.status, errorText)) {
          const blockedUntil = nextUtcMidnightTimestamp();
          setAvailabilityState({
            available: false,
            reason: "quota_exhausted",
            status: response.status,
            blockedUntil,
            message:
              "GNews daily request limit reached. Retry after the next UTC reset or upgrade the plan.",
          });
        } else {
          setAvailabilityState({
            available: false,
            reason: `http_${response.status}`,
            status: response.status,
            blockedUntil: null,
            message: `GNews returned HTTP ${response.status}.`,
          });
        }

        const now = Date.now();
        if (now - lastGnewsWarningAt > 60 * 1000) {
          lastGnewsWarningAt = now;
          console.warn(
            `GNews unavailable (status ${response.status}). Continuing without external news.${errorText ? ` Details: ${errorText}` : ""}`
          );
        }
        return [];
      }

      const data = await response.json();
      setAvailabilityState({
        available: true,
        reason: null,
        status: response.status,
        blockedUntil: null,
        message: null,
      });

      const rawCount = Array.isArray(data?.articles) ? data.articles.length : 0;
      debugLog(`[DEBUG][GNEWS] Query "${searchQuery}" returned ${rawCount} raw article(s).`);

      const mapped = mapArticles(data);
      for (const article of mapped) {
        if (!article.url || seenUrls.has(article.url)) {
          continue;
        }

        seenUrls.add(article.url);
        merged.push(article);

        if (merged.length >= MAX_ARTICLES) {
          debugLog(`[DEBUG][GNEWS] Collected ${merged.length} unique article(s).`);
          return merged;
        }
      }
    }

    debugLog(`[DEBUG][GNEWS] Final unique article count: ${merged.length}`);
    if (merged.length < MAX_ARTICLES) {
      console.warn(
        `[DEBUG][GNEWS] Fewer than ${MAX_ARTICLES} articles found. Falling back to limited evidence.`
      );
    }

    return merged;
  } catch (error) {
    setAvailabilityState({
      available: false,
      reason: error?.name === "AbortError" ? "timeout" : "request_failed",
      status: null,
      blockedUntil: null,
      message: error.message,
    });

    const now = Date.now();
    if (now - lastGnewsWarningAt > 60 * 1000) {
      lastGnewsWarningAt = now;
      console.warn(`GNews request failed. Continuing without external news: ${error.message}`);
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  fetchRelevantNews,
  getGNewsAvailabilityStatus,
};
