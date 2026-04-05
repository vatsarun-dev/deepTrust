import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import fakeNewsImage from "../assets/fake-news.jpg";

function FakeNewsSection() {
  const sectionRef = useRef(null);
  const imageRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 78%",
          end: "bottom 30%",
          scrub: true,
        },
      });

      timeline
        .fromTo(
          imageRef.current,
          { xPercent: isMobile ? -10 : -22, opacity: 0.25, y: 40 },
          { xPercent: 0, opacity: 1, y: 0, ease: "power3.out" }
        )
        .fromTo(
          textRef.current.children,
          { xPercent: isMobile ? 8 : 18, opacity: 0, y: 32 },
          { xPercent: 0, opacity: 1, y: 0, stagger: 0.12, ease: "power3.out" },
          0.05
        )
        .to(imageRef.current, { yPercent: isMobile ? -4 : -10 }, 0);
    }, sectionRef);

    return () => context.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="dt-section grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]"
    >
      <div
        ref={imageRef}
        className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#120a0a] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
      >
        <img
          src={fakeNewsImage}
          alt="Phone screen overwhelmed by fake news labels"
          className="aspect-[4/5] w-full rounded-[2rem] object-cover object-center"
        />
        <div className="absolute inset-4 rounded-[2rem] bg-[linear-gradient(180deg,rgba(255,59,59,0.08),rgba(0,0,0,0.5))]" />
      </div>

      <div ref={textRef} className="space-y-5">
        <p className="text-sm uppercase tracking-[0.35em] text-[var(--accent)]">
          The Threat
        </p>
        <h2 className="text-4xl font-semibold uppercase leading-tight md:text-6xl">
          Disinformation doesn't arrive as chaos. It arrives as choreography.
        </h2>
        <p className="max-w-xl text-base leading-8 text-white/65">
          Coordinated posts, clipped videos, fake screenshots, and influencer
          amplification work together to turn confusion into consensus before
          the truth can even enter the frame.
        </p>
      </div>
    </section>
  );
}

export default FakeNewsSection;
