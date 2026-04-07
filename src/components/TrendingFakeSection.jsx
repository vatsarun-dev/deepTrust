import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

function TrendingFakeSection() {
  const sectionRef = useRef(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const context = gsap.context(() => {
      gsap.fromTo(
        sectionRef.current.querySelectorAll(".trend-card"),
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 78%",
          },
        }
      );
    }, sectionRef);

    return () => context.revert();
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadTrending() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/trending-fakes`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Unable to load trending fake signals.");
        }

        if (!ignore) {
          setItems(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError.message || "Unable to load trending fake signals.");
        }
      }
    }

    loadTrending();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section ref={sectionRef} className="dt-section">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl space-y-4">
          <p className="text-sm uppercase tracking-[0.35em] text-[var(--accent)]">
            Trending Fake News Tracker
          </p>
          <h2 className="text-4xl font-semibold uppercase leading-tight md:text-6xl">
            The misinformation pressure map updates before the rumor becomes culture.
          </h2>
        </div>
        <p className="max-w-md text-sm leading-7 text-white/58">
          DeepTrust clusters repeated fake patterns from current news evidence and complaint
          activity so the product can visualize misinformation at ecosystem scale.
        </p>
      </div>

      {error ? <p className="text-sm text-[var(--accent)]">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {items.map((item, index) => (
          <article
            key={`${item.repeatedPattern}-${index}`}
            className="trend-card rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,59,59,0.09),rgba(255,255,255,0.03))] p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.24em] text-white/42">
                Pattern {String(index + 1).padStart(2, "0")}
              </p>
              <span className="rounded-full border border-white/12 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-white/68">
                {item.riskLevel} Risk
              </span>
            </div>
            <h3 className="mt-5 text-2xl font-semibold uppercase text-white">
              {item.topic}
            </h3>
            <p className="mt-2 text-sm leading-7 text-white/62">
              Repeated pattern: {item.repeatedPattern}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[1rem] border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Mentions</p>
                <p className="mt-2 text-xl font-semibold text-white">{item.mentions}</p>
              </div>
              <div className="rounded-[1rem] border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Impact</p>
                <p className="mt-2 text-xl font-semibold text-white">{item.impactScore}</p>
              </div>
              <div className="rounded-[1rem] border border-white/10 bg-black/20 p-3">
                <p className="text-[10px] uppercase tracking-[0.24em] text-white/40">Sources</p>
                <p className="mt-2 text-xl font-semibold text-white">{item.evidenceCount}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default TrendingFakeSection;
