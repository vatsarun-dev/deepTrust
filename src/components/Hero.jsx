import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import heroImage from "../assets/reality-scene.jpg";

function Hero() {
  const sectionRef = useRef(null);
  const backdropRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease: "power3.out" },
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });

      timeline
        .fromTo(
          backdropRef.current,
          { scale: 1, yPercent: 0 },
          { scale: isMobile ? 1.08 : 1.2, yPercent: isMobile ? 8 : 14 }
        )
        .fromTo(
          contentRef.current.children,
          { y: 80, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.12,
            duration: 1.15,
          },
          0.05
        );
    }, sectionRef);

    return () => context.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen items-end overflow-hidden px-4 pb-16 pt-28 md:px-8 md:pb-20"
    >
      <div
        ref={backdropRef}
        className="absolute inset-0"
      >
        <img
          src={heroImage}
          alt="Blindfolded figure manipulated by strings"
          className="h-full w-full object-cover object-center"
        />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,59,59,0.45),rgba(11,3,3,0.88)),radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.1),transparent_26%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[58vh] bg-[radial-gradient(circle_at_center,_rgba(0,0,0,0.08),_transparent_52%),linear-gradient(180deg,_transparent,_rgba(0,0,0,0.82))]" />

      <div
        ref={contentRef}
        className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-6"
      >
        <p className="max-w-xs text-[0.7rem] uppercase tracking-[0.45em] text-white/75">
          Detect narrative manipulation before it rewires public trust.
        </p>
        <h1 className="max-w-4xl text-5xl font-semibold uppercase leading-[0.9] text-white md:text-7xl lg:text-[8.5rem]">
          Truth needs a cinematic defense system.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-white/72 md:text-lg">
          DeepTrust verifies suspicious headlines, images, and media patterns
          with an AI-guided flow built for people moving through noise at speed.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/check" className="dt-button">
            Run a Verification
          </Link>
          <Link to="/complaint" className="dt-button-muted">
            Report a Campaign
          </Link>
        </div>
      </div>
    </section>
  );
}

export default Hero;
