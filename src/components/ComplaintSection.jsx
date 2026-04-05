import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { gsap } from "gsap";

function ComplaintSection() {
  const sectionRef = useRef(null);
  const resetTimerRef = useRef(null);
  const [submitted, setSubmitted] = useState(false);
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

  const onSubmit = (data) => {
    console.log("DeepTrust complaint submission", data);
    setSubmitted(true);
    reset();
    resetTimerRef.current = window.setTimeout(() => setSubmitted(false), 2600);
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
            <button type="submit" className="dt-button">
              Submit Complaint
            </button>
            <p className="text-sm leading-6 text-white/50">
              {submitted
                ? "Complaint staged successfully. Mock API received the payload."
                : "Submissions currently log to console and simulate a reporting pipeline."}
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}

export default ComplaintSection;
