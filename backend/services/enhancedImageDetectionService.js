const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs/promises");
const path = require("path");
const puter = require("@heyputer/puter.js");

const SIGHTENGINE_API_URL = "https://api.sightengine.com/1.0/check.json";

function isDebugEnabled() {
  return process.env.DEBUG_ANALYSIS === "true";
}

function debugLog(message) {
  if (isDebugEnabled()) {
    console.log(message);
  }
}

async function callSightengine(file) {
  const apiUser = process.env.SIGHTENGINE_API_USER;
  const apiSecret = process.env.SIGHTENGINE_API_SECRET;

  if (!apiUser || !apiSecret) {
    throw new Error("Sightengine credentials are missing");
  }

  const form = new FormData();
  form.append("models", "genai");
  form.append("api_user", apiUser);
  form.append("api_secret", apiSecret);
  form.append("media", file.buffer, {
    filename: file.originalname || "upload.jpg",
    contentType: file.mimetype || "application/octet-stream",
  });

  const response = await axios.post(SIGHTENGINE_API_URL, form, {
    headers: form.getHeaders(),
    timeout: 15000,
    maxContentLength: 8 * 1024 * 1024,
    maxBodyLength: 8 * 1024 * 1024,
  });

  const aiScore = Number(response?.data?.type?.ai_generated);
  if (!Number.isFinite(aiScore)) {
    throw new Error("Sightengine did not return ai_generated score");
  }

  debugLog(`[DEBUG][SIGHTENGINE] Raw ai_generated score: ${aiScore}`);
  return Math.max(0, Math.min(1, aiScore));
}

async function analyzeImageWithAI(file, sightengineScore) {
  try {
    if (!process.env.PUTER_API_TOKEN) {
      console.warn("[IMAGE-AI] PUTER_API_TOKEN not configured. Skipping AI analysis.");
      return null;
    }

    puter.configure({
      apiKey: process.env.PUTER_API_TOKEN,
    });

    // Convert image to base64 for AI analysis
    const base64Image = file.buffer.toString('base64');
    const mimeType = file.mimetype || 'image/jpeg';

    const prompt = `You are an expert at detecting AI-generated images vs real photographs.

SIGHTENGINE ANALYSIS:
- AI-Generated Score: ${(sightengineScore * 100).toFixed(2)}%

Please analyze this image and provide your expert assessment:
1. Does this appear to be AI-generated or a real photograph?
2. What specific visual artifacts or patterns suggest this?
3. What is your confidence level?

Consider:
- Unnatural patterns, textures, symmetry
- Lighting inconsistencies
- Facial features or anatomy issues
- Background coherence
- Text rendering quality
- Overall composition realism

Respond in JSON format:
{
  "verdict": "AI_GENERATED" or "REAL_IMAGE",
  "confidence": 0-100,
  "reasoning": "Detailed explanation of visual analysis",
  "artifacts_detected": ["artifact1", "artifact2"],
  "agreement_with_sightengine": "AGREES" or "DISAGREES"
}`;

    console.log(`\n[IMAGE-AI] Sending to AI for visual analysis...`);

    const response = await puter.ai.chat(prompt, {
      model: "claude-3.5-sonnet",
      temperature: 0.2,
    });

    const aiResponse = response.message?.content || response;

    console.log(`[IMAGE-AI] AI Response received`);

    let parsedResponse;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        return null;
      }
    } catch (parseError) {
      console.warn("[IMAGE-AI] Failed to parse AI response:", parseError.message);
      return null;
    }

    return {
      verdict: parsedResponse.verdict || "UNCERTAIN",
      confidence: parsedResponse.confidence || 50,
      reasoning: parsedResponse.reasoning || "",
      artifacts: parsedResponse.artifacts_detected || [],
      agreement: parsedResponse.agreement_with_sightengine || "UNKNOWN",
      rawResponse: aiResponse,
    };
  } catch (error) {
    console.error("[IMAGE-AI] Analysis failed:", error.message);
    return null;
  }
}

async function normalizeImageInput(input) {
  if (!input) {
    return null;
  }

  if (input.buffer && Buffer.isBuffer(input.buffer)) {
    return input;
  }

  if (typeof input === "string") {
    const filePath = input;
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimetype = ext === ".png" ? "image/png" : "image/jpeg";
    return {
      buffer,
      originalname: path.basename(filePath),
      mimetype,
    };
  }

  return null;
}

function combineAnalyses(sightengineScore, aiAnalysis) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[IMAGE-DETECTION] Combining analyses`);
  console.log('='.repeat(70));

  let finalScore;
  let status;
  let confidence;
  let explanation;

  if (!aiAnalysis) {
    // Fallback to Sightengine only
    console.log(`[IMAGE-DETECTION] Using Sightengine only (AI unavailable)`);
    finalScore = sightengineScore;
  } else {
    console.log(`[IMAGE-DETECTION] Sightengine: ${(sightengineScore * 100).toFixed(2)}%`);
    console.log(`[IMAGE-DETECTION] AI Verdict: ${aiAnalysis.verdict} (${aiAnalysis.confidence}%)`);
    console.log(`[IMAGE-DETECTION] Agreement: ${aiAnalysis.agreement}`);

    // Convert AI verdict to score
    const aiScore = aiAnalysis.verdict === "AI_GENERATED" 
      ? aiAnalysis.confidence / 100 
      : 1 - (aiAnalysis.confidence / 100);

    // Weighted average: 60% AI, 40% Sightengine
    if (aiAnalysis.agreement === "AGREES") {
      finalScore = (aiScore * 0.7) + (sightengineScore * 0.3);
      confidence = Math.min(95, Math.max(aiAnalysis.confidence, sightengineScore * 100));
    } else {
      // If they disagree, be more conservative
      finalScore = (aiScore * 0.5) + (sightengineScore * 0.5);
      confidence = Math.min(75, (aiAnalysis.confidence + sightengineScore * 100) / 2);
    }
  }

  // Determine status
  if (finalScore > 0.85) {
    status = "AI Generated";
    confidence = confidence || Math.round(finalScore * 100);
  } else if (finalScore > 0.6) {
    status = "Possibly AI Generated";
    confidence = confidence || Math.round(finalScore * 85);
  } else if (finalScore > 0.4) {
    status = "Uncertain";
    confidence = confidence || 50;
  } else {
    status = "Likely Real";
    confidence = confidence || Math.round((1 - finalScore) * 100);
  }

  const result = status === "Likely Real" || status === "Uncertain" ? "Real" : "Fake";

  // Build explanation
  if (aiAnalysis) {
    explanation = `${aiAnalysis.reasoning}\n\nSightengine AI Score: ${(sightengineScore * 100).toFixed(1)}%`;
    if (aiAnalysis.artifacts && aiAnalysis.artifacts.length > 0) {
      explanation += `\n\nDetected Artifacts: ${aiAnalysis.artifacts.join(', ')}`;
    }
  } else {
    explanation = `Analysis based on Sightengine detection. AI-generated probability: ${(finalScore * 100).toFixed(1)}%`;
  }

  console.log(`[IMAGE-DETECTION] Final Score: ${(finalScore * 100).toFixed(2)}%`);
  console.log(`[IMAGE-DETECTION] Status: ${status}`);
  console.log(`[IMAGE-DETECTION] Confidence: ${confidence}%`);
  console.log('='.repeat(70) + '\n');

  return {
    status,
    result,
    confidence,
    explanation,
    details: {
      sightengine_score: sightengineScore,
      ai_verdict: aiAnalysis?.verdict || null,
      ai_confidence: aiAnalysis?.confidence || null,
      combined_score: finalScore,
      artifacts_detected: aiAnalysis?.artifacts || [],
    },
    source: aiAnalysis ? "sightengine+ai" : "sightengine",
    sources: [],
  };
}

async function analyzeImage(input) {
  const file = await normalizeImageInput(input);
  if (!file || !file.buffer) return null;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`[IMAGE-DETECTION] Analyzing image: ${file.originalname}`);
  console.log('='.repeat(70));

  try {
    // Step 1: Get Sightengine score
    console.log(`[IMAGE-DETECTION] Step 1: Calling Sightengine API...`);
    const sightengineScore = await callSightengine(file);
    console.log(`[IMAGE-DETECTION] ✅ Sightengine score: ${(sightengineScore * 100).toFixed(2)}%`);

    // Step 2: Get AI analysis
    console.log(`[IMAGE-DETECTION] Step 2: Getting AI analysis...`);
    const aiAnalysis = await analyzeImageWithAI(file, sightengineScore);
    
    if (aiAnalysis) {
      console.log(`[IMAGE-DETECTION] ✅ AI analysis complete`);
    } else {
      console.log(`[IMAGE-DETECTION] ⚠️  AI analysis unavailable`);
    }

    // Step 3: Combine results
    return combineAnalyses(sightengineScore, aiAnalysis);

  } catch (error) {
    console.warn(`[IMAGE-DETECTION] ❌ Analysis failed: ${error.message}`);
    return {
      status: "Analysis Unavailable",
      result: null,
      confidence: 50,
      explanation: `Image analysis failed: ${error.message}. Please retry with a different image.`,
      details: { error: error.message },
      source: "error",
      sources: [],
    };
  }
}

module.exports = {
  analyzeImage,
};
