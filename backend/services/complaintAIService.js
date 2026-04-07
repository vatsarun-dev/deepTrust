const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const COMPLAINT_TYPES = [
  "AI Image Misuse",
  "Fake News / Defamation",
  "Harassment / Cyber Abuse",
];

function normalizeText(value) {
  return String(value || "").trim();
}

function classifyByKeywords({ description, platform, issueType }) {
  const explicit = normalizeText(issueType);
  if (COMPLAINT_TYPES.includes(explicit)) {
    return explicit;
  }

  const blob = `${description || ""} ${platform || ""}`.toLowerCase();
  const hasImageMisuse =
    /\b(deepfake|morphed|manipulated image|edited photo|ai image|synthetic image|face swap|photoshopped)\b/i.test(
      blob
    );
  const hasHarassment =
    /\b(threat|abuse|harass|stalk|blackmail|bully|intimidat|hate message|slur|doxx)\b/i.test(blob);
  const hasDefamation =
    /\b(fake news|defamation|rumor|misinformation|false claim|viral post|smear|propaganda)\b/i.test(
      blob
    );

  if (hasImageMisuse) return "AI Image Misuse";
  if (hasHarassment) return "Harassment / Cyber Abuse";
  if (hasDefamation) return "Fake News / Defamation";
  return "Fake News / Defamation";
}

async function classifyWithAI({ description, platform, issueType }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const prompt = [
    "Classify the complaint into exactly one label:",
    COMPLAINT_TYPES.map((type) => `- ${type}`).join("\n"),
    "",
    `Issue Type Input: ${normalizeText(issueType) || "Not provided"}`,
    `Platform: ${normalizeText(platform) || "Not provided"}`,
    `Description: ${normalizeText(description) || "Not provided"}`,
    "",
    'Return STRICT JSON: {"complaintType":"<one label>"}',
  ].join("\n");

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "You classify cyber complaints. Return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const json = await response.json().catch(() => null);
  const content = json?.choices?.[0]?.message?.content;
  const raw = String(content || "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const parsed = JSON.parse(raw.slice(start, end + 1));
  const result = normalizeText(parsed?.complaintType);
  return COMPLAINT_TYPES.includes(result) ? result : null;
}

function buildRecommendedActions(complaintType, platform) {
  const actions = new Set([
    "Preserve evidence with timestamps and original links/screenshots.",
    "Document timeline: first seen date, account/profile, and spread pattern.",
    "Report to Cyber Crime Portal.",
  ]);

  if (platform && platform !== "Unknown") {
    actions.add(`Report the content on ${platform} through in-app safety/report tools.`);
  } else {
    actions.add("Report the content on the platform where it appeared.");
  }

  if (complaintType === "AI Image Misuse") {
    actions.add("Request takedown for manipulated media and retain original media metadata.");
  }

  if (complaintType === "Harassment / Cyber Abuse") {
    actions.add("Block abusive accounts and archive threatening messages before deletion.");
  }

  if (complaintType === "Fake News / Defamation") {
    actions.add("Collect supporting fact-check links and corrective statements.");
  }

  return Array.from(actions);
}

function heuristicSeverity(complaintType, description = "") {
  const text = description.toLowerCase();
  const highSignals = /\b(threat|violence|suicide|sexual|blackmail|extort|minor|urgent)\b/i.test(text);
  if (highSignals) return "High";
  if (complaintType === "Harassment / Cyber Abuse") return "High";
  if (complaintType === "AI Image Misuse") return "High";
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
    "I request review of this incident, preservation of relevant logs, and suitable action under applicable cyber safety provisions.",
    "I am providing available evidence and request acknowledgment of this complaint.",
    "",
    "Sincerely,",
    name || "Complainant",
  ].join("\n");

  return { title, body, severity };
}

async function generateComplaintWithAI({ complaintType, description, platform, name, email, evidence }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const evidenceLines = Array.isArray(evidence)
    ? evidence
        .slice(0, 8)
        .map(
          (item, index) =>
            `${index + 1}. ${item.sourceType || "file"} | ${item.fileType || "n/a"} | ${
              item.link || item.fileName || "n/a"
            } | ${item.description || "no description"} | ${item.timestamp || "timestamp n/a"}`
        )
        .join("\n")
    : "No evidence metadata supplied.";

  const prompt = [
    "Create a structured, formal cyber complaint draft. Keep it factual and concise.",
    "Do NOT claim legal outcomes. Do NOT promise legal action.",
    "",
    `Complainant Name: ${name || "Not provided"}`,
    `Complainant Email: ${email || "Not provided"}`,
    `Complaint Type: ${complaintType}`,
    `Platform: ${platform || "Unknown"}`,
    `Description: ${description || "Not provided"}`,
    "",
    "Evidence summary:",
    evidenceLines,
    "",
    "Return STRICT JSON with keys:",
    '{"title":"...","body":"...","severity":"Low|Medium|High"}',
  ].join("\n");

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are an assistant helping users draft structured cyber complaints. Output valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const json = await response.json().catch(() => null);
  const content = String(json?.choices?.[0]?.message?.content || "").trim();
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const parsed = JSON.parse(content.slice(start, end + 1));
  const severity = ["Low", "Medium", "High"].includes(parsed?.severity) ? parsed.severity : "Medium";

  return {
    title: normalizeText(parsed?.title) || `Complaint regarding ${complaintType}`,
    body: normalizeText(parsed?.body) || "Structured complaint body unavailable.",
    severity,
  };
}

async function buildComplaintDraft(input) {
  const keywordType = classifyByKeywords(input);
  const aiType = await classifyWithAI(input).catch(() => null);
  const complaintType = aiType || keywordType;

  const aiDraft = await generateComplaintWithAI({
    ...input,
    complaintType,
  }).catch(() => null);

  const draft = aiDraft || buildHeuristicComplaint({ ...input, complaintType });
  const recommendedActions = buildRecommendedActions(complaintType, normalizeText(input.platform) || "Unknown");

  return {
    complaintType,
    draft,
    recommendedActions,
  };
}

module.exports = {
  COMPLAINT_TYPES,
  buildComplaintDraft,
  buildRecommendedActions,
  classifyByKeywords,
};
