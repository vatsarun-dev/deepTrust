const { createJsonCompletion, getGeminiStatus } = require("../ai/aiService");
const {
  retrieveExistingEvidence,
  buildEvidenceFromArticles,
  mergeEvidence,
} = require("../rag/ragService");
const { webSearchTool } = require("../webSearchService");
const { evaluateEvidenceSufficiency, normalizeAssessment } = require("./evidenceSufficiencyService");

const DIRECT_STRATEGIES = new Set(["direct_answer", "rag_answer", "web_research", "research", "claim_verification", "media_analysis"]);
const TOOL_NAMES = new Set(["none", "retrieveRag", "webSearch", "mediaForensics"]);
const VALID_VERDICTS = new Set(["TRUE", "LIKELY_TRUE", "MISLEADING", "FALSE", "UNVERIFIED"]);

const DEEPTRUST_AGENT_SYSTEM = [
  "You are the reasoning engine of DeepTrust.",
  "Answer straightforward questions directly using your knowledge when you have sufficient knowledge.",
  "Do not call tools merely because a question is factual.",
  "Use external tools only when information is current, changing, highly specific, explicitly requested to be researched, or unavailable from your knowledge.",
  "Use RAG only when relevant stored evidence can improve the answer.",
  "Use specialist tools for media analysis; never claim that you personally detected whether media is synthetic.",
  "Never invent tool results, sources, URLs, citations, dates, or retrieved facts.",
  "When external information is retrieved, distinguish retrieved evidence from your own reasoning.",
  "When sources conflict, explain the conflict.",
  "When current or verification information is genuinely insufficient, state the limitation instead of fabricating an answer.",
  "Be concise for simple questions and detailed only when the user asks for explanation or research.",
].join(" ");

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqueStrings(values, limit = 8) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))).slice(0, limit);
}

function configuredLimit(name, fallback, maximum) {
  const value = Number.parseInt(process.env[name], 10);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(value, maximum);
}

function getAgentLimits() {
  return {
    iterations: configuredLimit("MAX_AGENT_ITERATIONS", 3, 5),
    toolCalls: configuredLimit("MAX_AGENT_TOOL_CALLS", 5, 8),
  };
}

function normalizeStrategy(value) {
  const strategy = clean(value).toLowerCase().replace(/[\s-]+/g, "_");
  return DIRECT_STRATEGIES.has(strategy) ? strategy : "direct_answer";
}

function normalizeTool(value) {
  const tool = clean(value).replace(/[\s-]+/g, "_");
  const map = { retrieve_rag: "retrieveRag", web_search: "webSearch", media_forensics: "mediaForensics" };
  const normalized = map[tool] || value;
  return TOOL_NAMES.has(normalized) ? normalized : "none";
}

function normalizeVerdict(value) {
  const verdict = clean(value).toUpperCase().replace(/[\s-]+/g, "_");
  return VALID_VERDICTS.has(verdict) ? verdict : "UNVERIFIED";
}

function normalizeEvidenceIds(evidence) {
  return evidence.map((item, index) => ({ ...item, id: `E${index + 1}` }));
}

function mergeContextEvidence(...sets) {
  return normalizeEvidenceIds(mergeEvidence(...sets));
}

function evidenceSummary(evidence) {
  return evidence.slice(0, 8).map((item) => ({
    id: item.id,
    title: item.title,
    source: item.sourceName,
    domain: item.domain || "",
    url: item.url,
    publishedAt: item.publishedAt || null,
    retrievedAt: item.retrievedAt || null,
    sourceQuality: item.sourceQuality,
    relevanceScore: Math.round((Number(item.relevanceScore) || 0) * 100) / 100,
    text: clean(item.text).slice(0, 1000),
  }));
}

function visibleEvidence(evidence, relationship = "context") {
  return evidence.slice(0, 8).map((item) => ({
    id: item.id,
    title: item.title,
    sourceName: item.sourceName,
    domain: item.domain || "",
    url: item.url,
    publishedAt: item.publishedAt || null,
    retrievedAt: item.retrievedAt || null,
    sourceQuality: item.sourceQuality,
    relevanceScore: Math.round((Number(item.relevanceScore) || 0) * 100) / 100,
    relationship,
    role: relationship,
  }));
}

function selectEvidence(ids, allEvidence, relationship) {
  const byId = new Map(allEvidence.map((item) => [item.id, item]));
  return uniqueStrings(ids, 8)
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((item) => ({ ...visibleEvidence([item], relationship)[0], relationship, role: relationship }));
}

function plannerPrompt(query, options) {
  return [
    `USER QUERY\n${query}`,
    "",
    "REQUEST CONTEXT",
    JSON.stringify({ hasUploadedMedia: Boolean(options.hasMedia), mediaType: options.mediaType || null }),
    "",
    "Return strict JSON with exactly these fields:",
    '{"intent":"general_knowledge|explanation|programming|current_information|research|claim_verification|media_verification|mixed","strategy":"direct_answer|rag_answer|web_research|research|claim_verification|media_analysis","requiresCurrentInformation":true,"requiresWebSearch":false,"requiresRag":false,"requiresMediaAnalysis":false,"atomicClaims":["..."],"searchQueries":["..."],"reason":"...","directAnswer":"...","directExplanation":"..."}',
    "",
    "Classify the request before answering. Choose direct_answer for stable general knowledge, explanations, mathematics, programming concepts, writing, reasoning, and casual questions. For direct_answer, also fill directAnswer and directExplanation so no second model call is needed. Choose web_research for latest/current/today/recent information or an explicit search request. Choose research for a multi-source research request. Choose claim_verification when the user asks whether a specific real-world claim is true. Choose media_analysis when uploaded media authenticity is the main request. Do not request RAG or web search by default.",
  ].join("\n");
}

function parseRoute(raw, query, options) {
  const strategy = normalizeStrategy(raw?.strategy);
  const requiresMediaAnalysis = Boolean(raw?.requiresMediaAnalysis) || strategy === "media_analysis";
  return {
    intent: clean(raw?.intent) || (requiresMediaAnalysis ? "media_verification" : "general_knowledge"),
    strategy: options.hasMedia && strategy === "media_analysis" ? "media_analysis" : strategy,
    requiresCurrentInformation: Boolean(raw?.requiresCurrentInformation),
    requiresWebSearch: Boolean(raw?.requiresWebSearch) || ["web_research", "research"].includes(strategy),
    requiresRag: Boolean(raw?.requiresRag) || strategy === "rag_answer",
    requiresMediaAnalysis,
    atomicClaims: uniqueStrings(raw?.atomicClaims, 6).length ? uniqueStrings(raw?.atomicClaims, 6) : [query],
    searchQueries: uniqueStrings(raw?.searchQueries, 4),
    reason: clean(raw?.reason),
    directAnswer: clean(raw?.directAnswer),
    directExplanation: clean(raw?.directExplanation),
  };
}

function observationPrompt(query, route, evidence, toolLog, sufficiency) {
  return [
    `USER QUERY\n${query}`,
    "",
    "ROUTING DECISION",
    JSON.stringify(route),
    "",
    "TOOL OBSERVATION",
    JSON.stringify(toolLog),
    "",
    "CURRENT EVIDENCE",
    JSON.stringify(evidenceSummary(evidence)),
    "",
    "EVIDENCE SUFFICIENCY",
    JSON.stringify(sufficiency),
    "",
    "Return strict JSON with exactly these fields:",
    '{"nextTool":"none|retrieveRag|webSearch","searchQuery":"...","evidenceAssessment":"sufficient|partially_sufficient|insufficient|contradictory|evidence_unavailable","reason":"..."}',
    "",
    "Choose another tool only if it would materially improve the answer. Do not search for a direct-answer question. Do not repeat an equivalent search query. Do not claim a missing tool result is evidence.",
  ].join("\n");
}

function directAnswerPrompt(query) {
  return [
    `USER QUERY\n${query}`,
    "",
    "Return strict JSON with exactly these fields:",
    '{"answer":"...","summary":"...","simpleExplanation":"...","technicalExplanation":"...","uncertainties":["..."],"recommendedNextSteps":["..."]}',
    "",
    "Answer directly from your stable general knowledge. Do not claim that you searched the web, retrieved evidence, or verified a real-world claim. Do not return UNVERIFIED merely because no external source was used.",
  ].join("\n");
}

function groundedAnswerPrompt(query, route, evidence, sufficiency, toolsUsed, limitations) {
  return [
    `USER QUERY\n${query}`,
    "",
    "ROUTING DECISION",
    JSON.stringify({ intent: route.intent, strategy: route.strategy, atomicClaims: route.atomicClaims }),
    "",
    "TOOLS USED",
    JSON.stringify(toolsUsed),
    "",
    "EVIDENCE SUFFICIENCY",
    JSON.stringify(sufficiency),
    "",
    "LIMITATIONS",
    JSON.stringify(limitations),
    "",
    "RETRIEVED EVIDENCE",
    JSON.stringify(evidenceSummary(evidence)),
    "",
    "Return strict JSON with exactly these fields:",
    '{"answer":"...","summary":"...","verdict":"TRUE|LIKELY_TRUE|MISLEADING|FALSE|UNVERIFIED","claimBreakdown":[{"claim":"...","verdict":"TRUE|LIKELY_TRUE|MISLEADING|FALSE|UNVERIFIED","reason":"...","evidenceIds":["E1"]}],"supportingEvidenceIds":["E1"],"contradictingEvidenceIds":["E2"],"uncertainties":["..."],"simpleExplanation":"...","technicalExplanation":"...","recommendedNextSteps":["..."]}',
    "",
    "Use retrieved evidence for current information, research, or claim verification. Never invent a source, citation, URL, date, quotation, or evidence ID. For non-verification research, give a useful sourced synthesis and the verdict will be ignored. For claim verification, use UNVERIFIED when evidence is insufficient; never turn a tool failure into a factual conclusion. Explain conflicting sources. Do not claim media authenticity; that is handled by the dedicated media-forensics pipeline.",
  ].join("\n");
}

function toWebArticles(results) {
  return (Array.isArray(results) ? results : []).map((result) => ({
    title: clean(result.title) || "Untitled web result",
    description: clean(result.snippet),
    content: clean(result.text || result.snippet),
    source: clean(result.source || result.domain),
    url: clean(result.url),
    publishedAt: clean(result.publishedAt),
    retrievedAt: clean(result.retrievedAt) || new Date().toISOString(),
    author: "",
  })).filter((item) => item.url);
}

function toolLog(name, query, result = {}) {
  return {
    name,
    query: clean(query).slice(0, 240),
    status: result.error ? "failed" : result.unavailable ? "unavailable" : "completed",
    evidenceCount: Array.isArray(result.evidence) ? result.evidence.length : 0,
    resultCount: result.resultCount || 0,
    reason: result.reason || null,
  };
}

function limitationForError(error) {
  const code = clean(error?.code).toUpperCase();
  if (code === "RATE_LIMITED") return "GEMINI_RATE_LIMITED";
  if (code === "MISSING_API_KEY") return "GEMINI_NOT_CONFIGURED";
  return code ? `GEMINI_${code}` : "GEMINI_UNAVAILABLE";
}

function buildServiceUnavailable(query, error) {
  const limitation = limitationForError(error);
  const answer = limitation === "GEMINI_RATE_LIMITED"
    ? "DeepTrust's AI reasoning service is temporarily rate-limited. Please retry shortly."
    : "DeepTrust's AI reasoning service is unavailable right now. Please retry after checking the Gemini configuration.";
  return {
    query,
    intent: "unavailable",
    mode: "unavailable",
    answer,
    claimType: "not_applicable",
    verdict: "NOT_APPLICABLE",
    confidence: null,
    confidenceMethod: "No answer was generated because the reasoning service is unavailable.",
    summary: answer,
    claimBreakdown: [],
    supportingEvidence: [],
    contradictingEvidence: [],
    evidence: [],
    sources: [],
    toolsUsed: [],
    ragUsed: false,
    webUsed: false,
    limitations: [limitation],
    uncertainties: [answer],
    explanation: { simple: answer, technical: answer },
    recommendedNextSteps: ["Retry when the Gemini service is available."],
  };
}

async function routeQuery(query, options, dependencies) {
  const status = (dependencies.getGeminiStatus || getGeminiStatus)();
  if (!status.available) return { route: null, error: { code: status.reason || "missing_api_key" } };
  try {
    const raw = await (dependencies.createJsonCompletion || createJsonCompletion)({
      system: DEEPTRUST_AGENT_SYSTEM,
      user: plannerPrompt(query, options),
      temperature: 0,
      maxTokens: 700,
    });
    return { route: parseRoute(raw, query, options), error: null };
  } catch (error) {
    return { route: null, error };
  }
}

function nextRequestedTool(route, state, observation) {
  const observed = normalizeTool(observation?.nextTool);
  if (observed !== "none" && observed !== "mediaForensics") return observed;
  if (route.requiresRag && !state.ragUsed) return "retrieveRag";
  if (route.requiresWebSearch && !state.webUsed) return "webSearch";
  return "none";
}

async function executeTool(name, query, dependencies) {
  if (name === "retrieveRag") {
    const result = await (dependencies.retrieveExistingEvidence || retrieveExistingEvidence)(query);
    return { ...result, evidence: Array.isArray(result?.evidence) ? result.evidence : [], tool: name, resultCount: result?.evidence?.length || 0 };
  }
  if (name === "webSearch") {
    const search = await (dependencies.webSearchTool || webSearchTool)(query, { limit: 6, fetchContent: true });
    const articles = toWebArticles(search?.results || search);
    const fresh = await (dependencies.buildEvidenceFromArticles || buildEvidenceFromArticles)(query, articles);
    return {
      ...fresh,
      evidence: Array.isArray(fresh?.evidence) ? fresh.evidence : [],
      tool: name,
      resultCount: articles.length,
      reason: search?.status?.reason || null,
    };
  }
  return { tool: name, unavailable: true, reason: "tool_not_available", evidence: [] };
}

async function observe(query, route, evidence, lastTool, sufficiency, dependencies) {
  try {
    const raw = await (dependencies.createJsonCompletion || createJsonCompletion)({
      system: DEEPTRUST_AGENT_SYSTEM,
      user: observationPrompt(query, route, evidence, lastTool, sufficiency),
      temperature: 0,
      maxTokens: 500,
    });
    return {
      nextTool: normalizeTool(raw?.nextTool),
      searchQuery: clean(raw?.searchQuery),
      evidenceAssessment: normalizeAssessment(raw?.evidenceAssessment),
      reason: clean(raw?.reason),
    };
  } catch (error) {
    return { nextTool: "none", searchQuery: "", evidenceAssessment: null, reason: "observation_unavailable", error };
  }
}

function presentationFromFinal(query, route, final, state) {
  const isClaimVerification = route.strategy === "claim_verification";
  const supportingEvidence = selectEvidence(final?.supportingEvidenceIds, state.evidence, "supports");
  const contradictingEvidence = selectEvidence(final?.contradictingEvidenceIds, state.evidence, "contradicts");
  const evidenceStatus = evaluateEvidenceSufficiency(state.evidence, state.evidenceAssessment);
  const verdict = isClaimVerification
    ? evidenceStatus.sufficient
      ? normalizeVerdict(final?.verdict)
      : "UNVERIFIED"
    : "NOT_APPLICABLE";
  const answer = clean(final?.answer) || clean(final?.summary) || "I could not generate a response from the available information.";
  const summary = clean(final?.summary) || answer;
  const mode = route.strategy === "direct_answer" ? "direct" : state.webUsed ? "researched" : state.ragUsed ? "rag" : route.strategy;

  return {
    query,
    intent: route.intent,
    mode,
    answer,
    claimType: isClaimVerification ? "claim_verification" : "not_applicable",
    verdict,
    confidence: isClaimVerification ? evidenceStatus.score : null,
    confidenceMethod: isClaimVerification
      ? "Evidence-strength estimate based on relevance, source quality, source diversity, recency, and agreement; it is not a calibrated probability."
      : "Not applicable to a general answer.",
    summary,
    claimBreakdown: isClaimVerification && Array.isArray(final?.claimBreakdown)
      ? final.claimBreakdown.slice(0, 6).map((item) => ({
        claim: clean(item?.claim),
        verdict: normalizeVerdict(item?.verdict),
        reason: clean(item?.reason),
        evidenceIds: uniqueStrings(item?.evidenceIds, 4).filter((id) => state.evidence.some((item) => item.id === id)),
      })).filter((item) => item.claim || item.reason)
      : [],
    supportingEvidence,
    contradictingEvidence,
    evidence: supportingEvidence.length || contradictingEvidence.length
      ? [...supportingEvidence, ...contradictingEvidence]
      : visibleEvidence(state.evidence),
    sources: visibleEvidence(state.evidence),
    toolsUsed: state.toolsUsed,
    ragUsed: state.ragUsed,
    webUsed: state.webUsed,
    limitations: uniqueStrings(state.limitations),
    uncertainties: uniqueStrings([...(Array.isArray(final?.uncertainties) ? final.uncertainties : []), ...state.limitations]),
    explanation: {
      simple: clean(final?.simpleExplanation) || summary,
      technical: clean(final?.technicalExplanation) || summary,
    },
    recommendedNextSteps: uniqueStrings(final?.recommendedNextSteps),
    evidenceSufficiency: evidenceStatus,
    retrieval: {
      rankingMethod: state.rankingMethod || "none",
      embeddingError: state.embeddingError || null,
    },
  };
}

async function runGeneralAgent(query, options = {}, dependencies = {}) {
  const normalizedQuery = clean(query);
  const routing = await routeQuery(normalizedQuery, options, dependencies);
  if (routing.error || !routing.route) return buildServiceUnavailable(normalizedQuery, routing.error);
  const route = routing.route;
  console.log(`[AGENT] Intent detected: ${route.intent}; strategy: ${route.strategy}.`);

  if (route.strategy === "media_analysis" && options.hasMedia) {
    const answer = "The uploaded media is being assessed by DeepTrust's dedicated media-forensics pipeline.";
    return {
      query: normalizedQuery,
      intent: route.intent,
      mode: "media_analysis",
      answer,
      claimType: "not_applicable",
      verdict: "NOT_APPLICABLE",
      confidence: null,
      confidenceMethod: "Media authenticity is determined by the dedicated forensic provider.",
      summary: answer,
      claimBreakdown: [],
      supportingEvidence: [],
      contradictingEvidence: [],
      evidence: [],
      sources: [],
      toolsUsed: [{ name: "mediaForensics", status: "delegated", evidenceCount: 0, resultCount: 0, reason: "analysis_controller" }],
      ragUsed: false,
      webUsed: false,
      limitations: [],
      uncertainties: [],
      explanation: { simple: answer, technical: answer },
      recommendedNextSteps: [],
    };
  }

  if (route.strategy === "direct_answer") {
    if (route.directAnswer) {
      return presentationFromFinal(normalizedQuery, route, {
        answer: route.directAnswer,
        summary: route.directAnswer,
        simpleExplanation: route.directExplanation || route.directAnswer,
        technicalExplanation: route.directExplanation || route.directAnswer,
        uncertainties: [],
        recommendedNextSteps: [],
      }, {
        evidence: [], toolsUsed: [], ragUsed: false, webUsed: false, limitations: [], evidenceAssessment: null,
      });
    }
    try {
      const final = await (dependencies.createJsonCompletion || createJsonCompletion)({
        system: DEEPTRUST_AGENT_SYSTEM,
        user: directAnswerPrompt(normalizedQuery),
        temperature: 0.2,
        maxTokens: 900,
      });
      return presentationFromFinal(normalizedQuery, route, final, {
        evidence: [], toolsUsed: [], ragUsed: false, webUsed: false, limitations: [], evidenceAssessment: null,
      });
    } catch (error) {
      return buildServiceUnavailable(normalizedQuery, error);
    }
  }

  const limits = getAgentLimits();
  const state = {
    evidence: [],
    toolsUsed: [],
    ragUsed: false,
    webUsed: false,
    toolCalls: 0,
    rankingMethod: "none",
    embeddingError: null,
    limitations: [],
    evidenceAssessment: null,
  };
  const usedSearchQueries = new Set();
  let observation = null;

  for (let iteration = 0; iteration < limits.iterations && state.toolCalls < limits.toolCalls; iteration += 1) {
    const tool = nextRequestedTool(route, state, observation);
    if (tool === "none") break;
    const requestedQuery = tool === "webSearch"
      ? clean(observation?.searchQuery) || route.searchQueries.find((item) => !usedSearchQueries.has(item.toLowerCase())) || normalizedQuery
      : normalizedQuery;
    if (tool === "webSearch" && usedSearchQueries.has(requestedQuery.toLowerCase())) break;
    if (tool === "webSearch") usedSearchQueries.add(requestedQuery.toLowerCase());

    console.log(`[AGENT] Tool selected: ${tool}.`);
    try {
      const result = await executeTool(tool, requestedQuery, dependencies);
      state.toolsUsed.push(toolLog(tool, requestedQuery, result));
      state.toolCalls += 1;
      state.evidence = mergeContextEvidence(state.evidence, result.evidence || []);
      state.ragUsed = state.ragUsed || tool === "retrieveRag";
      state.webUsed = state.webUsed || tool === "webSearch";
      state.rankingMethod = [state.rankingMethod, result.rankingMethod].filter((value) => value && value !== "none").join("+") || "none";
      state.embeddingError = result.embeddingError || state.embeddingError;
      if (tool === "webSearch" && result.reason && result.reason !== "no_results") {
        state.limitations.push("WEB_SEARCH_UNAVAILABLE");
      }
      const sufficiency = evaluateEvidenceSufficiency(state.evidence);
      console.log(`[RAG] Evidence sufficiency: ${sufficiency.status} (${sufficiency.score}/100).`);
      observation = await observe(normalizedQuery, route, state.evidence, state.toolsUsed.at(-1), sufficiency, dependencies);
      state.evidenceAssessment = observation.evidenceAssessment;
      if (observation.error) state.limitations.push(limitationForError(observation.error));
    } catch (error) {
      state.toolsUsed.push(toolLog(tool, requestedQuery, { error, reason: clean(error?.code) || "tool_failed" }));
      state.limitations.push(tool === "webSearch" ? "WEB_SEARCH_UNAVAILABLE" : "RAG_RETRIEVAL_FAILED");
      break;
    }
  }

  const sufficiency = evaluateEvidenceSufficiency(state.evidence, state.evidenceAssessment);
  if (route.requiresCurrentInformation && !state.evidence.length) state.limitations.push("CURRENT_INFORMATION_NOT_RETRIEVED");
  try {
    console.log(`[GEMINI] Reasoning with ${state.evidence.length} retrieved evidence item(s).`);
    const final = await (dependencies.createJsonCompletion || createJsonCompletion)({
      system: DEEPTRUST_AGENT_SYSTEM,
      user: groundedAnswerPrompt(normalizedQuery, route, state.evidence, sufficiency, state.toolsUsed, uniqueStrings(state.limitations)),
      temperature: 0,
      maxTokens: 1800,
    });
    return presentationFromFinal(normalizedQuery, route, final, state);
  } catch (error) {
    return buildServiceUnavailable(normalizedQuery, error);
  }
}

module.exports = {
  DEEPTRUST_AGENT_SYSTEM,
  getAgentLimits,
  runGeneralAgent,
};
