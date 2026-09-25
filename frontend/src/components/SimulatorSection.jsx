import { useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";

const DEFAULT_CLAIM =
  "A manipulated celebrity image goes viral with a false health warning attached to it.";

function buildSimulation(claim) {
  const text = String(claim || "").trim();
  const intensity = /\b(viral|breaking|urgent|warning|exposed|secret)\b/i.test(text) ? "High" : "Medium";

  return [
    {
      title: "Injection",
      description: "A crafted headline or image is framed to trigger urgency, outrage, or tribal reaction.",
      signal: intensity,
    },
    {
      title: "Amplification",
      description: "Screenshots, repost chains, and creator commentary convert the claim into social proof.",
      signal: text.length > 80 ? "Layered" : "Fast",
    },
    {
      title: "Detection",
      description: "DeepTrust compares evidence coverage, synthetic media signals, harm scoring, and emotional risk.",
      signal: "Multi-AI",
    },
    {
      title: "Response",
      description: "Truth breakdown, defense kit actions, and complaint readiness shorten the time to intervention.",
      signal: "Actionable",
    },
  ];
}

function SimulatorSection() {
  const sectionRef = useRef(null);
  const [claim, setClaim] = useState(DEFAULT_CLAIM);
  const steps = useMemo(() => buildSimulation(claim), [claim]);

  useEffect(() => {
    const context = gsap.context(() => {
      gsap.fromTo(
        sectionRef.current.querySelectorAll(".sim-step"),
        { y: 36, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.1,
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

  return (
    <section ref={sectionRef} className="dt-section">
      <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-5">
          <p className="text-sm uppercase tracking-[0.35em] text-[var(--accent)]">
            Fake News Simulator
          </p>
          <h2 className="text-4xl font-semibold uppercase leading-tight md:text-6xl">
            Show judges how a lie mutates, scales, and gets caught.
          </h2>
          <p className="max-w-xl text-base leading-8 text-white/64">
            This lightweight simulation turns the platform into a storytelling engine, making
            misinformation spread and intervention paths tangible in a few seconds.
          </p>
          <textarea
            value={claim}
            onChange={(event) => setClaim(event.target.value)}
            rows="6"
            className="w-full rounded-[1.8rem] border border-white/10 bg-white/5 px-5 py-5 text-white outline-none placeholder:text-white/28"
            placeholder="Describe a misinformation scenario to simulate..."
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {steps.map((step, index) => (
            <article
              key={step.title}
              className="sim-step rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,59,59,0.06))] p-5"
            >
              <p className="text-xs uppercase tracking-[0.24em] text-white/42">
                Stage {index + 1}
              </p>
              <h3 className="mt-4 text-2xl font-semibold uppercase text-white">{step.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/65">{step.description}</p>
              <div className="mt-6 inline-flex rounded-full border border-white/12 px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-white/68">
                {step.signal}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default SimulatorSection;
