const { createEmbeddings } = require("../ai/aiService");

async function embedTexts(texts) {
  try {
    return {
      vectors: await createEmbeddings(texts),
      method: "gemini-embed",
      error: null,
    };
  } catch (error) {
    return {
      vectors: null,
      method: "lexical-fallback",
      error: error?.code || "embedding_unavailable",
    };
  }
}

module.exports = {
  embedTexts,
};
