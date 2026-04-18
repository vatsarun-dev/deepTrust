import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { gsap } from "gsap";
import { useAppContext } from "../context/AppContext.jsx";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

async function parseResponseJsonSafe(response) {
  const rawText = await response.text();
  if (!rawText || !rawText.trim()) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function ReputationProtectorSection() {
  const sectionRef = useRef(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { reputationReport, setReputationReport } = useAppContext();
  const { register, handleSubmit, reset } = useForm();

  const badgeTone =
    reputationReport?.badge === "Trusted User"
      ? "#34d399"
      : reputationReport?.badge === "Low Credibility"
        ? "#f87171"
        : "#fbbf24";

  useEffect(() => {
    const context = gsap.context(() => {
      gsap.fromTo(
        sectionRef.current.querySelectorAll(".rep-fade"),
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 80%",
          },
        }
      );
    }, sectionRef);

    return () => context.revert();
  }, []);

  const onSubmit = async (data) => {
    setError("");
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("name", data.name || "");
      formData.append("text", data.text || "");
      formData.append("notes", data.notes || "");
      if (data.image?.[0]) {
        formData.append("image", data.image[0]);
      }

      const response = await fetch(`${API_BASE_URL}/api/reputation-check`, {
        method: "POST",
        body: formData,
      });

      const result = await parseResponseJsonSafe(response);
      if (!response.ok) {
        throw new Error(result?.message || "Reputation check failed.");
      }

      setReputationReport(result);
      reset();
    } catch (requestError) {
      setError(requestError.message || "Reputation check failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section ref={sectionRef} className="dt-section">
      <div className="grid gap-8 lg:grid-cols-[0.94fr_1.06fr]">
        <div className="space-y-5">
          <p className="rep-fade text-sm uppercase tracking-[0.35em] text-[var(--accent)]">
            Personal Reputation Protector
          </p>
          <h2 className="rep-fade text-4xl font-semibold uppercase leading-tight md:text-6xl">
            Protect a real identity against synthetic attacks and smear campaigns.
          </h2>
          <p className="rep-fade max-w-xl text-base leading-8 text-white/65">
            Store a name and reference image, then compare against suspicious content to catch
            direct targeting early and prioritize the response path.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="rep-fade rounded-[2rem] border border-white/10 bg-white/5 p-6"
          >
            <input
              type="text"
              placeholder="Protected name"
              className="mb-4 w-full rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none"
              {...register("name")}
            />
            <textarea
              rows="6"
              placeholder="Paste suspicious content mentioning this person..."
              className="mb-4 w-full rounded-[1.5rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none"
              {...register("text")}
            />
            <textarea
              rows="3"
              placeholder="Optional notes"
              className="mb-4 w-full rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none"
              {...register("notes")}
            />
            <input
              type="file"
              accept="image/*"
              className="mb-5 block w-full rounded-[1rem] border border-dashed border-white/15 bg-black/25 px-4 py-4 text-sm text-white/65"
              {...register("image")}
            />
            {error ? <p className="mb-4 text-sm text-[var(--accent)]">{error}</p> : null}
            <button type="submit" className="dt-button w-full">
              {submitting ? "Scanning..." : "Run Reputation Check"}
            </button>
          </form>

          <div className="rep-fade rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,59,59,0.08),rgba(255,255,255,0.02))] p-6">
            {reputationReport ? (
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.24em] text-white/42">Protection Status</p>
                <h3 className="text-3xl font-semibold uppercase text-white">
                  {reputationReport.riskLevel} Risk
                </h3>
                <p className="text-sm leading-7 text-white/68">{reputationReport.summary}</p>
                <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/42">Reputation Badge</p>
                  <p className="mt-3 text-3xl font-semibold" style={{ color: badgeTone }}>
                    {reputationReport.badge || "Neutral"}
                  </p>
                  <p className="mt-2 text-sm text-white/65">
                    Score {reputationReport.reputationScore ?? 50}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4 text-center">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Name Match</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {reputationReport.matchedName ? "Yes" : "No"}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4 text-center">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Impact</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {reputationReport.impactScore}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4 text-center">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Emotional</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {reputationReport.emotionalRisk}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4 text-center">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Complaints</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {reputationReport.totalComplaints ?? 0}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4 text-center">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Correct</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {reputationReport.correctComplaints ?? 0}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-white/10 bg-black/20 p-4 text-center">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/42">Incorrect</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {reputationReport.incorrectComplaints ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[320px] items-end rounded-[1.5rem] bg-[radial-gradient(circle_at_top,_rgba(255,59,59,0.18),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.02),_rgba(255,255,255,0.01))] p-5">
                <p className="max-w-xs text-sm leading-7 text-white/55">
                  Reputation scan results appear here with direct match detection, impact score,
                  and emotional harm classification.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ReputationProtectorSection;
