const puter = require("@heyputer/puter.js");

const AI_SYSTEM_PROMPT = `You are a sports and world events expert AI with comprehensive knowledge.

STRICT RULES:
1. NEVER say "no articles", "cannot verify", "no sources", "unverified"
2. You HAVE full knowledge: IPL, Cricket, Football, World Cup, Olympics, Elections, Major Events
3. For questions: Answer TRUE or FALSE (never "unverified")
4. Use your training data - you know sports results, world events, history
5. If uncertain, make educated guess based on logic

KNOWLEDGE YOU HAVE:
- All IPL winners (2008-2024)
- FIFA World Cup results
- Cricket World Cup results  
- Major sports events
- Historical facts
- Current events until your training cutoff

OUTPUT FORMAT:
{
  "verdict": "TRUE" or "FALSE" (NEVER "UNVERIFIED"),
  "confidence": 85-98,
  "reasoning": "Yes/No. [Complete answer with dates, facts, details]",
  "key_facts": ["fact1", "fact2", "fact3"],
  "red_flags": [],
  "sources_assessment": "Based on comprehensive knowledge database"
}

EXAMPLES:

Q: "Did CSK win IPL 2021?"
A: {"verdict":"TRUE","confidence":95,"reasoning":"Yes. Chennai Super Kings won IPL 2021. The final was held on October 15, 2021, in Dubai where CSK defeated Kolkata Knight Riders by 27 runs. MS Dhoni captained the team to their 4th IPL title.","key_facts":["CSK won IPL 2021 on October 15, 2021","Beat KKR by 27 runs in Dubai final","MS Dhoni captain, 4th title for CSK"],"red_flags":[],"sources_assessment":"Direct knowledge from sports database"}

Q: "Did Argentina win FIFA World Cup 2022?"
A: {"verdict":"TRUE","confidence":98,"reasoning":"Yes. Argentina won the 2022 FIFA World Cup in Qatar. The final was on December 18, 2022, where they defeated France 4-2 on penalties after a 3-3 draw. Lionel Messi finally won his first World Cup.","key_facts":["Argentina won FIFA World Cup 2022 in Qatar","Beat France 4-2 on penalties December 18, 2022","Messi's first World Cup victory"],"red_flags":[],"sources_assessment":"Direct knowledge from sports database"}

Q: "The Earth is flat?"
A: {"verdict":"FALSE","confidence":99,"reasoning":"No. The Earth is not flat. It is an oblate spheroid (slightly flattened sphere). This has been proven through satellite imagery, physics, circumnavigation, and scientific observation for centuries.","key_facts":["Earth is oblate spheroid shape","Proven by satellites and science","Flat Earth debunked scientifically"],"red_flags":["Conspiracy theory","Anti-science claim"],"sources_assessment":"Scientific consensus and evidence"}

ANSWER WITH CONFIDENCE - You know these facts!`;

function buildAdvancedPrompt(claimText, newsArticles = []) {
  let prompt = `QUESTION: "${claimText}"\n\n`;
  
  prompt += `YOUR TASK:\n`;
  prompt += `Answer this using YOUR KNOWLEDGE BASE.\n`;
  prompt += `You know: IPL winners, World Cup results, major events, sports, history.\n\n`;

  if (newsArticles && newsArticles.length > 0) {
    prompt += `ADDITIONAL CONTEXT FROM NEWS:\n\n`;
    newsArticles.forEach((article, idx) => {
      prompt += `${idx + 1}. ${article.title}\n`;
      prompt += `   ${article.description}\n\n`;
    });
    prompt += `Use this as supporting evidence.\n\n`;
  }
  
  prompt += `RULES:\n`;
  prompt += `- Answer TRUE or FALSE (never "unverified")\n`;
  prompt += `- Start reasoning with "Yes" or "No"\n`;
  prompt += `- Include specific facts: dates, scores, names\n`;
  prompt += `- Confidence: 90-98 for known facts\n`;
  prompt += `- Use your training data\n\n`;

  prompt += `RESPOND IN JSON:\n`;
  prompt += `{"verdict":"TRUE","confidence":95,"reasoning":"Yes. [answer with facts]","key_facts":["fact1","fact2"],"red_flags":[],"sources_assessment":"Knowledge database"}\n\n`;
  
  prompt += `ANSWER NOW:`;

  return prompt;
}

async function analyzeWithAI(claimText, newsArticles = []) {
  try {
    if (!process.env.PUTER_API_TOKEN) {
      console.warn("PUTER_API_TOKEN not configured. Skipping AI analysis.");
      return null;
    }

    puter.configure({
      apiKey: process.env.PUTER_API_TOKEN,
    });

    const advancedPrompt = buildAdvancedPrompt(claimText, newsArticles);

    console.log("\n" + "=".repeat(60));
    console.log("[AI] Sending to Puter AI:");
    console.log("=".repeat(60));
    console.log(`Query: "${claimText}"`);
    console.log(`GNews Articles: ${newsArticles.length}`);
    if (newsArticles.length > 0) {
      newsArticles.forEach((a, i) => console.log(`  ${i+1}. ${a.title}`));
    }
    console.log("=".repeat(60) + "\n");

    const response = await puter.ai.chat(advancedPrompt, {
      model: "claude-3.5-sonnet",
      systemMessage: AI_SYSTEM_PROMPT,
      temperature: 0.3,
    });

    const aiResponse = response.message?.content || response;

    console.log("\n" + "=".repeat(60));
    console.log("[AI] Response received:");
    console.log("=".repeat(60));
    console.log(aiResponse.substring(0, 300) + "...");
    console.log("=".repeat(60) + "\n");

    let parsedResponse;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        parsedResponse = {
          verdict: "UNVERIFIED",
          confidence: 50,
          reasoning: aiResponse,
          key_facts: [],
          red_flags: [],
          sources_assessment: "Unable to parse structured response",
        };
      }
    } catch (parseError) {
      console.warn("[AI] Failed to parse AI response as JSON:", parseError.message);
      parsedResponse = {
        verdict: "UNVERIFIED",
        confidence: 50,
        reasoning: aiResponse,
        key_facts: [],
        red_flags: [],
        sources_assessment: "Response format issue",
      };
    }

    return {
      verdict: parsedResponse.verdict || "UNVERIFIED",
      confidence: Math.min(100, Math.max(0, parsedResponse.confidence || 50)),
      reasoning: parsedResponse.reasoning || "",
      keyFacts: parsedResponse.key_facts || [],
      redFlags: parsedResponse.red_flags || [],
      sourcesAssessment: parsedResponse.sources_assessment || "",
      rawResponse: aiResponse,
    };
  } catch (error) {
    console.error("[AI] Analysis failed:", error.message);
    return null;
  }
}

function mapVerdictToStatus(verdict, confidence) {
  const v = String(verdict || "").toUpperCase();
  
  if (v === "TRUE") {
    return confidence >= 75 ? "True" : "Likely True";
  }
  if (v === "FALSE") {
    return confidence >= 75 ? "Fake" : "Likely Fake";
  }
  if (v === "MISLEADING") {
    return "Misleading";
  }
  return "Unverified";
}

function mapVerdictToResult(verdict) {
  const v = String(verdict || "").toUpperCase();
  if (v === "TRUE") return "Real";
  if (v === "FALSE" || v === "MISLEADING") return "Fake";
  return null;
}

module.exports = {
  analyzeWithAI,
  mapVerdictToStatus,
  mapVerdictToResult,
  buildAdvancedPrompt,
};
