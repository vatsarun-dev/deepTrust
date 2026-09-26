const HIGH_QUALITY_HOSTS = new Set([
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "thehindu.com",
  "indiatoday.in",
  "theguardian.com",
  "nytimes.com",
  "washingtonpost.com",
  "who.int",
  "un.org",
]);

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hostname(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function sourceQuality(url) {
  const host = hostname(url);
  if (!host) return "low";
  if (host.endsWith(".gov") || host.endsWith(".gov.in") || host.endsWith(".edu") || HIGH_QUALITY_HOSTS.has(host)) {
    return "high";
  }
  if (host.includes("facebook.") || host.includes("instagram.") || host.includes("x.com") || host.includes("twitter.")) {
    return "low";
  }
  return "medium";
}

function normalizeEvidence(articles = []) {
  const seen = new Set();
  return articles
    .map((article, index) => {
      const url = clean(article?.url);
      if (!url || seen.has(url)) return null;
      seen.add(url);
      const title = clean(article?.title);
      const description = clean(article?.description);
      const content = clean(article?.content);
      return {
        id: `D${index + 1}`,
        title: title || "Untitled source",
        description,
        content,
        sourceName: clean(article?.source) || hostname(url) || "Unknown source",
        url,
        publishedAt: clean(article?.publishedAt),
        retrievedAt: clean(article?.retrievedAt) || new Date().toISOString(),
        author: clean(article?.author),
        sourceQuality: sourceQuality(url),
      };
    })
    .filter(Boolean);
}

module.exports = {
  normalizeEvidence,
  sourceQuality,
  hostname,
};
