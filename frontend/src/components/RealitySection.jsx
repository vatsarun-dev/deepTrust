import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import realityImage from "../assets/hero-reality.png";

const facts = [
  "Deepfakes spread faster when paired with emotionally loaded text.",
  "People trust repeated claims even when they cannot verify the source.",
  "Verification UX has to feel decisive, visual, and immediate.",
];

function RealitySection() {
  const sectionRef = useRef(null);
  const panelRef = useRef(null);
  const factsRef = useRef(null);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    const context = gsap.context(() => {
      gsap.fromTo(
        panelRef.current,
        { clipPath: "inset(0 0 100% 0 round 2rem)", opacity: 0.4 },
        {
          clipPath: "inset(0 0 0% 0 round 2rem)",
          opacity: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 78%",
            end: "top 30%",
            scrub: isMobile ? 0.7 : true,
          },
        }
      );

      gsap.fromTo(
        factsRef.current.children,
        { y: 34, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.18,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 72%",
            end: "bottom 38%",
            scrub: isMobile ? 0.5 : true,
          },
        }
      );
    }, sectionRef);

    return () => context.revert();
  }, []);

  return (
    <section ref={sectionRef} className="dt-section">
      <div
        ref={panelRef}
        className="grid gap-8 overflow-hidden rounded-[2.5rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,59,59,0.08)),linear-gradient(180deg,#0d0d0e,#050505)] p-6 md:p-10 lg:grid-cols-[1fr_1fr]"
      >
        <div className="space-y-5">
          <p className="text-sm uppercase tracking-[0.35em] text-[var(--accent)]">
            Reality Check
          </p>
          <h2 className="max-w-2xl text-4xl font-semibold uppercase leading-tight md:text-6xl">
            Verification has to surface truth like a reveal, not a report.
          </h2>
        </div>

        <div ref={factsRef} className="grid gap-4">
          <div className="overflow-hidden rounded-[1.75rem] border border-white/10">
            <img
              src={realityImage}
              alt="Figure surrounded by hostile voices and manipulation"
              className="h-64 w-full object-cover object-center"
            />
          </div>
          {facts.map((fact) => (
            <div
              key={fact}
              className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5"
            >
              <p className="text-base leading-7 text-white/72">{fact}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default RealitySection;
