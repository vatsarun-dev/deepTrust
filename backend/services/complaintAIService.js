const { createJsonCompletion, getGeminiStatus } = require("./ai/aiService");

const COMPLAINT_TYPES = [
  "AI Image Misuse",
  "Fake News / Defamation",
  "Harassment / Cyber Abuse",
];

function normalizeText(value) {
  return String(value || "").trim();
}

function parseType(value) {
  const type = normalizeText(value);
  return COMPLAINT_TYPES.includes(type) ? type : null;
}

function classifyByKeywords({ description, platform, issueType }) {
  const explicit = parseType(issueType);
  if (explicit) return explicit;

  const blob = `${description || ""} ${platform || ""}`.toLowerCase();
  if (/\b(deepfake|morphed|manipulated image|edited photo|ai image|synthetic image|face swap|photoshopped)\b/i.test(blob)) {
    return "AI Image Misuse";
  }
  if (/\b(threat|abuse|harass|stalk|blackmail|bully|intimidat|hate message|slur|doxx)\b/i.test(blob)) {
    return "Harassment / Cyber Abuse";
  }
  return "Fake News / Defamation";
}

async function classifyWithAI({ description, platform, issueType }) {
  if (!getGeminiStatus().available) return null;
  const result = await createJsonCompletion({
    system: "You classify cyber complaints. Return JSON only and choose only from the provided labels.",
    user: [
      "Classify the complaint into exactly one label:",
      ...COMPLAINT_TYPES.map((type) => `- ${type}`),
      `Issue type input: ${normalizeText(issueType) || "Not provided"}`,
      `Platform: ${normalizeText(platform) || "Not provided"}`,
      `Description: ${normalizeText(description) || "Not provided"}`,
      'Return {"complaintType":"<one label>"}.',
    ].join("\n"),
    temperature: 0,
    maxTokens: 180,
  });
  return parseType(result?.complaintType);
}

function buildRecommendedActions(complaintType, platform) {
  const actions = new Set([
    "Preserve evidence with timestamps and original links or screenshots.",
    "Document the timeline: first-seen date, account or profile, and spread pattern.",
    "Use the relevant official reporting channel for the platform and your jurisdiction.",
  ]);
  actions.add(
    platform && platform !== "Unknown"
      ? `Report the content on ${platform} through its safety or reporting tools.`
      : "Report the content on the platform where it appeared.",
  );
  if (complaintType === "AI Image Misuse") actions.add("Request removal of manipulated media and retain any original-media metadata.");
  if (complaintType === "Harassment / Cyber Abuse") actions.add("Archive threatening messages before deletion and block abusive accounts where safe.");
  if (complaintType === "Fake News / Defamation") actions.add("Collect source links and any corrective statement that addresses the false claim.");
  return Array.from(actions);
}

function heuristicSeverity(complaintType, description = "") {
  if (/\b(threat|violence|suicide|sexual|blackmail|extort|minor|urgent)\b/i.test(description)) return "High";
  if (complaintType === "Harassment / Cyber Abuse" || complaintType === "AI Image Misuse") return "High";
  return "Medium";
}

function buildHeuristicComplaint({ complaintType, description, platform, name }) {
  const severity = heuristicSeverity(complaintType, description);
  const title = `Complaint regarding ${complaintType.toLowerCase()} on ${platform || "an online platform"}`;
  const body = [
    "To whom it may concern,",
    "",
    `I am submitting this complaint regarding ${complaintType.toLowerCase()} that appears on ${platform || "an online platform"}.`,
    `Reported by: ${name || "Anonymous user"}.`,
    "",
    "Incident summary:",
    description || "Details provided by the complainant.",
    "",
    "I request review of this incident, preservation of relevant logs, and suitable action under applicable safety processes.",
    "I am providing available evidence and request acknowledgment of this complaint.",
    "",
    "Sincerely,",
    name || "Complainant",
  ].join("\n");
  return { title, body, severity };
}

function evidenceLines(evidence) {
  return Array.isArray(evidence)
    ? evidence.slice(0, 8).map((item, index) =>
      `${index + 1}. ${item.sourceType || "file"} | ${item.fileType || "n/a"} | ${item.link || item.fileName || "n/a"} | ${item.description || "no description"} | ${item.timestamp || "timestamp n/a"}`,
    ).join("\n")
    : "No evidence metadata supplied.";
}

async function generateComplaintWithAI({ complaintType, description, platform, name, email, evidence }) {
  if (!getGeminiStatus().available) return null;
  const result = await createJsonCompletion({
    system: "You help users draft factual cyber complaints. Do not invent facts or legal outcomes. Return JSON only.",
    user: [
      "Create a concise formal cyber complaint draft.",
      `Complainant name: ${name || "Not provided"}`,
      `Complainant email: ${email || "Not provided"}`,
      `Complaint type: ${complaintType}`,
      `Platform: ${platform || "Unknown"}`,
      `Description: ${description || "Not provided"}`,
      "Evidence summary:",
      evidenceLines(evidence),
      'Return {"title":"...","body":"...","severity":"Low|Medium|High"}.',
    ].join("\n"),
    temperature: 0.2,
    maxTokens: 900,
  });
  return {
    title: normalizeText(result?.title) || `Complaint regarding ${complaintType}`,
    body: normalizeText(result?.body) || "Structured complaint body unavailable.",
    severity: ["Low", "Medium", "High"].includes(result?.severity) ? result.severity : "Medium",
  };
}

async function buildComplaintDraft(input) {
  const keywordType = classifyByKeywords(input);
  const aiType = await classifyWithAI(input).catch(() => null);
  const complaintType = aiType || keywordType;
  const aiDraft = await generateComplaintWithAI({ ...input, complaintType }).catch(() => null);
  const draft = aiDraft || buildHeuristicComplaint({ ...input, complaintType });
  return {
    complaintType,
    draft,
    recommendedActions: buildRecommendedActions(complaintType, normalizeText(input.platform) || "Unknown"),
  };
}

module.exports = {
  COMPLAINT_TYPES,
  buildComplaintDraft,
  buildRecommendedActions,
  classifyByKeywords,
};
