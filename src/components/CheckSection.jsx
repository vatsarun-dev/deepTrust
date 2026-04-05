import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { gsap } from "gsap";
import { useAppContext } from "../context/AppContext.jsx";

function CheckSection() {
  const sectionRef = useRef(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [requestPayload, setRequestPayload] = useState(null);
  const { analysisResult, setAnalysisResult, setLoading } = useAppContext();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

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

  useEffect(() => {
    if (!requestPayload) {
      return undefined;
    }

    setLocalLoading(true);
    setLoading(true);

    const timer = window.setTimeout(() => {
      const intensity = requestPayload.text.length % 100;
      const confidence = Math.max(67, Math.min(96, 72 + intensity / 4));

      setAnalysisResult({
        verdict: confidence > 84 ? "High manipulation risk" : "Needs deeper review",
        confidence: Math.round(confidence),
        summary:
          "Language volatility, framing density, and media context suggest coordinated amplification patterns.",
        evidence: [
          "Emotionally charged phrasing spikes beyond neutral reporting norms.",
          "Narrative framing clusters around urgency and blame assignment.",
          requestPayload.image?.[0]
            ? "Uploaded media may require forensic inspection for synthetic edits."
            : "No image attached, so visual forensics were skipped.",
        ],
      });
      setLocalLoading(false);
      setLoading(false);
      reset();
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [requestPayload, reset, setAnalysisResult, setLoading]);

  const onSubmit = (data) => {
    setRequestPayload(data);
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
            Submit a headline, post copy, or upload a suspicious image. The
            response flow simulates an AI verification engine and feeds the
            result into shared app state.
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
                required: "Text is required for analysis.",
                minLength: {
                  value: 24,
                  message: "Add a little more context so the detector has signal.",
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
              {...register("image")}
            />

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
                <p className="text-sm leading-7 text-white/68">
                  {analysisResult.summary}
                </p>
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
              </div>
            ) : (
              <div className="flex h-full min-h-[300px] items-end rounded-[1.5rem] bg-[radial-gradient(circle_at_top,_rgba(255,59,59,0.22),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.02),_rgba(255,255,255,0.01))] p-5">
                <p className="max-w-xs text-sm leading-7 text-white/55">
                  Your analysis result appears here with a confidence score,
                  summary, and evidence trail once the simulated API finishes.
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
