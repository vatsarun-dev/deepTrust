const { init, getAuthToken } = require("@heyputer/puter.js/src/init.cjs");

let puterClientInstance = null;
let puterInitPromise = null;

function mapStatusToLegacyResult(status) {
  if (status === "True" || status === "Likely True") return "Real";
  if (status === "Unverified") return null;
  return "Fake";
}

function normalizeStatus(rawStatus) {
  const status = String(rawStatus || "").trim().toLowerCase();
  if (status === "true") return "True";
  if (status === "likely true") return "Likely True";
  if (status === "misleading") return "Misleading";
  if (status === "fake" || status === "false" || status === "likely false") return "Fake";
  if (status === "unverified") return "Unverified";
  return "Unverified";
}

function clampConfidence(value, fallback = 50) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function extractPuterText(raw) {
  if (typeof raw === "string") return raw;
  if (typeof raw?.text === "string") return raw.text;
  if (typeof raw?.message?.content === "string") return raw.message.content;
  if (Array.isArray(raw?.message?.content)) {
    return raw.message.content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }
  return String(raw || "");
}

function parsePuterJson(rawContent) {
  const normalized = String(rawContent || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  const candidate =
    start !== -1 && end !== -1 && end > start
      ? normalized.slice(start, end + 1)
      : normalized;

  return JSON.parse(candidate);
}

function mapSources(articles) {
  return articles.slice(0, 3).map((article) => ({
    title: String(article?.title || "").trim(),
    url: String(article?.url || "").trim(),
  }));
}

function buildPuterPrompt(claim, articles) {
  const articleBlock = articles.length
    ? articles
        .slice(0, 3)
        .map(
          (article, index) =>
            `${index + 1}. ${(article.title || "Untitled").trim()} + ${(article.description || "No description").trim()}`
        )
        .join("\n")
    : "No relevant news articles were found.";

  return [
    "User Claim:",
    `"${claim}"`,
    "",
    "Relevant News Articles:",
    "",
    articleBlock,
    "",
    "Instructions:",
    "* If relevant articles are present, prioritize them as evidence",
    "* If no relevant articles exist, use reliable general world knowledge for common-sense and older claims",
    "* If uncertain, return Unverified",
    "* Keep explanation concise and factual",
    "",
    "Return STRICT JSON:",
    "{",
    '"status": "True / Likely True / Misleading / Fake / Unverified",',
    '"confidence": number (0-100),',
    '"explanation": "clear reasoning in 1-2 sentences"',
    "}",
  ].join("\n");
}

async function getPuterClient() {
  if (puterClientInstance) {
    return puterClientInstance;
  }

  if (puterInitPromise) {
    return puterInitPromise;
  }

  puterInitPromise = (async () => {
    const token = String(process.env.PUTER_AUTH_TOKEN || "").trim();
    if (token) {
      puterClientInstance = init(token);
      return puterClientInstance;
    }

    const allowInteractiveAuth = String(process.env.PUTER_ENABLE_INTERACTIVE_AUTH || "false")
      .trim()
      .toLowerCase() === "true";

    if (!allowInteractiveAuth) {
      return null;
    }

    try {
      // Optional fallback for local development only (opens browser auth flow).
      const authToken = await getAuthToken();
      if (!authToken) {
        return null;
      }
      puterClientInstance = init(authToken);
      return puterClientInstance;
    } catch (error) {
      console.warn(`Puter interactive auth failed: ${error.message}`);
      return null;
    }
  })();

  const client = await puterInitPromise;
  puterInitPromise = null;
  return client;
}

async function analyzeWithPuter(claim, articles = []) {
  const puterClient = await getPuterClient();
  if (!puterClient?.ai?.chat) {
    return null;
  }

  try {
    const model = process.env.PUTER_MODEL || "gpt-5.4-nano";
    const prompt = buildPuterPrompt(claim, articles);
    const raw = await puterClient.ai.chat(prompt, { model });
    const rawText = extractPuterText(raw);
    const parsed = parsePuterJson(rawText);

    const status = normalizeStatus(parsed?.status);
    const hasGnewsEvidence = Array.isArray(articles) && articles.length > 0;

    return {
      status,
      result: mapStatusToLegacyResult(status),
      confidence: clampConfidence(parsed?.confidence, hasGnewsEvidence ? 62 : 58),
      explanation:
        String(parsed?.explanation || "").trim() ||
        (hasGnewsEvidence
          ? "AI reasoning used the available evidence and produced a cautious conclusion."
          : "AI reasoning used general knowledge due to limited recent news evidence."),
      source_match: hasGnewsEvidence ? "weak" : "none",
      sources: mapSources(articles),
      source: hasGnewsEvidence ? "puter-js+gnews" : "puter-js",
    };
  } catch (error) {
    console.warn(`Puter fallback failed: ${error.message}`);
    return null;
  }
}

module.exports = {
  analyzeWithPuter,
};
