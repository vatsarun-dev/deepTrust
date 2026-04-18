import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { gsap } from "gsap";
import { useAppContext } from "../context/AppContext.jsx";
import ExplanationModeSwitcher from "./ExplanationModeSwitcher.jsx";
import TruthBreakdown from "./TruthBreakdown.jsx";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

async function parseResponseJsonSafe(response) {
  const rawText = await response.text();
  if (!rawText || !rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function formatModelSource(source) {
  if (!source) return null;
  if (source === "multi-layer") return "Multi-AI verification layer";
  if (source === "gnews") return "GNews evidence analysis";
  if (source === "sightengine") return "Sightengine image forensics";
  if (source === "fallback") return "Fallback analysis";
  return source;
}

function extractTextSourceLinks(sources) {
  if (Array.isArray(sources)) return sources;
  if (sources && Array.isArray(sources.text)) return sources.text;
  return [];
}

function toVerdictLabel(status, result) {
  if (status === "AI Generated") return "AI Generated Image";
  if (status === "Authenticated") return "Authenticated Image";
  if (status === "Unverified") return "Unverified";
  if (result === "Fake" || status === "Fake" || status === "Misleading") {
    return "High manipulation risk";
  }
  return "Likely authentic";
}

function getConfidenceColor(verdict) {
  const normalized = String(verdict || "").trim().toLowerCase();

  if (normalized.includes("authenticated image") || normalized.includes("authentic") || normalized.includes("true")) {
    return "#34d399";
  }
  if (normalized.includes("ai generated image") || normalized.includes("ai generated")) {
    return "#f87171";
  }
  if (normalized.includes("fake") || normalized.includes("manipulation") || normalized.includes("synthetic")) {
    return "#f87171";
  }
  return "#fcd34d";
}

function isImageOnlyResult(analysisResult) {
  return Boolean(
    analysisResult?.hasImage &&
      (analysisResult?.status === "AI Generated" || analysisResult?.status === "Authenticated")
  );
}

function buildEvidenceSummary(responseData, sourceLinks, hasText, hasImage) {
  return [
    hasText ? "Claim intelligence activated." : "Text analysis skipped.",
    hasImage ? "Synthetic media forensics activated." : "Image forensics skipped.",
    responseData?.multiLayerVerification
      ? `Final confidence ${responseData.multiLayerVerification.finalConfidence}% across AI + rule scoring.`
      : null,
    responseData?.impact
      ? `Impact score ${responseData.impact.impactScore}/100 with ${responseData.impact.riskLevel} public harm risk.`
      : null,
    responseData?.emotionalRisk
      ? `Emotional damage detector flagged ${responseData.emotionalRisk} emotional risk.`
      : null,
    sourceLinks.length ? `${sourceLinks.length} linked source(s) attached to the review.` : null,
  ].filter(Boolean);
}

function CheckSection() {
  const sectionRef = useRef(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [traceLoading, setTraceLoading] = useState(false);
  const [defenseLoading, setDefenseLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [imageTraceResult, setImageTraceResult] = useState(null);
  const [lastImageFile, setLastImageFile] = useState(null);
  const {
    analysisResult,
    setAnalysisResult,
    defenseKit,
    setDefenseKit,
    explanationMode,
    setExplanationMode,
    user,
    setLoading,
  } = useAppContext();
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
    setImageTraceResult(null);
    setDefenseKit(null);

    try {
      const hasText = Boolean(data.text?.trim());
      const hasImage = Boolean(data.image?.[0]);
      const formData = new FormData();

      if (hasText) {
        formData.append("text", data.text.trim());
      }
      if (user?.name) {
        formData.append("reporterName", user.name);
      }
      if (user?.email) {
        formData.append("reporterEmail", user.email);
      }
      if (hasImage) {
        formData.append("image", data.image[0]);
        setLastImageFile(data.image[0]);
      } else {
        setLastImageFile(null);
      }

      formData.append("explanationMode", explanationMode);

      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: "POST",
        body: formData,
      });

      const responseData = await parseResponseJsonSafe(response);
      if (!response.ok) {
        throw new Error(responseData?.message || `Analysis request failed (${response.status}).`);
      }
      if (!responseData) {
        throw new Error("Backend returned an empty response.");
      }

      const sourceLinks = extractTextSourceLinks(responseData.sources);
      const verdict = toVerdictLabel(responseData.status, responseData.result);
      const isImageVerdict =
        hasImage && (responseData.status === "AI Generated" || responseData.status === "Authenticated");

      setAnalysisResult({
        claimText: data.text?.trim() || "",
        status: responseData.status,
        result: responseData.result,
        verdict,
        summary: String(responseData.explanation || "").trim(),
        source: responseData.source,
        sourceLinks: isImageVerdict ? [] : sourceLinks,
        sources: isImageVerdict ? null : responseData.sources,
        evidence: isImageVerdict ? [] : buildEvidenceSummary(responseData, sourceLinks, hasText, hasImage),
        truthBreakdown: isImageVerdict
          ? null
          : {
              ...(responseData.truthBreakdown || {}),
              reasons: responseData.reasons || [],
            },
        impact: isImageVerdict ? null : responseData.impact,
        trustScore: isImageVerdict ? null : responseData.trustScore,
        trustLabel: isImageVerdict ? null : responseData.trustLabel,
        reasons: isImageVerdict ? [] : responseData.reasons || [],
        impactLevel: isImageVerdict ? null : responseData.impactLevel,
        impactMessage: isImageVerdict ? null : responseData.impactMessage,
        reporterReputation: isImageVerdict ? null : responseData.reporterReputation,
        emotionalRisk: isImageVerdict ? null : responseData.emotionalRisk,
        emotionalSignals: isImageVerdict ? [] : responseData.emotionalSignals || [],
        explanationModes: isImageVerdict ? {} : responseData.explanationModes || {},
        multiLayerVerification: isImageVerdict ? null : responseData.multiLayerVerification,
        hasImage,
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

  const handleImageTrace = async () => {
    if (!lastImageFile) return;

    setTraceLoading(true);
    setApiError("");

    try {
      const formData = new FormData();
      formData.append("image", lastImageFile);
      formData.append("hint", analysisResult?.claimText || "");

      const response = await fetch(`${API_BASE_URL}/api/image-trace`, {
        method: "POST",
        body: formData,
      });

      const result = await parseResponseJsonSafe(response);
      if (!response.ok) {
        throw new Error(result?.message || "Reverse image trace failed.");
      }

      setImageTraceResult(result);
    } catch (error) {
      setApiError(error.message || "Reverse image trace failed.");
    } finally {
      setTraceLoading(false);
    }
  };

  const handleDefenseKit = async () => {
    if (!analysisResult) return;

    setDefenseLoading(true);
    setApiError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/defense-kit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim: analysisResult.claimText || analysisResult.verdict || "Suspicious image",
          explanation: analysisResult.summary,
          verdict: analysisResult.status || analysisResult.verdict,
          sourceLinks: analysisResult.sourceLinks,
        }),
      });

      const result = await parseResponseJsonSafe(response);
      if (!response.ok) {
        throw new Error(result?.message || "Defense kit generation failed.");
      }

      setDefenseKit(result);
    } catch (error) {
      setApiError(error.message || "Defense kit generation failed.");
    } finally {
      setDefenseLoading(false);
    }
  };

  return (
    <section ref={sectionRef} className="dt-section">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <p className="check-fade text-sm uppercase tracking-[0.35em] text-[var(--accent)]">
            Verification Command Center
          </p>
          <h2 className="check-fade text-4xl font-semibold uppercase leading-tight md:text-6xl">
            Check suspicious text or media with layered intelligence, not a single verdict.
          </h2>
          <p className="check-fade max-w-xl text-base leading-8 text-white/65">
            DeepTrust now combines evidence matching, emotional harm detection, impact scoring,
            truth decomposition, reverse trace support, and defense-kit generation in one flow.
          </p>
          <div className="check-fade">
            <ExplanationModeSwitcher value={explanationMode} onChange={setExplanationMode} />
          </div>
        </div>

        <div className="grid gap-6">
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
                  if (hasText && value.trim().length < 18) {
                    return "Add a little more context so the detector has signal.";
                  }

                  return true;
                },
              })}
            />
            {errors.text ? <p className="mb-4 text-sm text-[var(--accent)]">{errors.text.message}</p> : null}

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
            {errors.image ? <p className="mb-4 text-sm text-[var(--accent)]">{errors.image.message}</p> : null}
            {apiError ? <p className="mb-4 text-sm text-[var(--accent)]">{apiError}</p> : null}

            <button type="submit" className="dt-button w-full">
              {localLoading ? "Analyzing Signal..." : "Start Analysis"}
            </button>
          </form>

          <div className="check-fade rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,59,59,0.08),rgba(255,255,255,0.02))] p-6">
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-white/45">
              Result
            </p>
            {analysisResult ? (
              <div className="space-y-5">
                <div>
                  <p className="text-sm text-white/45">Verdict</p>
                  <h3
                    className="text-3xl font-semibold uppercase"
                    style={{ color: getConfidenceColor(analysisResult.verdict) }}
                  >
                    {analysisResult.verdict}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-white/68">{analysisResult.summary}</p>
                </div>

                {!isImageOnlyResult(analysisResult) && analysisResult.reasons?.length ? (
                  <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                    <p className="text-sm uppercase tracking-[0.24em] text-white/45">Why This Result</p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-white/75">
                      {analysisResult.reasons.map((reason) => (
                        <li key={reason}>• {reason}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {!isImageOnlyResult(analysisResult) && analysisResult.source ? (
                  <div>
                    <p className="text-sm text-white/45">Primary Source</p>
                    <p className="text-sm uppercase tracking-[0.24em] text-white/72">
                      {formatModelSource(analysisResult.source)}
                    </p>
                  </div>
                ) : null}

                {!isImageOnlyResult(analysisResult) ? (
                  <TruthBreakdown breakdown={analysisResult.truthBreakdown} />
                ) : null}

                {!isImageOnlyResult(analysisResult) && analysisResult.sourceLinks?.length ? (
                  <div className="space-y-2">
                    <p className="text-sm uppercase tracking-[0.24em] text-white/45">Linked Evidence</p>
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

                {!isImageOnlyResult(analysisResult) ? (
                <div className="space-y-3">
                  {analysisResult.evidence.map((item) => (
                    <div
                      key={item}
                      className="rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white/68"
                    >
                      {item}
                    </div>
                  ))}
                </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button type="button" className="dt-button" onClick={handleDefenseKit}>
                    {defenseLoading ? "Generating..." : "Generate Defense Kit"}
                  </button>
                  {analysisResult.hasImage ? (
                    <button type="button" className="dt-button-muted" onClick={handleImageTrace}>
                      {traceLoading ? "Tracing..." : "Reverse Image Trace"}
                    </button>
                  ) : null}
                </div>

                {defenseKit ? (
                  <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/42">Auto Defense Kit</p>
                    <p className="text-sm leading-7 text-white/74">{defenseKit.evidenceSummary}</p>
                    <p className="rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-white/78">
                      {defenseKit.complaintText}
                    </p>
                    <div className="space-y-2 text-sm text-white/72">
                      {defenseKit.actions?.map((item, index) => (
                        <p key={`${item}-${index}`}>{index + 1}. {item}</p>
                      ))}
                    </div>
                  </div>
                ) : null}

                {imageTraceResult ? (
                  <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/42">Reverse Image Trace</p>
                    <p className="text-sm leading-7 text-white/68">{imageTraceResult.note}</p>
                    <p className="text-xs uppercase tracking-[0.22em] text-white/55">
                      Keywords: {imageTraceResult.keywords?.join(", ")}
                    </p>
                    <div className="space-y-2">
                      {imageTraceResult.similarResults?.map((item) => (
                        <a
                          key={item.url}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75"
                        >
                          {item.title || item.url}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex h-full min-h-[300px] items-end rounded-[1.5rem] bg-[radial-gradient(circle_at_top,_rgba(255,59,59,0.22),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.02),_rgba(255,255,255,0.01))] p-5">
                <p className="max-w-xs text-sm leading-7 text-white/55">
                  Your analysis result appears here with a clear image verdict and explanation once verification finishes.
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
