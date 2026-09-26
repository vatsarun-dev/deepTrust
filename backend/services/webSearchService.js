const { hostname, sourceQuality } = require("./rag/evidenceService");

const SEARCH_TIMEOUT_MS = 12000;
const CONTENT_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CONTENT_FETCHES = 2;

const resultCache = new Map();
const inFlightSearches = new Map();

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const url = new URL(raw, "https://duckduckgo.com");
    const redirectTarget = url.searchParams.get("uddg");
    if (redirectTarget) return decodeURIComponent(redirectTarget);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function cacheKey(query, fetchContent) {
  return `${clean(query).toLowerCase()}::${fetchContent ? "content" : "snippet"}`;
}

function copyResults(results) {
  return results.map((result) => ({ ...result }));
}

function readCache(key) {
  const cached = resultCache.get(key);
  if (!cached || cached.expiresAt <= Date.now()) {
    resultCache.delete(key);
    return null;
  }
  return copyResults(cached.results);
}

function writeCache(key, results) {
  resultCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, results: copyResults(results) });
}

function parseSearchResults(html, limit) {
  const anchors = [...String(html || "").matchAll(/result__a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const results = [];
  const seenUrls = new Set();

  for (const match of anchors) {
    const url = normalizeUrl(match[1]);
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    const title = decodeHtml(match[2]) || hostname(url) || "Untitled result";
    const section = String(html).slice(match.index, match.index + 1800);
    const snippetMatch = section.match(/result__snippet[^>]*>([\s\S]*?)<\/(?:a|div|span)>/i);
    const snippet = decodeHtml(snippetMatch?.[1] || "");
    const dateMatch = section.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}\s+[A-Z][a-z]{2,8}\s+20\d{2})\b/);
    results.push({
      title,
      url,
      source: hostname(url) || "Unknown source",
      domain: hostname(url) || "",
      publishedAt: dateMatch?.[1] || "",
      retrievedAt: new Date().toISOString(),
      snippet,
      text: snippet,
      sourceQuality: sourceQuality(url),
    });
    if (results.length >= limit) break;
  }
  return results;
}

function isSafePublicHttpUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol)) return false;
    if (host === "localhost" || host.endsWith(".local") || host === "::1") return false;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

async function extractSourceContent(url) {
  if (!isSafePublicHttpUrl(url)) return "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONTENT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "DeepTrust/1.0 (+web research)" },
      signal: controller.signal,
    });
    if (!response.ok || response.status >= 300) return "";
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return "";
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > 1_000_000) return "";
    const body = await response.text();
    return decodeHtml(body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")).slice(0, 3500);
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

async function enrichResults(results, fetchContent) {
  if (!fetchContent) return results;
  const enriched = await Promise.all(
    results.map(async (result, index) => {
      if (index >= MAX_CONTENT_FETCHES) return result;
      const pageText = await extractSourceContent(result.url);
      return { ...result, text: pageText || result.snippet };
    }),
  );
  return enriched;
}

async function performSearch(query, limit, fetchContent) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      method: "GET",
      headers: { "User-Agent": "DeepTrust/1.0 (+web research)" },
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`[WEB] Search unavailable (HTTP ${response.status}).`);
      return { results: [], status: { available: false, reason: `http_${response.status}` } };
    }
    const results = await enrichResults(parseSearchResults(await response.text(), limit), fetchContent);
    console.log(`[WEB] Search returned ${results.length} result(s).`);
    return { results, status: { available: true, reason: results.length ? null : "no_results" } };
  } catch (error) {
    console.warn(`[WEB] Search unavailable (${error?.name === "AbortError" ? "timeout" : "network_error"}).`);
    return { results: [], status: { available: false, reason: error?.name === "AbortError" ? "timeout" : "network_error" } };
  } finally {
    clearTimeout(timeout);
  }
}

async function webSearchTool(query, options = {}) {
  const normalizedQuery = clean(query);
  const limit = Math.max(1, Math.min(Number(options.limit) || 5, 8));
  const fetchContent = Boolean(options.fetchContent);
  if (!normalizedQuery) return { results: [], status: { available: true, reason: "empty_query" } };

  const key = cacheKey(normalizedQuery, fetchContent);
  const cached = readCache(key);
  if (cached) {
    console.log(`[WEB] Cache hit: ${cached.length} result(s).`);
    return { results: cached.slice(0, limit), status: { available: true, reason: "cache_hit" } };
  }

  if (!inFlightSearches.has(key)) {
    const pending = performSearch(normalizedQuery, limit, fetchContent)
      .then((search) => {
        if (search.results.length) writeCache(key, search.results);
        return search;
      })
      .finally(() => inFlightSearches.delete(key));
    inFlightSearches.set(key, pending);
  }

  const search = await inFlightSearches.get(key);
  return {
    results: copyResults(search.results).slice(0, limit),
    status: search.status,
  };
}

function _resetWebSearchState() {
  resultCache.clear();
  inFlightSearches.clear();
}

module.exports = {
  webSearchTool,
  extractSourceContent,
  _resetWebSearchState,
};
