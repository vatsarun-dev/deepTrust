const TOPIC_WEIGHTS = {
  health: 28,
  politics: 24,
  personal_attack: 22,
  finance: 20,
  safety: 18,
  general: 12,
};

const TARGET_WEIGHTS = {
  public: 16,
  institution: 12,
  individual: 18,
  community: 15,
  unknown: 8,
};

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function detectTopic(text) {
  const normalized = normalizeText(text);

  if (/\b(vaccine|virus|covid|hospital|doctor|medical|health|cancer|disease)\b/.test(normalized)) {
    return "health";
  }
  if (/\b(election|minister|government|party|policy|president|politics|vote|parliament)\b/.test(normalized)) {
    return "politics";
  }
  if (/\b(scam|bank|crypto|finance|stock|loan|money|investment|fraud)\b/.test(normalized)) {
    return "finance";
  }
  if (/\b(kill|attack|riot|terror|warning|emergency|unsafe|kidnap|crime)\b/.test(normalized)) {
    return "safety";
  }
  if (/\b(defame|liar|cheater|exposed|leak|affair|character|reputation|harass)\b/.test(normalized)) {
    return "personal_attack";
  }

  return "general";
}

function detectTargetType(text) {
  const normalized = normalizeText(text);

  if (/\b(government|court|school|hospital|company|platform|agency|police|media)\b/.test(normalized)) {
    return "institution";
  }
  if (/\b(you|she|he|person|girl|boy|actor|journalist|doctor|student|name)\b/.test(normalized)) {
    return "individual";
  }
  if (/\b(citizens|community|religion|women|men|voters|students|families)\b/.test(normalized)) {
    return "community";
  }
  if (/\b(public|nation|country|state|people)\b/.test(normalized)) {
    return "public";
  }

  return "unknown";
}

function detectEmotionalIntensity(text) {
  const normalized = normalizeText(text);
  let score = 12;

  if (/[!?]{2,}/.test(normalized)) score += 10;
  if (/\b(shocking|urgent|destroyed|outrage|disaster|terrifying|exposed|must see)\b/.test(normalized)) {
    score += 22;
  }
  if (/\b(hate|fraud|liar|monster|evil|panic|fear|attack)\b/.test(normalized)) {
    score += 18;
  }
  if (/\b(immediately|viral|breaking|massive|everyone|nobody)\b/.test(normalized)) {
    score += 10;
  }

  return Math.min(100, score);
}

function toRiskLevel(score) {
  if (score >= 75) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

function buildImpactScore(input) {
  const text = typeof input === "string" ? input : input?.text || "";
  const topic = detectTopic(text);
  const targetType = detectTargetType(text);
  const emotionalIntensity = detectEmotionalIntensity(text);

  const score = Math.max(
    0,
    Math.min(
      100,
      TOPIC_WEIGHTS[topic] + TARGET_WEIGHTS[targetType] + Math.round(emotionalIntensity * 0.46)
    )
  );

  return {
    impactScore: score,
    riskLevel: toRiskLevel(score),
    topic,
    emotionalIntensity,
    targetType,
  };
}

module.exports = {
  buildImpactScore,
  detectTopic,
  detectTargetType,
  detectEmotionalIntensity,
};
