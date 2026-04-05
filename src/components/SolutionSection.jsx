import { useEffect, useRef } from "react";
import { gsap } from "gsap";

const solutions = [
  {
    title: "Cross-signal scanning",
    copy: "Evaluate language patterns, source consistency, and media artifacts in one motion.",
  },
  {
    title: "Visual confidence scoring",
    copy: "Translate detection into a signal people understand instantly, even under pressure.",
  },
  {
    title: "Rapid escalation",
    copy: "Turn suspicious content into a structured complaint with evidence attached.",
  },
];

function SolutionSection() {
  const sectionRef = useRef(null);
  const cardsRef = useRef(null);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    const context = gsap.context(() => {
      gsap.fromTo(
        cardsRef.current.children,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
            end: "bottom 40%",
            scrub: isMobile ? 0.5 : true,
          },
        }
      );
    }, sectionRef);

    return () => context.revert();
  }, []);

  return (
    <section ref={sectionRef} className="dt-section">
      <div className="mb-10 space-y-5">
        <p className="text-sm uppercase tracking-[0.35em] text-[var(--accent)]">
          The System
        </p>
        <h2 className="max-w-4xl text-4xl font-semibold uppercase leading-tight md:text-6xl">
          DeepTrust combines detection, context, and response in one fluid path.
        </h2>
      </div>

      <div ref={cardsRef} className="grid gap-5 lg:grid-cols-3">
        {solutions.map((item, index) => (
          <article
            key={item.title}
            className="group rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-6 transition hover:-translate-y-1 hover:border-[var(--accent)]/30"
          >
            <p className="mb-8 text-sm uppercase tracking-[0.3em] text-white/40">
              0{index + 1}
            </p>
            <h3 className="mb-4 text-2xl font-semibold uppercase">
              {item.title}
            </h3>
            <p className="text-base leading-7 text-white/65">{item.copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default SolutionSection;
