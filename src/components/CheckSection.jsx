import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { gsap } from "gsap";
import { useAppContext } from "../context/AppContext.jsx";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

function formatModelSource(source) {
  if (!source) return null;
  if (source === "puter-js") return "Puter.js (GPT-5.4 Nano)";
  if (source === "puter-js+gnews") return "Puter.js + GNews evidence";
  if (source === "gnews") return "GNews evidence analysis";
  if (source === "sightengine") return "Sightengine image forensics";
  if (source === "fallback") return "Local fallback analysis";
  return source;
}

function extractTextSourceLinks(sources) {
  if (Array.isArray(sources)) {
    return sources;
  }
  if (sources && Array.isArray(sources.text)) {
    return sources.text;
  }
  return [];
}

function mapStatusToResult(status) {
  if (status === "True" || status === "Likely True") return "Real";
  if (status === "Unverified") return null;
  return "Fake";
}

function toVerdictLabel(status, result) {
  if (status === "Unverified") return "Unverified";
  if (result === "Fake" || status === "Fake" || status === "Misleading") {
    return "High manipulation risk";
  }
  return "Likely authentic";
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
    "* Analyze the claim based ONLY on the provided news articles",
    "* Do NOT assume facts beyond given data",
    '* If no strong evidence exists -> return "Unverified"',
    "",
    "Return STRICT JSON:",
    "{",
    '"status": "True / Likely True / Misleading / Fake / Unverified",',
    '"confidence": number (0-100),',
    '"explanation": "clear reasoning based on news evidence"',
    "}",
  ].join("\n");
}

async function analyzeTextWithPuter(claim, sources) {
  const puterClient = window?.puter;
  if (!puterClient?.ai?.chat) {
    throw new Error("Puter SDK is not available");
  }

  const prompt = buildPuterPrompt(claim, sources);
  const raw = await puterClient.ai.chat(prompt, { model: "gpt-5.4-nano" });
  const rawText = extractPuterText(raw);
  const parsed = parsePuterJson(rawText);

  const status = normalizeStatus(parsed?.status);
  return {
    status,
    result: mapStatusToResult(status),
    confidence: clampConfidence(parsed?.confidence, 55),
    explanation:
      String(parsed?.explanation || "").trim() ||
      "Client-side AI could not provide a full explanation from the available evidence.",
  };
}

function CheckSection() {
  const sectionRef = useRef(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const { analysisResult, setAnalysisResult, setLoading } = useAppContext();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm();
  const imageFiles = watch("image");

  useEffect(() => {
    const context = gsap.context(() => {
      gsap.fromTo(
        sectionRef.current.querySelectorAll(".check-fade"),
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 78%",
          },
        }
      );
    }, sectionRef);

    return () => context.revert();
  }, []);

  const onSubmit = async (data) => {
    setApiError("");
    setLocalLoading(true);
    setLoading(true);

    try {
      const hasText = Boolean(data.text?.trim());
      const hasImage = Boolean(data.image?.[0]);
      const formData = new FormData();

      if (hasText) {
        formData.append("text", data.text.trim());
      }
      if (hasImage) {
        formData.append("image", data.image[0]);
      }

      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: "POST",
        body: formData,
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.message || "Analysis request failed.");
      }

      const sourceLinks = extractTextSourceLinks(responseData.sources);
      let finalStatus = responseData.status || "Unverified";
      let finalResult = responseData.result ?? mapStatusToResult(finalStatus);
      let finalConfidence = clampConfidence(responseData.confidence, 50);
      let finalExplanation =
        String(responseData.explanation || "").trim() || "Unable to build an explanation from backend response.";
      let finalSource = responseData.source || null;
      let puterNote = null;

      if (hasText) {
        try {
          const puterResult = await analyzeTextWithPuter(data.text.trim(), sourceLinks);

          if (!hasImage) {
            finalStatus = puterResult.status;
            finalResult = puterResult.result;
            finalConfidence = puterResult.confidence;
            finalExplanation = puterResult.explanation;
          } else {
            puterNote = `Client text reasoning (Puter.js): ${puterResult.explanation}`;
          }

          finalSource = hasImage ? `${responseData.source || "backend"} + puter-js` : "puter-js+gnews";
        } catch (puterError) {
          puterNote = `Client AI reasoning unavailable: ${puterError.message}`;
        }
      }

      const sourceSummary = {
        text: sourceLinks.length ? `${sourceLinks.length} linked article(s)` : "n/a",
        image: hasImage ? responseData.source || "sightengine" : "n/a",
      };

      setAnalysisResult({
        verdict: toVerdictLabel(finalStatus, finalResult),
        confidence: finalConfidence,
        summary: finalExplanation,
        source: finalSource,
        sources: sourceSummary,
        sourceLinks,
        evidence: [
          hasText
            ? "Text analysis completed using GNews evidence + Puter.js reasoning."
            : "No text was provided, so language analysis was skipped.",
          hasImage
            ? "Image inspection completed using backend media forensics."
            : "No image was uploaded, so media forensics were skipped.",
          `Backend status: ${responseData.status || "n/a"} with ${clampConfidence(responseData.confidence, 0)}% confidence.`,
          puterNote,
          finalSource ? `Primary model source: ${formatModelSource(finalSource)}.` : null,
        ],
      });

      reset();
    } catch (error) {
      setApiError(error.message || "Unable to analyze content right now.");
      setAnalysisResult(null);
    } finally {
      setLocalLoading(false);
      setLoading(false);
    }
  };

  return (
    <section ref={sectionRef} className="dt-section">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <p className="check-fade text-sm uppercase tracking-[0.35em] text-[var(--accent)]">
            Instant Verification
          </p>
          <h2 className="check-fade text-4xl font-semibold uppercase leading-tight md:text-6xl">
            Check suspicious text or media before it spreads.
          </h2>
          <p className="check-fade max-w-xl text-base leading-8 text-white/65">
            Text verification now uses GNews evidence from the backend plus client-side
            reasoning with Puter.js. Image forensics still run through the backend.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="check-fade rounded-[2rem] border border-white/10 bg-white/5 p-6"
          >
            <label className="mb-3 block text-sm uppercase tracking-[0.25em] text-white/55">
              Suspicious Text
            </label>
            <textarea
              rows="7"
              className="mb-4 w-full rounded-[1.5rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/55"
              placeholder="Paste the headline, caption, or excerpt you want DeepTrust to inspect..."
              {...register("text", {
                validate: (value) => {
                  const hasText = Boolean(value?.trim());
                  const hasImage = Boolean(imageFiles?.length);

                  if (!hasText && !hasImage) {
                    return "Add suspicious text or upload an image to analyze.";
                  }

                  if (hasText && value.trim().length < 24) {
                    return "Add a little more context so the detector has signal.";
                  }

                  return true;
                },
              })}
            />
            {errors.text ? (
              <p className="mb-4 text-sm text-[var(--accent)]">{errors.text.message}</p>
            ) : null}

            <label className="mb-3 block text-sm uppercase tracking-[0.25em] text-white/55">
              Upload Image
            </label>
            <input
              type="file"
              accept="image/*"
              className="mb-6 block w-full rounded-[1rem] border border-dashed border-white/15 bg-black/25 px-4 py-4 text-sm text-white/60 file:mr-4 file:rounded-full file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:text-white"
              {...register("image", {
                validate: (files) => {
                  const hasText = Boolean(watch("text")?.trim());
                  const hasImage = Boolean(files?.length);

                  if (!hasText && !hasImage) {
                    return "Add suspicious text or upload an image to analyze.";
                  }

                  return true;
                },
              })}
            />
            {errors.image ? (
              <p className="mb-4 text-sm text-[var(--accent)]">{errors.image.message}</p>
            ) : null}
            {apiError ? (
              <p className="mb-4 text-sm text-[var(--accent)]">{apiError}</p>
            ) : null}

            <button type="submit" className="dt-button w-full">
              {localLoading ? "Analyzing Signal..." : "Start Analysis"}
            </button>
          </form>

          <div className="check-fade rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,59,59,0.08),rgba(255,255,255,0.02))] p-6">
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-white/45">
              Result
            </p>
            {analysisResult ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-white/45">Verdict</p>
                  <h3 className="text-2xl font-semibold uppercase text-white">
                    {analysisResult.verdict}
                  </h3>
                </div>
                <div>
                  <p className="text-sm text-white/45">Confidence</p>
                  <p className="text-5xl font-semibold text-[var(--accent)]">
                    {analysisResult.confidence}%
                  </p>
                </div>
                {analysisResult.source ? (
                  <div>
                    <p className="text-sm text-white/45">Analysis Source</p>
                    <p className="text-sm uppercase tracking-[0.24em] text-white/72">
                      {formatModelSource(analysisResult.source)}
                    </p>
                  </div>
                ) : null}
                {analysisResult.sources ? (
                  <div>
                    <p className="text-sm text-white/45">Analysis Sources</p>
                    <p className="text-sm uppercase tracking-[0.24em] text-white/72">
                      Text: {analysisResult.sources.text || "n/a"} | Image:{" "}
                      {analysisResult.sources.image || "n/a"}
                    </p>
                  </div>
                ) : null}
                {analysisResult.sourceLinks?.length ? (
                  <div className="space-y-2">
                    {analysisResult.sourceLinks.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-[1rem] border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75 underline-offset-2 hover:underline"
                      >
                        {link.title || link.url}
                      </a>
                    ))}
                  </div>
                ) : null}
                <p className="text-sm leading-7 text-white/68">{analysisResult.summary}</p>
                <div className="space-y-3">
                  {analysisResult.evidence.filter(Boolean).map((item) => (
                    <div
                      key={item}
                      className="rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white/68"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[300px] items-end rounded-[1.5rem] bg-[radial-gradient(circle_at_top,_rgba(255,59,59,0.22),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.02),_rgba(255,255,255,0.01))] p-5">
                <p className="max-w-xs text-sm leading-7 text-white/55">
                  Your analysis result appears here with a confidence score,
                  summary, and evidence trail once the live analysis finishes.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default CheckSection;
