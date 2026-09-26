const geminiService = require("./geminiService");

async function generateStructured({ system, user, temperature = 0, maxTokens = 1800 }) {
  return geminiService.createJsonCompletion({ system, user, temperature, maxTokens });
}

async function embed(inputs) {
  return geminiService.createEmbeddings(inputs);
}

function getStatus() {
  return geminiService.getGeminiStatus();
}

async function analyze(data, options = {}) {
  const system = options.system || "Analyze the provided input and return JSON output.";
  const user = typeof data === "string" ? data : JSON.stringify(data);
  return generateStructured({ system, user, temperature: options.temperature || 0, maxTokens: options.maxTokens || 1800 });
}

async function reason(context, prompt, options = {}) {
  const system = options.system || "Perform step-by-step reasoning based on the context and prompt provided. Return JSON.";
  const user = `CONTEXT:\n${JSON.stringify(context)}\n\nPROMPT:\n${prompt}`;
  return generateStructured({ system, user, temperature: options.temperature || 0, maxTokens: options.maxTokens || 1800 });
}

module.exports = {
  // Provider-agnostic central AI interface
  generateStructured,
  embed,
  getStatus,
  analyze,
  reason,

  // Direct delegation exports for services transition
  createJsonCompletion: geminiService.createJsonCompletion,
  createEmbeddings: geminiService.createEmbeddings,
  getGeminiStatus: geminiService.getGeminiStatus,
  GeminiServiceError: geminiService.GeminiServiceError,
};
