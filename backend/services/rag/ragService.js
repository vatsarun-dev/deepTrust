const { normalizeEvidence } = require("./evidenceService");
const { chunkEvidence } = require("./chunkingService");
const { rankEvidence } = require("./rankingService");
const { embedTexts } = require("./embeddingService");
const {
  cacheEvidenceVectors,
  searchCachedEvidence,
  searchCachedEvidenceLexical,
} = require("./vectorStoreService");

function evidenceKey(item) {
  return `${String(item?.url || "").trim().toLowerCase()}\n${String(item?.text || "").trim().toLowerCase()}`;
}

function mergeEvidence(...sets) {
  const seen = new Set();
  const domainCounts = new Map();
  const merged = [];
  for (const item of sets.flat()) {
    if (!item || !item.url || !item.text) continue;
    const key = evidenceKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    let domain = item.url;
    try {
      domain = new URL(item.url).hostname.toLowerCase();
    } catch {
      // The normalized evidence service has already rejected malformed URLs.
    }
    const count = domainCounts.get(domain) || 0;
    if (count >= 2) continue;
    domainCounts.set(domain, count + 1);
    merged.push(item);
  }
  return merged
    .sort((left, right) => (right.relevanceScore || 0) - (left.relevanceScore || 0))
    .slice(0, 8);
}

async function retrieveExistingEvidence(claim, limit = 6) {
  const embedding = await embedTexts([claim]);
  const queryEmbedding = Array.isArray(embedding.vectors) ? embedding.vectors[0] : null;
  let evidence = queryEmbedding ? await searchCachedEvidence(queryEmbedding, limit) : [];
  let method = evidence.length ? "atlas-vector" : "none";

  if (!evidence.length) {
    evidence = await searchCachedEvidenceLexical(claim, limit);
    method = evidence.length ? "cached-lexical" : method;
  }

  console.log(`[RAG] Retrieved ${evidence.length} cached candidate(s) via ${method}.`);
  return {
    evidence,
    queryEmbedding,
    rankingMethod: method === "none" ? embedding.method : `${embedding.method}+${method}`,
    embeddingError: embedding.error,
  };
}

async function buildEvidenceFromArticles(claim, articles = []) {
  const documents = normalizeEvidence(articles);
  const chunks = chunkEvidence(documents);
  const ranked = await rankEvidence(claim, chunks);
  await cacheEvidenceVectors(ranked.evidence);
  console.log(`[RAG] Ranked ${ranked.evidence.length} fresh evidence candidate(s).`);
  return {
    documents,
    evidence: ranked.evidence,
    queryEmbedding: ranked.queryEmbedding,
    rankingMethod: ranked.rankingMethod,
    embeddingError: ranked.embeddingError,
  };
}

async function buildRagContext(claim) {
  const existing = await retrieveExistingEvidence(claim);
  return {
    documents: [],
    evidence: existing.evidence,
    queryEmbedding: existing.queryEmbedding,
    retrievalStatus: { available: true, reason: existing.evidence.length ? "cached_evidence" : "no_cached_evidence" },
    rankingMethod: existing.rankingMethod,
    embeddingError: existing.embeddingError,
  };
}

module.exports = {
  buildRagContext,
  retrieveExistingEvidence,
  buildEvidenceFromArticles,
  mergeEvidence,
};
