import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import controlImage from "../assets/control-puppet.webp";

function ControlSection() {
  const sectionRef = useRef(null);
  const figureRef = useRef(null);
  const copyRef = useRef(null);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    const context = gsap.context(() => {
      gsap.fromTo(
        figureRef.current,
        { opacity: 0, y: 45 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
          },
        }
      );

      gsap.to(figureRef.current, {
        scale: 1.03,
        duration: 3.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      gsap.fromTo(
        copyRef.current.children,
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 78%",
            end: "bottom 45%",
            scrub: isMobile ? 0.5 : true,
          },
        }
      );
    }, sectionRef);

    return () => context.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="dt-section grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]"
    >
      <div ref={copyRef} className="space-y-5">
        <p className="text-sm uppercase tracking-[0.35em] text-[var(--accent)]">
          Psychological Capture
        </p>
        <h2 className="text-4xl font-semibold uppercase leading-tight md:text-6xl">
          False narratives hijack attention, then train emotion.
        </h2>
        <p className="max-w-xl text-base leading-8 text-white/65">
          Once a story is engineered to trigger outrage, shame, or fear, it
          stops behaving like content and starts behaving like control. That is
          the moment verification must feel instant, not bureaucratic.
        </p>
      </div>

      <div
        ref={figureRef}
        className="relative mx-auto aspect-square w-full max-w-[560px] overflow-hidden rounded-[2.5rem] border border-white/10 bg-[radial-gradient(circle_at_center,_rgba(255,59,59,0.24),_transparent_38%),linear-gradient(180deg,_#0f0f10,_#040404)]"
      >
        <img
          src={controlImage}
          alt="Puppet control imagery representing manipulated narratives"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,59,59,0.12),_transparent_42%),linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.52))]" />
      </div>
    </section>
  );
}

export default ControlSection;
