const { embedTexts } = require("./embeddingService");

const QUALITY_WEIGHT = { high: 1, medium: 0.72, low: 0.45 };

function tokenize(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}

function lexicalSimilarity(a, b) {
  const left = tokenize(a);
  const right = tokenize(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / Math.sqrt(left.size * right.size);
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let aMagnitude = 0;
  let bMagnitude = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    aMagnitude += a[index] ** 2;
    bMagnitude += b[index] ** 2;
  }
  if (!aMagnitude || !bMagnitude) return 0;
  return dot / Math.sqrt(aMagnitude * bMagnitude);
}

function diversify(items, limit = 8) {
  const domainCounts = new Map();
  const results = [];
  for (const item of items) {
    const domain = item.url;
    const count = domainCounts.get(domain) || 0;
    if (count >= 2) continue;
    domainCounts.set(domain, count + 1);
    results.push(item);
    if (results.length >= limit) break;
  }
  return results;
}

async function rankEvidence(claim, chunks = []) {
  if (!chunks.length) return { evidence: [], rankingMethod: "none", embeddingError: null, queryEmbedding: null };

  const embeddingResult = await embedTexts([claim, ...chunks.map((chunk) => chunk.text)]);
  const semantic = Array.isArray(embeddingResult.vectors);
  const queryVector = semantic ? embeddingResult.vectors[0] : null;

  const ranked = chunks
    .map((chunk, index) => {
      const rawSimilarity = semantic
        ? cosineSimilarity(queryVector, embeddingResult.vectors[index + 1])
        : lexicalSimilarity(claim, chunk.text);
      const qualityWeight = QUALITY_WEIGHT[chunk.sourceQuality] || QUALITY_WEIGHT.low;
      return {
        ...chunk,
        embedding: semantic ? embeddingResult.vectors[index + 1] : undefined,
        relevanceScore: Math.max(0, Math.min(1, rawSimilarity * qualityWeight)),
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    evidence: diversify(ranked),
    rankingMethod: embeddingResult.method,
    embeddingError: embeddingResult.error,
    queryEmbedding: queryVector,
  };
}

module.exports = {
  rankEvidence,
  cosineSimilarity,
  lexicalSimilarity,
};
