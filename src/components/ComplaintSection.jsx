import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { gsap } from "gsap";

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

function ComplaintSection() {
  const sectionRef = useRef(null);
  const resetTimerRef = useRef(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

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
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const onSubmit = async (data) => {
    setSubmitting(true);
    setApiError("");

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    try {
      const payload = {
        name: String(data.name || "").trim(),
        email: String(data.email || "").trim(),
        description: String(data.description || "").trim(),
      };

      const response = await fetch(`${API_BASE_URL}/api/complaint`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await parseResponseJsonSafe(response);
      if (!response.ok) {
        throw new Error(
          responseData?.message || `Complaint request failed (${response.status}).`
        );
      }

      if (!responseData?.success) {
        throw new Error("Complaint submission failed. Please try again.");
      }

      setSubmitted(true);
      reset();
      resetTimerRef.current = window.setTimeout(() => setSubmitted(false), 2600);
    } catch (error) {
      setSubmitted(false);
      setApiError(error.message || "Unable to submit complaint right now.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section ref={sectionRef} className="dt-section">
      <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-5">
          <p className="complaint-fade text-sm uppercase tracking-[0.35em] text-[var(--accent)]">
            Escalate Harm
          </p>
          <h2 className="complaint-fade text-4xl font-semibold uppercase leading-tight md:text-6xl">
            Report harassment, coordinated abuse, or manipulated media.
          </h2>
          <p className="complaint-fade max-w-xl text-base leading-8 text-white/65">
            DeepTrust complaint flows are designed for clarity under stress. Log
            the evidence, describe the pattern, and hand the case off fast.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="complaint-fade rounded-[2rem] border border-white/10 bg-white/5 p-6"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-3 block text-sm uppercase tracking-[0.25em] text-white/55">
                Name
              </label>
              <input
                type="text"
                className="w-full rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/55"
                placeholder="Your name"
                {...register("name", { required: "Name is required." })}
              />
              {errors.name ? (
                <p className="mt-2 text-sm text-[var(--accent)]">{errors.name.message}</p>
              ) : null}
            </div>
            <div>
              <label className="mb-3 block text-sm uppercase tracking-[0.25em] text-white/55">
                Email
              </label>
              <input
                type="email"
                className="w-full rounded-[1.2rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/55"
                placeholder="name@email.com"
                {...register("email", {
                  required: "Email is required.",
                  pattern: {
                    value: /\S+@\S+\.\S+/,
                    message: "Enter a valid email address.",
                  },
                })}
              />
              {errors.email ? (
                <p className="mt-2 text-sm text-[var(--accent)]">{errors.email.message}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-3 block text-sm uppercase tracking-[0.25em] text-white/55">
              Description
            </label>
            <textarea
              rows="8"
              className="w-full rounded-[1.5rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/55"
              placeholder="Describe what happened, where it spread, and why it looks harmful or manipulated..."
              {...register("description", {
                required: "Description is required.",
                minLength: {
                  value: 30,
                  message: "Add a bit more detail so the report is useful.",
                },
              })}
            />
            {errors.description ? (
              <p className="mt-2 text-sm text-[var(--accent)]">
                {errors.description.message}
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <button type="submit" className="dt-button" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Complaint"}
            </button>
            <p className="text-sm leading-6 text-white/50">
              {apiError
                ? apiError
                : submitted
                  ? "Complaint submitted and saved to the database."
                  : "Submit your complaint and it will be stored in MongoDB."}
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}

export default ComplaintSection;
