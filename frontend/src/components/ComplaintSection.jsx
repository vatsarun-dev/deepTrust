import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { gsap } from "gsap";
import { useAppContext } from "../context/AppContext.jsx";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";
const ISSUE_TYPES = [
  "AI Image Misuse",
  "Fake News / Defamation",
  "Harassment / Cyber Abuse",
];

async function parseResponseJsonSafe(response) {
  const rawText = await response.text();
  if (!rawText || !rawText.trim()) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

function ComplaintSection() {
  const sectionRef = useRef(null);
  const stepCardRef = useRef(null);
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [evidenceLinks, setEvidenceLinks] = useState([""]);
  const [generated, setGenerated] = useState(null);
  const { complaintDraft, setComplaintDraft, lastComplaint, setLastComplaint } = useAppContext();
  const {
    register,
    watch,
    getValues,
    trigger,
    formState: { errors },
  } = useForm({
    defaultValues: {
      issueType: "Fake News / Defamation",
      platform: "X / Twitter",
      name: "",
      email: "",
      description: "",
      evidenceDescription: "",
      incidentTimestamp: "",
      evidenceFiles: null,
    },
  });

  const watchedDescription = watch("description");
  const watchedIssueType = watch("issueType");
  const watchedPlatform = watch("platform");
  const evidenceFiles = watch("evidenceFiles");

  useEffect(() => {
    const context = gsap.context(() => {
      gsap.fromTo(
        sectionRef.current.querySelectorAll(".complaint-fade"),
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
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

  useEffect(() => {
    if (!stepCardRef.current) return;
    gsap.fromTo(stepCardRef.current, { y: 12, opacity: 0.45 }, { y: 0, opacity: 1, duration: 0.3 });
  }, [step]);

  useEffect(() => {
    if (!generated) return;
    gsap.fromTo(".complaint-result", { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 });
  }, [generated]);

  const evidencePreview = useMemo(() => {
    const links = evidenceLinks
      .map((url) => String(url || "").trim())
      .filter(Boolean)
      .map((url) => ({ sourceType: "link", fileType: "url", link: url }));
    const files = Array.from(evidenceFiles || []).map((file) => ({
      sourceType: "file",
      fileType: file.type || "application/octet-stream",
      fileName: file.name,
    }));
    return [...files, ...links];
  }, [evidenceFiles, evidenceLinks]);

  const goToStep = async (nextStep) => {
    setApiError("");
    if (nextStep <= step) {
      setStep(nextStep);
      return;
    }

    if (step === 1) {
      const ok = await trigger(["issueType", "platform"]);
      if (!ok) return;
    }
    if (step === 2) {
      const ok = await trigger(["name", "email", "description"]);
      if (!ok) return;
    }
    setStep(nextStep);
  };

  const updateLink = (index, value) => {
    setEvidenceLinks((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const addLink = () => setEvidenceLinks((prev) => [...prev, ""]);
  const removeLink = (index) =>
    setEvidenceLinks((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  const generateDraft = async () => {
    setApiError("");
    const ok = await trigger(["name", "email", "description", "issueType", "platform"]);
    if (!ok) return;

    setGenerating(true);
    try {
      const payload = {
        name: getValues("name"),
        email: getValues("email"),
        issueType: getValues("issueType"),
        platform: getValues("platform"),
        description: getValues("description"),
        evidencePreview,
      };

      const response = await fetch(`${API_BASE_URL}/api/complaint/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await parseResponseJsonSafe(response);
      if (!response.ok || !responseData?.success) {
        throw new Error(responseData?.message || `Draft generation failed (${response.status}).`);
      }

      setGenerated(responseData);
      setComplaintDraft(responseData);
      setStep(4);
    } catch (error) {
      setApiError(error.message || "Unable to generate complaint draft right now.");
    } finally {
      setGenerating(false);
    }
  };

  const onSubmitComplaint = async () => {
    setApiError("");
    if (!generated?.aiComplaint && !complaintDraft?.aiComplaint) {
      setApiError("Generate AI complaint draft before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", getValues("name"));
      formData.append("email", getValues("email"));
      formData.append("issueType", getValues("issueType"));
      formData.append("platform", getValues("platform"));
      formData.append("description", getValues("description"));

      Array.from(evidenceFiles || []).forEach((file) => {
        formData.append("evidenceFiles", file);
      });

      const cleanLinks = evidenceLinks.map((url) => String(url || "").trim()).filter(Boolean);
      formData.append("evidenceLinks", JSON.stringify(cleanLinks));
      formData.append(
        "evidenceMeta",
        JSON.stringify({
          files: Array.from(evidenceFiles || []).map(() => ({
            description: getValues("evidenceDescription"),
            timestamp: getValues("incidentTimestamp"),
            platform: getValues("platform"),
          })),
          links: cleanLinks.map(() => ({
            description: getValues("evidenceDescription"),
            timestamp: getValues("incidentTimestamp"),
            platform: getValues("platform"),
          })),
        })
      );

      const response = await fetch(`${API_BASE_URL}/api/complaint`, {
        method: "POST",
        body: formData,
      });

      const responseData = await parseResponseJsonSafe(response);
      if (!response.ok || !responseData?.success) {
        throw new Error(responseData?.message || `Complaint request failed (${response.status}).`);
      }

      setLastComplaint(responseData.complaint);
      setGenerated((prev) => ({
        ...(prev || {}),
        recommendedActions: responseData.recommendedActions || prev?.recommendedActions || [],
        aiComplaint: responseData.aiComplaint || prev?.aiComplaint,
      }));
      setStep(5);
    } catch (error) {
      setApiError(error.message || "Unable to submit complaint right now.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section ref={sectionRef} className="dt-section">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <p className="complaint-fade text-sm uppercase tracking-[0.35em] text-[var(--accent)]">
            Guided Reporting
          </p>
          <h2 className="complaint-fade text-4xl font-semibold uppercase leading-tight md:text-6xl">
            Build an evidence-backed complaint with AI assistance.
          </h2>
          <p className="complaint-fade max-w-xl text-base leading-8 text-white/65">
            This flow helps classify incident type, structure evidence, draft a formal complaint,
            and guide your next reporting actions.
          </p>
        </div>

        <div ref={stepCardRef} className="complaint-fade rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <p className="mb-4 text-sm uppercase tracking-[0.28em] text-white/55">Step {step} of 5</p>

          {step === 1 ? (
            <div className="space-y-4">
              <label className="block text-sm uppercase tracking-[0.22em] text-white/55">Issue Type</label>
              <select
                className="w-full rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none"
                {...register("issueType", { required: "Issue type is required." })}
              >
                {ISSUE_TYPES.map((type) => (
                  <option key={type} value={type} className="bg-black">
                    {type}
                  </option>
                ))}
              </select>
              {errors.issueType ? <p className="text-sm text-[var(--accent)]">{errors.issueType.message}</p> : null}

              <label className="block text-sm uppercase tracking-[0.22em] text-white/55">Platform</label>
              <input
                type="text"
                className="w-full rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none"
                placeholder="X / Twitter, Instagram, WhatsApp..."
                {...register("platform", { required: "Platform is required." })}
              />
              {errors.platform ? <p className="text-sm text-[var(--accent)]">{errors.platform.message}</p> : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm uppercase tracking-[0.22em] text-white/55">Name</label>
                  <input
                    type="text"
                    className="w-full rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none"
                    {...register("name", { required: "Name is required." })}
                  />
                  {errors.name ? <p className="mt-2 text-sm text-[var(--accent)]">{errors.name.message}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-sm uppercase tracking-[0.22em] text-white/55">Email</label>
                  <input
                    type="email"
                    className="w-full rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none"
                    {...register("email", {
                      required: "Email is required.",
                      pattern: {
                        value: /\S+@\S+\.\S+/,
                        message: "Enter a valid email address.",
                      },
                    })}
                  />
                  {errors.email ? <p className="mt-2 text-sm text-[var(--accent)]">{errors.email.message}</p> : null}
                </div>
              </div>
              <label className="block text-sm uppercase tracking-[0.22em] text-white/55">Description</label>
              <textarea
                rows="8"
                className="w-full rounded-[1.5rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none"
                placeholder="Describe what happened, where it was posted, and impact..."
                {...register("description", {
                  required: "Description is required.",
                  minLength: { value: 30, message: "Please provide more detail (minimum 30 characters)." },
                })}
              />
              {errors.description ? (
                <p className="text-sm text-[var(--accent)]">{errors.description.message}</p>
              ) : (
                <p className="text-xs text-white/45">{watchedDescription?.length || 0} characters</p>
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <label className="block text-sm uppercase tracking-[0.22em] text-white/55">Evidence Files</label>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.txt"
                className="block w-full rounded-[1rem] border border-dashed border-white/15 bg-black/25 px-4 py-4 text-sm text-white/65"
                {...register("evidenceFiles")}
              />
              <label className="block text-sm uppercase tracking-[0.22em] text-white/55">Evidence Links</label>
              {evidenceLinks.map((link, index) => (
                <div key={`link-${index}`} className="flex gap-2">
                  <input
                    type="url"
                    value={link}
                    onChange={(event) => updateLink(index, event.target.value)}
                    className="w-full rounded-[1rem] border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
                    placeholder="https://..."
                  />
                  <button
                    type="button"
                    onClick={() => removeLink(index)}
                    className="rounded-[1rem] border border-white/15 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/65"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addLink}
                className="rounded-[1rem] border border-white/15 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/65"
              >
                Add Link
              </button>
              <label className="block text-sm uppercase tracking-[0.22em] text-white/55">Evidence Notes</label>
              <textarea
                rows="3"
                className="w-full rounded-[1rem] border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
                placeholder="Short note describing why this evidence matters."
                {...register("evidenceDescription")}
              />
              <label className="block text-sm uppercase tracking-[0.22em] text-white/55">Incident Timestamp</label>
              <input
                type="datetime-local"
                className="w-full rounded-[1rem] border border-white/10 bg-black/30 px-4 py-3 text-white outline-none"
                {...register("incidentTimestamp")}
              />
            </div>
          ) : null}

          {step === 4 ? (
            <div className="complaint-result space-y-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/55">
                Classified: {generated?.complaintType || complaintDraft?.complaintType || watchedIssueType}
              </p>
              <h3 className="text-2xl font-semibold uppercase text-white">
                {generated?.aiComplaint?.title || complaintDraft?.aiComplaint?.title || "AI Complaint Draft"}
              </h3>
              <p className="rounded-[1rem] border border-white/10 bg-black/25 px-4 py-4 text-sm leading-7 text-white/78">
                {generated?.aiComplaint?.body ||
                  complaintDraft?.aiComplaint?.body ||
                  "Generate draft to preview structured complaint text."}
              </p>
              <p className="text-sm text-white/55">
                Severity: {generated?.aiComplaint?.severity || complaintDraft?.aiComplaint?.severity || "Medium"}
              </p>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="complaint-result space-y-4">
              <h3 className="text-2xl font-semibold uppercase text-white">Recommended Actions</h3>
              <ul className="space-y-2 text-sm leading-7 text-white/80">
                {(generated?.recommendedActions || complaintDraft?.recommendedActions || []).map((item, index) => (
                  <li key={`${item}-${index}`}>{index + 1}. {item}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://cybercrime.gov.in"
                  target="_blank"
                  rel="noreferrer"
                  className="dt-button"
                >
                  Report to Cyber Crime Portal
                </a>
                {lastComplaint?._id ? (
                  <a
                    href={`${API_BASE_URL}/api/complaint/${lastComplaint._id}/pdf`}
                    className="rounded-full border border-white/20 px-5 py-3 text-xs uppercase tracking-[0.24em] text-white/70"
                  >
                    Download PDF
                  </a>
                ) : null}
              </div>
              <p className="text-sm text-white/55">
                Complaint submitted for {watchedPlatform}. You can now proceed with reporting actions.
              </p>
            </div>
          ) : null}

          {apiError ? <p className="mt-4 text-sm text-[var(--accent)]">{apiError}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {step > 1 ? (
              <button
                type="button"
                className="rounded-full border border-white/15 px-5 py-3 text-xs uppercase tracking-[0.24em] text-white/70"
                onClick={() => goToStep(step - 1)}
              >
                Back
              </button>
            ) : null}

            {step < 3 ? (
              <button type="button" className="dt-button" onClick={() => goToStep(step + 1)}>
                Continue
              </button>
            ) : null}

            {step === 3 ? (
              <button type="button" className="dt-button" disabled={generating} onClick={generateDraft}>
                {generating ? "Generating..." : "Generate AI Complaint"}
              </button>
            ) : null}

            {step === 4 ? (
              <button type="button" className="dt-button" disabled={submitting} onClick={onSubmitComplaint}>
                {submitting ? "Submitting..." : "Submit Complaint"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ComplaintSection;
