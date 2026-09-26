import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { gsap } from "gsap";
import { useAppContext } from "../context/AppContext.jsx";
import ExplanationModeSwitcher from "./ExplanationModeSwitcher.jsx";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

function label(value) {
  return String(value || "n/a").replace(/_/g, " ");
}

function confidenceColor(value) {
  const verdict = String(value || "").toLowerCase();
  if (verdict.includes("true") || verdict.includes("authentic")) return "#34d399";
  if (verdict.includes("false") || verdict.includes("generated")) return "#f87171";
  return "#fcd34d";
}

async function jsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isImage(file) {
  return String(file?.type || "").startsWith("image/");
}

function fileSize(bytes) {
  if (!Number.isFinite(bytes)) return "";
  return `${(bytes / 1024 / 1024).toFixed(bytes > 1024 * 1024 ? 1 : 2)} MB`;
}

function EvidenceList({ items, title }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.24em] text-white/45">{title}</p>
      {items.map((item) => (
        <a
          key={`${item.id}-${item.url}`}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75 transition hover:bg-white/5"
        >
          <span className="block font-medium text-white">{item.title}</span>
          <span className="mt-1 block text-xs text-white/50">
            {item.sourceName} · {item.publishedAt || "date unavailable"} · {label(item.sourceQuality)} quality · relevance {Math.round((item.relevanceScore || 0) * 100)}%
          </span>
        </a>
      ))}
    </div>
  );
}

function CheckSection() {
  const sectionRef = useRef(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [traceLoading, setTraceLoading] = useState(false);
  const [defenseLoading, setDefenseLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [lastMediaFile, setLastMediaFile] = useState(null);
  const [imageTraceResult, setImageTraceResult] = useState(null);
  const {
    analysisResult,
    setAnalysisResult,
    defenseKit,
    setDefenseKit,
    explanationMode,
    setExplanationMode,
    setLoading,
  } = useAppContext();
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();
  const mediaFiles = watch("media");
  const mediaRegistration = register("media", {
    validate: (files) => {
      if (!watch("text")?.trim() && !files?.length) return "Add a claim or upload media to analyze.";
      return true;
    },
  });

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
          scrollTrigger: { trigger: sectionRef.current, start: "top 78%" },
        },
      );
    }, sectionRef);
    return () => context.revert();
  }, []);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const setPreview = (file) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setLastMediaFile(file || null);
    setPreviewUrl(file ? URL.createObjectURL(file) : "");
  };

  const onSubmit = async (data) => {
    const text = data.text?.trim() || "";
    const media = data.media?.[0] || null;
    setApiError("");
    setImageTraceResult(null);
    setDefenseKit(null);
    setLocalLoading(true);
    setLoading(true);

    try {
      const formData = new FormData();
      if (text) formData.append("text", text);
      if (media) formData.append("media", media);
      formData.append("explanationMode", explanationMode);

      const response = await fetch(`${API_BASE_URL}/api/analyze`, { method: "POST", body: formData });
      const result = await jsonResponse(response);
      if (!response.ok) throw new Error(result?.message || `Analysis request failed (${response.status}).`);
      if (!result) {
        throw new Error(
          "The verification service returned an invalid response. Ensure the backend is running and VITE_API_URL points to it.",
        );
      }
      if (!result.success || !result.claimVerification) {
        throw new Error(result.message || "The verification service returned an incomplete result.");
      }

      setAnalysisResult({ ...result, claimText: text, hasMedia: Boolean(media), hasImage: isImage(media) });
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
    if (!lastMediaFile || !isImage(lastMediaFile)) return;
    setTraceLoading(true);
    setApiError("");
    try {
      const formData = new FormData();
      formData.append("image", lastMediaFile);
      formData.append("hint", analysisResult?.claimText || "");
      const response = await fetch(`${API_BASE_URL}/api/image-trace`, { method: "POST", body: formData });
      const result = await jsonResponse(response);
      if (!response.ok) throw new Error(result?.message || "Related web search failed.");
      setImageTraceResult(result);
    } catch (error) {
      setApiError(error.message || "Related web search failed.");
    } finally {
      setTraceLoading(false);
    }
  };

  const handleDefenseKit = async () => {
    const claim = analysisResult?.claimVerification;
    if (!analysisResult || !claim) return;
    setDefenseLoading(true);
    setApiError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/defense-kit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim: analysisResult.claimText,
          explanation: claim.summary,
          verdict: claim.verdict,
          sourceLinks: claim.evidence || [],
        }),
      });
      const result = await jsonResponse(response);
      if (!response.ok) throw new Error(result?.message || "Defense kit generation failed.");
      setDefenseKit(result);
    } catch (error) {
      setApiError(error.message || "Defense kit generation failed.");
    } finally {
      setDefenseLoading(false);
    }
  };

  const claim = analysisResult?.claimVerification;
  const media = analysisResult?.mediaVerification;
  const isGeneralAnswer = ["direct", "rag", "researched", "web_research", "research"].includes(claim?.mode);
  const isAgentUnavailable = claim?.mode === "unavailable";
  const claimHeading = isGeneralAnswer ? "AI answer" : isAgentUnavailable ? "AI service" : "Claim verification";
  const claimStatus = isGeneralAnswer
    ? claim?.mode === "direct" ? "Direct answer" : "Researched answer"
    : isAgentUnavailable ? "AI unavailable" : label(claim?.verdict);
  const claimSummary = isGeneralAnswer ? (analysisResult?.answer || claim?.summary) : claim?.summary;

  return (
    <section ref={sectionRef} className="dt-section">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <p className="check-fade text-sm uppercase tracking-[0.35em] text-[var(--accent)]">Verification Command Center</p>
          <h2 className="check-fade text-4xl font-semibold uppercase leading-tight md:text-6xl">
            Verify a claim, the media, and whether the media supports the claim.
          </h2>
          <p className="check-fade max-w-xl text-base leading-8 text-white/65">
            Evidence is retrieved and ranked before grounded reasoning. Media forensics stays separate from claim verification.
          </p>
          <div className="check-fade"><ExplanationModeSwitcher value={explanationMode} onChange={setExplanationMode} /></div>
        </div>

        <div className="grid gap-6">
          <form onSubmit={handleSubmit(onSubmit)} className="check-fade rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <label className="mb-3 block text-sm uppercase tracking-[0.25em] text-white/55">Claim or caption</label>
            <textarea
              rows="6"
              className="mb-4 w-full rounded-[1.5rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/55"
              placeholder="Paste the headline, caption, or statement to verify..."
              {...register("text", {
                validate: (value) => {
                  if (!value?.trim() && !mediaFiles?.length) return "Add a claim or upload media to analyze.";
                  if (value?.trim() && value.trim().length < 12) return "Add more context so evidence can be retrieved accurately.";
                  return true;
                },
              })}
            />
            {errors.text ? <p className="mb-4 text-sm text-[var(--accent)]">{errors.text.message}</p> : null}

            <label className="mb-3 block text-sm uppercase tracking-[0.25em] text-white/55">Upload image or video</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              className="mb-3 block w-full rounded-[1rem] border border-dashed border-white/15 bg-black/25 px-4 py-4 text-sm text-white/60 file:mr-4 file:rounded-full file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:text-white"
              {...mediaRegistration}
              onChange={(event) => {
                mediaRegistration.onChange(event);
                setPreview(event.target.files?.[0]);
              }}
            />
            <p className="mb-4 text-xs leading-5 text-white/45">JPG, PNG, WebP, GIF, MP4, WebM, or MOV. Maximum 100 MB.</p>
            {previewUrl && lastMediaFile ? (
              <div className="mb-5 rounded-[1rem] border border-white/10 bg-black/20 p-3">
                {isImage(lastMediaFile) ? (
                  <img src={previewUrl} alt="Selected upload preview" className="max-h-48 w-full rounded-[0.7rem] object-contain" />
                ) : (
                  <video src={previewUrl} controls className="max-h-48 w-full rounded-[0.7rem]" />
                )}
                <p className="mt-2 text-xs text-white/55">{lastMediaFile.name} · {fileSize(lastMediaFile.size)}</p>
              </div>
            ) : null}
            {errors.media ? <p className="mb-4 text-sm text-[var(--accent)]">{errors.media.message}</p> : null}
            {apiError ? <p className="mb-4 text-sm text-[var(--accent)]">{apiError}</p> : null}
            <button type="submit" className="dt-button w-full">{localLoading ? "Verifying evidence..." : "Start verification"}</button>
          </form>

          <div className="check-fade rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,59,59,0.08),rgba(255,255,255,0.02))] p-6">
            <p className="mb-4 text-sm uppercase tracking-[0.3em] text-white/45">Result</p>
            {analysisResult ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">{claimHeading}</p>
                    <p className="mt-2 text-2xl font-semibold uppercase" style={{ color: confidenceColor(isGeneralAnswer ? "true" : claim?.verdict) }}>{claimStatus}</p>
                    <p className="mt-3 text-sm leading-6 text-white/70">{claimSummary}</p>
                    {claim?.confidence !== null && claim?.confidence !== undefined ? <p className="mt-3 text-xs text-white/48">Evidence-strength estimate: {claim.confidence}%</p> : null}
                  </div>
                  <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-white/45">AI media detection</p>
                    <p className="mt-2 text-2xl font-semibold uppercase" style={{ color: confidenceColor(media?.syntheticMedia?.status) }}>{media ? label(media.syntheticMedia?.status) : "Not analyzed"}</p>
                    <p className="mt-3 text-sm leading-6 text-white/70">{media?.explanation || "No media was submitted."}</p>
                    {media?.syntheticMedia?.confidence !== null && media?.syntheticMedia?.confidence !== undefined ? <p className="mt-3 text-xs text-white/48">Provider score: {media.syntheticMedia.confidence}%</p> : null}
                  </div>
                </div>

                <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/45">Claim ↔ media consistency</p>
                  <p className="mt-2 text-lg font-semibold uppercase text-white">{label(analysisResult.claimMediaConsistency?.status)}</p>
                  <p className="mt-2 text-sm leading-6 text-white/70">{analysisResult.claimMediaConsistency?.reason}</p>
                </div>

                {media?.url ? <a href={media.url} target="_blank" rel="noreferrer" className="text-sm text-[var(--accent)] underline">Open securely stored media</a> : null}
                {media?.uploadError ? <p className="text-xs text-white/45">Media storage: {media.uploadError}</p> : null}

                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/45">Why?</p>
                  <p className="mt-2 text-sm leading-7 text-white/74">{analysisResult.explanation?.text}</p>
                </div>

                {claim?.claimBreakdown?.length ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">Claim breakdown</p>
                    {claim.claimBreakdown.map((item, index) => <div key={`${item.claim}-${index}`} className="rounded-[1rem] border border-white/10 bg-black/20 p-3 text-sm text-white/70"><span className="font-medium text-white">{label(item.verdict)}:</span> {item.claim} {item.reason ? `— ${item.reason}` : ""}</div>)}
                  </div>
                ) : null}

                <EvidenceList title="Evidence" items={claim?.evidence} />

                {claim?.uncertainties?.length ? <div><p className="text-xs uppercase tracking-[0.24em] text-white/45">Uncertainties</p><p className="mt-2 text-sm leading-6 text-white/65">{claim.uncertainties.join(" ")}</p></div> : null}
                {analysisResult.nextSteps?.length ? <div className="space-y-2"><p className="text-xs uppercase tracking-[0.24em] text-white/45">What should I do next?</p>{analysisResult.nextSteps.map((step, index) => <p key={`${step}-${index}`} className="text-sm leading-6 text-white/72">{index + 1}. {step}</p>)}</div> : null}

                <div className="flex flex-wrap gap-3">
                  <button type="button" className="dt-button" onClick={handleDefenseKit}>{defenseLoading ? "Generating..." : "Generate defense kit"}</button>
                  {analysisResult.hasImage ? <button type="button" className="dt-button-muted" onClick={handleImageTrace}>{traceLoading ? "Searching..." : "Related web search"}</button> : null}
                </div>

                {defenseKit ? <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-5"><p className="text-xs uppercase tracking-[0.24em] text-white/42">Defense kit</p><p className="text-sm leading-7 text-white/74">{defenseKit.evidenceSummary}</p><p className="rounded-[1rem] border border-white/10 bg-white/5 p-4 text-sm leading-7 text-white/78">{defenseKit.complaintText}</p>{defenseKit.actions?.map((item, index) => <p key={`${item}-${index}`} className="text-sm text-white/72">{index + 1}. {item}</p>)}</div> : null}
                {imageTraceResult ? <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-5"><p className="text-xs uppercase tracking-[0.24em] text-white/42">Related web search</p><p className="text-sm leading-7 text-white/68">{imageTraceResult.note}</p>{imageTraceResult.similarResults?.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="block rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">{item.title || item.url}</a>)}</div> : null}
              </div>
            ) : <p className="min-h-[260px] pt-48 text-sm leading-7 text-white/55">The verification result will show separate claim evidence, media-forensics status, and their relationship.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

export default CheckSection;
