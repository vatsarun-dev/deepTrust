const crypto = require("crypto");
const { isDatabaseReady } = require("../../config/db");
const EvidenceCache = require("../../models/EvidenceCache");

function contentHash(chunk) {
  return crypto.createHash("sha256").update(`${chunk.url}\n${chunk.text}`).digest("hex");
}

function tokenize(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}

function lexicalSimilarity(leftText, rightText) {
  const left = tokenize(leftText);
  const right = tokenize(rightText);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const word of left) if (right.has(word)) overlap += 1;
  return overlap / Math.sqrt(left.size * right.size);
}

function mapCachedEvidence(items, prefix = "C") {
  return items.map((item, position) => {
    const value = typeof item.toObject === "function" ? item.toObject() : item;
    return {
      ...value,
      id: `${prefix}${position + 1}`,
      chunkIndex: position,
      retrievedAt: value.retrievedAt ? new Date(value.retrievedAt).toISOString() : "",
    };
  });
}

async function cacheEvidenceVectors(chunks = []) {
  if (!isDatabaseReady()) return { saved: 0, reason: "database_unavailable" };
  const vectorized = chunks.filter((chunk) => Array.isArray(chunk.embedding) && chunk.embedding.length);
  if (!vectorized.length) return { saved: 0, reason: "no_embeddings" };

  try {
    await EvidenceCache.bulkWrite(
      vectorized.map((chunk) => ({
        updateOne: {
          filter: { contentHash: contentHash(chunk) },
          update: {
            $set: {
              documentId: chunk.documentId,
              title: chunk.title,
              sourceName: chunk.sourceName,
              url: chunk.url,
              publishedAt: chunk.publishedAt,
              retrievedAt: chunk.retrievedAt ? new Date(chunk.retrievedAt) : new Date(),
              sourceQuality: chunk.sourceQuality,
              text: chunk.text,
              embedding: chunk.embedding,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    console.log(`[DB] Evidence cache saved: ${vectorized.length} vector chunk(s).`);
    return { saved: vectorized.length, reason: null };
  } catch (error) {
    console.warn(`[DB] Evidence cache write failed: ${error.message}`);
    return { saved: 0, reason: "write_failed" };
  }
}

async function searchCachedEvidence(queryEmbedding, limit = 4) {
  const index = String(process.env.MONGODB_VECTOR_INDEX || "").trim();
  if (!isDatabaseReady() || !index || !Array.isArray(queryEmbedding) || !queryEmbedding.length) return [];

  try {
    const matches = await EvidenceCache.aggregate([
      {
        $vectorSearch: {
          index,
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: Math.max(limit * 15, 50),
          limit,
        },
      },
      {
        $project: {
          _id: 0,
          documentId: 1,
          title: 1,
          sourceName: 1,
          url: 1,
          publishedAt: 1,
          sourceQuality: 1,
          text: 1,
          relevanceScore: { $meta: "vectorSearchScore" },
        },
      },
    ]);
    return mapCachedEvidence(matches);
  } catch (error) {
    console.warn(`[RAG] Atlas vector search unavailable: ${error.message}`);
    return [];
  }
}

async function searchCachedEvidenceLexical(query, limit = 6) {
  if (!isDatabaseReady() || !String(query || "").trim()) return [];

  try {
    // This is a bounded fallback when Atlas Vector Search has not been
    // configured. It reuses persisted evidence without any external provider.
    const candidates = await EvidenceCache.find(
      {},
      { _id: 0, documentId: 1, title: 1, sourceName: 1, url: 1, publishedAt: 1, retrievedAt: 1, sourceQuality: 1, text: 1 },
    )
      .sort({ retrievedAt: -1, updatedAt: -1 })
      .limit(120)
      .lean();

    const ranked = candidates
      .map((item) => ({
        ...item,
        relevanceScore: lexicalSimilarity(query, `${item.title || ""} ${item.text || ""}`),
      }))
      .filter((item) => item.relevanceScore > 0)
      .sort((left, right) => right.relevanceScore - left.relevanceScore)
      .slice(0, limit);
    return mapCachedEvidence(ranked, "L");
  } catch (error) {
    console.warn(`[RAG] Cached-evidence fallback unavailable: ${error.message}`);
    return [];
  }
}

module.exports = {
  cacheEvidenceVectors,
  searchCachedEvidence,
  searchCachedEvidenceLexical,
  lexicalSimilarity,
};
