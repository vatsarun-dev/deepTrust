const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { statusFromScore, analyzeImage } = require("../services/imageDetectionService");
const { runGeneralAgent } = require("../services/agent/generalAgentService");
const { evaluateEvidenceSufficiency } = require("../services/agent/evidenceSufficiencyService");
const { webSearchTool, _resetWebSearchState } = require("../services/webSearchService");
const { getCanonicalDatabaseName } = require("../config/db");
const { consistencyFor } = require("../controllers/analysisController");
const { validateUploadedMedia, uploadToImageKit } = require("../services/mediaStorageService");
const { analyzeVideo } = require("../services/videoAnalysisService");

function fakeEvidence(overrides = {}) {
  return {
    id: "D1-C1",
    documentId: "D1",
    title: "Official statement",
    sourceName: "Example Government",
    url: "https://example.gov/statement",
    publishedAt: "2026-01-01T00:00:00Z",
    retrievedAt: "2026-01-02T00:00:00Z",
    sourceQuality: "high",
    relevanceScore: 0.95,
    text: "The statement is available.",
    ...overrides,
  };
}

function availableGemini() {
  return { available: true, configured: true };
}

function directRoute(intent = "general_knowledge") {
  return {
    intent,
    strategy: "direct_answer",
    requiresCurrentInformation: false,
    requiresWebSearch: false,
    requiresRag: false,
    requiresMediaAnalysis: false,
    atomicClaims: [],
    searchQueries: [],
  };
}

function directAnswer(answer) {
  return {
    answer,
    summary: answer,
    simpleExplanation: answer,
    technicalExplanation: answer,
    uncertainties: [],
    recommendedNextSteps: [],
  };
}

test("synthetic media does not change a supported claim into false", () => {
  const result = consistencyFor(
    "A supported claim",
    { verdict: "TRUE" },
    { syntheticMedia: { status: "AI_GENERATED" } },
  );
  assert.equal(result.status, "UNCERTAIN");
  assert.equal(result.relationship, "MEDIA_SHOULD_NOT_BE_USED_AS_EVIDENCE");
});

test("media authenticity cannot establish an otherwise verified claim's context", () => {
  const result = consistencyFor(
    "A supported claim",
    { verdict: "TRUE" },
    { syntheticMedia: { status: "LIKELY_AUTHENTIC" } },
  );
  assert.equal(result.status, "UNCERTAIN");
  assert.equal(result.relationship, "AUTHENTICITY_DOES_NOT_ESTABLISH_CONTEXT");
});

test("image detector preserves provider threshold states", () => {
  assert.equal(statusFromScore(0.9), "AI_GENERATED");
  assert.equal(statusFromScore(0.7), "LIKELY_AI_GENERATED");
  assert.equal(statusFromScore(0.45), "POSSIBLY_AI_GENERATED");
  assert.equal(statusFromScore(0.1), "LIKELY_AUTHENTIC");
});

test("missing media-forensics configuration reports unavailable rather than a verdict", async () => {
  const result = await analyzeImage({
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    originalname: "sample.jpg",
    mimetype: "image/jpeg",
  });
  assert.equal(result.syntheticMedia.status, "ANALYSIS_UNAVAILABLE");
});

test("simple science is routed directly without RAG or web tools", async () => {
  let ragCalls = 0;
  let webCalls = 0;
  let completionCalls = 0;
  const result = await runGeneralAgent("Is the Sun hot?", {}, {
    getGeminiStatus: availableGemini,
    retrieveExistingEvidence: async () => {
      ragCalls += 1;
      return { evidence: [] };
    },
    webSearchTool: async () => {
      webCalls += 1;
      return { results: [] };
    },
    createJsonCompletion: async ({ user }) => {
      completionCalls += 1;
      return user.includes("REQUEST CONTEXT")
        ? {
          ...directRoute(),
          directAnswer: "Yes. The Sun is extremely hot; its visible surface is about 5,500°C.",
          directExplanation: "The Sun produces energy through nuclear fusion in its core, which heats its surface and surrounding atmosphere.",
        }
        : directAnswer("Yes. The Sun is extremely hot; its visible surface is about 5,500°C.");
    },
  });
  assert.equal(result.mode, "direct");
  assert.match(result.answer, /Sun is extremely hot/);
  assert.equal(result.verdict, "NOT_APPLICABLE");
  assert.equal(ragCalls, 0);
  assert.equal(webCalls, 0);
  assert.equal(completionCalls, 1);
});

test("programming explanations are answered directly without search", async () => {
  let toolCalls = 0;
  const result = await runGeneralAgent("What is binary search?", {}, {
    getGeminiStatus: availableGemini,
    retrieveExistingEvidence: async () => { toolCalls += 1; return { evidence: [] }; },
    webSearchTool: async () => { toolCalls += 1; return { results: [] }; },
    createJsonCompletion: async ({ user }) => user.includes("REQUEST CONTEXT")
      ? {
        ...directRoute("programming"),
        directAnswer: "Binary search repeatedly halves a sorted search range until it finds the target or the range is empty.",
        directExplanation: "Each comparison eliminates half of the remaining candidates, so it is efficient for sorted data.",
      }
      : directAnswer("Binary search repeatedly halves a sorted search range until it finds the target or the range is empty."),
  });
  assert.equal(result.mode, "direct");
  assert.match(result.answer, /halves a sorted search range/);
  assert.equal(toolCalls, 0);
});

test("current-information requests use web research and pass sources to Gemini", async () => {
  let finalPrompt = "";
  const result = await runGeneralAgent("What is the latest Node.js version?", {}, {
    getGeminiStatus: availableGemini,
    webSearchTool: async () => ({
      results: [{
        title: "Node.js releases",
        url: "https://nodejs.org/en/about/previous-releases",
        source: "nodejs.org",
        domain: "nodejs.org",
        publishedAt: "2026-01-01",
        retrievedAt: "2026-01-02T00:00:00Z",
        snippet: "Official Node.js release information.",
        text: "Official Node.js release information.",
      }],
      status: { available: true, reason: null },
    }),
    buildEvidenceFromArticles: async () => ({ evidence: [fakeEvidence({ url: "https://nodejs.org/en/about/previous-releases", sourceName: "nodejs.org", text: "Official Node.js release information." })], rankingMethod: "gemini-embed" }),
    createJsonCompletion: async ({ user }) => {
      if (user.includes("REQUEST CONTEXT")) {
        return { intent: "current_information", strategy: "web_research", requiresCurrentInformation: true, requiresWebSearch: true, requiresRag: false, requiresMediaAnalysis: false, atomicClaims: ["What is the latest Node.js version?"], searchQueries: ["site:nodejs.org latest Node.js release"] };
      }
      if (user.includes("TOOL OBSERVATION")) return { nextTool: "none", evidenceAssessment: "sufficient" };
      finalPrompt = user;
      return { answer: "The current Node.js release is listed on the official Node.js releases page.", summary: "Official Node.js release information was retrieved.", verdict: "UNVERIFIED", supportingEvidenceIds: ["E1"], contradictingEvidenceIds: [], claimBreakdown: [], uncertainties: [], simpleExplanation: "See the official Node.js source.", technicalExplanation: "The response is grounded in E1.", recommendedNextSteps: [] };
    },
  });
  assert.equal(result.mode, "researched");
  assert.equal(result.webUsed, true);
  assert.equal(result.toolsUsed[0].name, "webSearch");
  assert.equal(result.sources[0].url, "https://nodejs.org/en/about/previous-releases");
  assert.match(finalPrompt, /nodejs\.org/);
});

test("research can combine stored RAG evidence and web evidence", async () => {
  let ragCalls = 0;
  let webCalls = 0;
  const result = await runGeneralAgent("Research recent approaches to multimodal RAG.", {}, {
    getGeminiStatus: availableGemini,
    retrieveExistingEvidence: async () => {
      ragCalls += 1;
      return { evidence: [fakeEvidence({ title: "Stored RAG study" })], rankingMethod: "cached-lexical" };
    },
    webSearchTool: async () => {
      webCalls += 1;
      return { results: [{ title: "New RAG paper", url: "https://example.edu/rag", source: "example.edu", text: "Multimodal RAG study." }] };
    },
    buildEvidenceFromArticles: async () => ({ evidence: [fakeEvidence({ id: "D2-C1", title: "New RAG paper", url: "https://example.edu/rag", sourceName: "example.edu", text: "Multimodal RAG study." })], rankingMethod: "gemini-embed" }),
    createJsonCompletion: async ({ user }) => {
      if (user.includes("REQUEST CONTEXT")) {
        return { intent: "research", strategy: "research", requiresCurrentInformation: true, requiresWebSearch: true, requiresRag: true, requiresMediaAnalysis: false, atomicClaims: ["What are recent multimodal RAG approaches?"], searchQueries: ["recent multimodal RAG research"] };
      }
      if (user.includes("TOOL OBSERVATION")) return { nextTool: "none", evidenceAssessment: "sufficient" };
      return { answer: "Stored and web evidence describe complementary multimodal RAG approaches.", summary: "The synthesis uses stored and web evidence.", supportingEvidenceIds: ["E1", "E2"], contradictingEvidenceIds: [], claimBreakdown: [], uncertainties: [], simpleExplanation: "Both sources were considered.", technicalExplanation: "E1 and E2 are the retrieved sources.", recommendedNextSteps: [] };
    },
  });
  assert.equal(ragCalls, 1);
  assert.equal(webCalls, 1);
  assert.equal(result.ragUsed, true);
  assert.equal(result.webUsed, true);
  assert.equal(result.sources.length, 2);
});

test("claim verification remains unverified when a requested web search returns no evidence", async () => {
  const result = await runGeneralAgent("Is this news claim true?", {}, {
    getGeminiStatus: availableGemini,
    webSearchTool: async () => ({ results: [], status: { available: true, reason: "no_results" } }),
    buildEvidenceFromArticles: async () => ({ evidence: [], rankingMethod: "none" }),
    createJsonCompletion: async ({ user }) => {
      if (user.includes("REQUEST CONTEXT")) {
        return { intent: "claim_verification", strategy: "claim_verification", requiresCurrentInformation: false, requiresWebSearch: true, requiresRag: false, requiresMediaAnalysis: false, atomicClaims: ["Is the news claim true?"], searchQueries: ["news claim"] };
      }
      if (user.includes("TOOL OBSERVATION")) return { nextTool: "none", evidenceAssessment: "evidence_unavailable" };
      return { answer: "Current evidence could not be retrieved.", summary: "The claim could not be verified.", verdict: "TRUE", supportingEvidenceIds: [], contradictingEvidenceIds: [], claimBreakdown: [], uncertainties: ["No sources were returned."], simpleExplanation: "No evidence was retrieved.", technicalExplanation: "No evidence was retrieved.", recommendedNextSteps: [] };
    },
  });
  assert.equal(result.mode, "researched");
  assert.equal(result.verdict, "UNVERIFIED");
  assert.equal(result.webUsed, true);
});

test("a failed current-information tool does not become a false or unverified general answer", async () => {
  const result = await runGeneralAgent("What happened in today's match?", {}, {
    getGeminiStatus: availableGemini,
    webSearchTool: async () => { throw new Error("network unavailable"); },
    createJsonCompletion: async ({ user }) => {
      if (user.includes("REQUEST CONTEXT")) {
        return { intent: "current_information", strategy: "web_research", requiresCurrentInformation: true, requiresWebSearch: true, requiresRag: false, requiresMediaAnalysis: false, atomicClaims: ["What happened today?"], searchQueries: ["today match result"] };
      }
      return { answer: "I could not retrieve current match information.", summary: "Current information could not be retrieved.", supportingEvidenceIds: [], contradictingEvidenceIds: [], claimBreakdown: [], uncertainties: ["Web search failed."], simpleExplanation: "Web search failed.", technicalExplanation: "Web search failed.", recommendedNextSteps: ["Try again later."] };
    },
  });
  assert.equal(result.verdict, "NOT_APPLICABLE");
  assert.equal(result.limitations.includes("WEB_SEARCH_UNAVAILABLE"), true);
  assert.equal(result.limitations.includes("CURRENT_INFORMATION_NOT_RETRIEVED"), true);
});

test("Gemini outage does not turn a normal question into unverified", async () => {
  const result = await runGeneralAgent("Is the Sun hot?", {}, {
    getGeminiStatus: () => ({ available: false, configured: true, reason: "rate_limited" }),
  });
  assert.equal(result.mode, "unavailable");
  assert.equal(result.verdict, "NOT_APPLICABLE");
  assert.equal(result.limitations.includes("GEMINI_RATE_LIMITED"), true);
});

test("media questions are delegated to the dedicated forensic pipeline without web search", async () => {
  let webCalls = 0;
  const result = await runGeneralAgent("Is this image AI-generated?", { hasMedia: true, mediaType: "image" }, {
    getGeminiStatus: availableGemini,
    webSearchTool: async () => { webCalls += 1; return { results: [] }; },
    createJsonCompletion: async () => ({ intent: "media_verification", strategy: "media_analysis", requiresMediaAnalysis: true, requiresWebSearch: false, requiresRag: false, atomicClaims: ["Is the image AI-generated?"] }),
  });
  assert.equal(result.mode, "media_analysis");
  assert.equal(result.toolsUsed[0].name, "mediaForensics");
  assert.equal(webCalls, 0);
});

test("web-search tool deduplicates repeated identical requests and returns normalized sources", async () => {
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return new Response('<a class="result__a" href="https://example.org/page">Example result</a><div class="result__snippet">Useful source text.</div>', { status: 200, headers: { "content-type": "text/html" } });
  };
  _resetWebSearchState();
  try {
    const first = await webSearchTool("example query", { limit: 3, fetchContent: false });
    const second = await webSearchTool("example query", { limit: 3, fetchContent: false });
    assert.equal(first.results.length, 1);
    assert.equal(second.results.length, 1);
    assert.equal(first.results[0].source, "example.org");
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
    _resetWebSearchState();
  }
});

test("web-search tool reports a network failure distinctly from an empty result", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error("offline"); };
  _resetWebSearchState();
  try {
    const result = await webSearchTool("offline search", { limit: 2, fetchContent: false });
    assert.equal(result.results.length, 0);
    assert.equal(result.status.available, false);
    assert.equal(result.status.reason, "network_error");
  } finally {
    global.fetch = originalFetch;
    _resetWebSearchState();
  }
});

test("evidence sufficiency accepts a strong official source without a minimum article count", () => {
  const status = evaluateEvidenceSufficiency([
    { url: "https://example.gov/statement", sourceName: "Example Government", sourceQuality: "high", relevanceScore: 0.91, publishedAt: new Date().toISOString() },
  ], "sufficient");
  assert.equal(status.status, "sufficient");
  assert.equal(status.metrics.evidenceCount, 1);
});

test("MongoDB configuration has one canonical case-sensitive database name", () => {
  const original = process.env.MONGODB_DB_NAME;
  delete process.env.MONGODB_DB_NAME;
  assert.equal(getCanonicalDatabaseName(), "DeepTrust");
  process.env.MONGODB_DB_NAME = "DeepTrust";
  assert.equal(getCanonicalDatabaseName(), "DeepTrust");
  if (original === undefined) delete process.env.MONGODB_DB_NAME;
  else process.env.MONGODB_DB_NAME = original;
});

test("media validation rejects bytes that do not match the declared type", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "deeptrust-test-"));
  const filePath = path.join(directory, "invalid.jpg");
  await fs.writeFile(filePath, "not image data");
  await assert.rejects(
    validateUploadedMedia({ path: filePath, mimetype: "image/jpeg", originalname: "invalid.jpg" }),
    /contents do not match/,
  );
  await fs.rm(directory, { recursive: true, force: true });
});

test("unsupported media MIME type is rejected before analysis", async () => {
  await assert.rejects(
    validateUploadedMedia({ path: __filename, mimetype: "application/pdf", originalname: "sample.pdf" }),
    /Unsupported media type/,
  );
});

test("ImageKit outage is reported as storage unavailable rather than a local URL", async () => {
  const originalPrivateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const originalEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
  delete process.env.IMAGEKIT_PRIVATE_KEY;
  delete process.env.IMAGEKIT_URL_ENDPOINT;
  const result = await uploadToImageKit({ path: __filename, originalname: "sample.jpg", mimetype: "image/jpeg" }, "image");
  process.env.IMAGEKIT_PRIVATE_KEY = originalPrivateKey;
  process.env.IMAGEKIT_URL_ENDPOINT = originalEndpoint;
  assert.equal(result.storage, "not_configured");
  assert.equal(result.url, null);
});

test("video analysis reports unavailable when preprocessing cannot run", async () => {
  const result = await analyzeVideo({ path: "does-not-exist.mp4" });
  assert.equal(result.mediaType, "video");
  assert.equal(result.syntheticMedia.status, "ANALYSIS_UNAVAILABLE");
});
