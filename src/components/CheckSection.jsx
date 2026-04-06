import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import axios from "axios";
import { gsap } from "gsap";
import { useAppContext } from "../context/AppContext.jsx";

// Default to local backend when env var is missing so dev requests don't hit the Vite dev server and 404.
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Compact knowledge priors to avoid low-confidence on settled facts; format: "claim -> Status,Confidence"
const KNOWLEDGE_PRIORS = [
  "Humans can breathe underwater unaided -> Fake,96",
  "Humans eat through their eyes -> Fake,99",
  "Earth orbits the Sun -> True,95",
  "Sun is larger than the Moon -> True,90",
  "Water boils at 100C at sea level -> True,90",
  "COVID-19 caused by 5G -> Fake,99",
  "Vaccines cause autism -> Fake,99",
  "Moon landing 1969 was faked -> Fake,95",
  "Great Wall visible from space with naked eye -> Fake,85",
  "Bananas contain potassium -> True,90",
  "Black holes bend light -> True,92",
  "Bleach cures disease -> Fake,99",
  "Glass is a slow-moving liquid -> Misleading,70",
  "Coffee stunts growth -> Misleading,60",
  "Carrots give cat-like night vision -> Misleading,65",
  "Earth is flat -> Fake,99",
  "Smoking causes lung cancer -> True,95",
  "Penicillin discovered by Fleming -> True,90",
  "Einstein failed math -> Fake,85",
  "Bats are blind -> Fake,85",
  "Camels store water in humps -> Fake,85",
  "Goldfish have 3-second memory -> Fake,85",
  "Humans use only 10% of brain -> Fake,90",
  "Sharks don’t get cancer -> Fake,90",
  "Lightning never strikes same place twice -> Fake,95",
  "Tomatoes are vegetables -> Misleading,75",
  "Antibiotics kill viruses -> Fake,95",
  "Water is H2O -> True,98",
  "DNA is a double helix -> True,95",
  "Pluto is a planet today -> Misleading,88",
  "CO2 drives greenhouse effect -> True,92",
  "Wind turbines cause cancer -> Fake,99",
  "Helicopters can fly in space -> Fake,99",
  "Mount Everest tallest above sea level -> True,90",
  "Mariana Trench deepest ocean point -> True,90",
  "Amazon is longest river -> Misleading,70",
  "Humans have only 5 senses -> Misleading,70",
  "Ultrasound uses ionizing radiation -> Fake,90",
  "Birds aren’t real -> Fake,99",
  "China population >1B -> True,95",
  "India won 2011 Cricket World Cup -> True,95",
  "France won 2018 FIFA World Cup -> True,95",
  "Argentina won 2022 FIFA World Cup -> True,95",
  "Apollo 13 landed on Moon -> Fake,90",
  "Chernobyl disaster was 1986 -> True,90",
  "Titanic sank in 1912 -> True,95",
  "Antibiotics are effective against common cold -> Fake,95",
  "Mercury retrograde controls life events -> Fake,99",
  "Zodiac signs dictate personality -> Fake,95",
  "Drinking warm or hot water causes cancer -> Fake,95",
  "Very hot beverages above ~65C increase esophageal cancer risk -> True,75",
  "Bleeding stops infection -> Fake,95",
  "Birds die if you touch a baby -> Fake,90",
  "Camels drink once a month -> Misleading,70",
  "Lightning hotter than sun surface -> True,85",
  "Bulls hate red -> Fake,85",
  "Hair and nails grow after death -> Fake,90",
  "Sushi means raw fish -> Fake,80",
  "All deserts are hot -> Fake,90",
  "Koalas are bears -> Fake,90",
  "Peanuts are nuts -> Fake,85",
  "Earth has two moons -> Fake,95",
  "Venus is hottest planet -> True,90",
  "Jupiter is a gas giant -> True,92",
  "Time dilation is real -> True,90",
  "Homeopathy works beyond placebo -> Fake,80",
  "Astrology predicts future -> Fake,95",
  "Blood is blue in veins -> Fake,95",
  "Hair grows thicker after shaving -> Fake,90",
  "Lightning never hits airplanes -> Fake,95",
  "Seatbelts trap you in water -> Fake,80",
  "AI is sentient today -> Fake,95",
  "Cats always land safely -> Misleading,70",
  "Dogs see only black and white -> Fake,85",
  "Octopus has three hearts -> True,90",
  "Blue whale largest animal ever -> True,90",
  "Ostriches bury heads in sand -> Fake,90",
  "Humans and dinosaurs coexisted -> Fake,99",
  "Dinosaurs had feathers -> True,80",
  "Glass of water can burn fire -> Fake,95",
  "Microwave ovens remove nutrients completely -> Fake,90",
  "MSG unsafe in normal doses -> Fake,70",
  "GMOs inherently dangerous -> Unverified,55",
  "Organic food always pesticide-free -> Fake,80",
  "Bitcoin created in 2009 -> True,90",
  "Email invented by NASA -> Fake,85",
  "VPN makes you anonymous -> Misleading,65",
  "Incandescent bulbs banned worldwide -> Misleading,60",
  "Owls rotate heads 360 degrees -> Fake,85",
  "Penguins live in Arctic -> Fake,95",
  "Polar bears and penguins coexist -> Fake,95",
  "Cracking knuckles causes arthritis -> Fake,85",
  "Humans glow visibly in dark -> Fake,95",
  "Airplanes dump waste midair -> Fake,90",
  "Birds evolved from dinosaurs -> True,85",
  "Mars has liquid water oceans today -> Fake,90",
  "Ozone hole fully healed -> Fake,80",
  "No sharks in freshwater -> Fake,85",
  "All spiders spin webs -> Fake,80",
  "Sound travels faster in air than water -> Fake,90",
  "Humans get taller in space -> True,75",
  "Recycling always greener -> Misleading,65",
  "LEDs contain mercury -> Fake,90",
  "GPS requires internet -> Fake,90",
  "Jet contrails are chemtrails -> Fake,99",
  "Hydrogen cars emit only water -> True,85",
  "EV batteries always end in landfills -> Fake,85",
  "Plastic straws biggest ocean pollutant -> Misleading,60",
  "Coral reefs are plants -> Fake,90",
  "Dolphins are fish -> Fake,95",
  "Bamboo is a tree -> Fake,85",
  "Chocolate toxic to dogs -> True,90",
  "Time zones invented by railroads -> True,75",
  "Leap years every 4 years without exception -> Fake,85",
  "Antarctica largest desert -> True,90",
  "Seasons caused by Earth-Sun distance -> Fake,95",
  "Honey never spoils -> True,85",
  "Hand sanitizer kills all germs -> Fake,85",
  "Antiperspirant causes cancer -> Fake,90",
  "Crystals heal disease -> Fake,99",
  "Microwave cooks from inside out -> Fake,85",
  "Brown eggs healthier than white -> Fake,85",
  "Chameleons change color only to camouflage -> Fake,70",
  "Bulls charge red color specifically -> Fake,85",
  "Owning cats guarantees toxoplasmosis -> Fake,80",
  "Houseplants clean a room’s air fully -> Fake,60",
  "Wind chill lowers actual temperature -> Fake,85",
  "Sugar causes hyperactivity in kids -> Misleading,60",
  "Spicy food causes ulcers -> Misleading,65",
  "All deserts have sand -> Fake,85",
  "Coal is compressed dinosaurs -> Fake,85",
  "Humans glow bioluminescent visibly -> Fake,99",
  "Trees communicate via fungi networks -> True,70",
  "Space is silent -> True,80",
  "Sound travels in vacuum -> Fake,95",
  "ISS orbits Earth every 90 minutes -> True,85",
  "GPS needs relativity corrections -> True,85",
  "Plants feel pain like humans -> Fake,70",
  "UTC always equals GMT -> Misleading,75",
  "Leap seconds added yearly -> Fake,85",
  "Captcha proves human perfectly -> Fake,85",
  "Two-factor auth stops all hacks -> Fake,75",
  "Offline computer unhackable -> Fake,80",
  "USB flash drives last forever -> Fake,85",
  "Quantum computers break all encryption today -> Fake,95",
  "AI can perfectly detect deepfakes -> Fake,95",
  "Milk builds strong bones in everyone -> Misleading,65",
  "Gluten toxic to all humans -> Fake,75",
  "Raw milk safer than pasteurized -> Fake,90",
  "Sugar-free soda causes cancer -> Unverified,60",
  "Boiling water twice makes it toxic -> Fake,90",
  "Copper bracelets cure arthritis -> Fake,95",
  "Essential oils cure infections -> Fake,95",
  "Napping always ruins night sleep -> Misleading,60",
  "Tor browsing makes you invisible -> Fake,80",
  "Incognito hides activity from ISP -> Fake,95",
  "UK is part of EU in 2026 -> Fake,95",
  "Euro used in Switzerland -> Fake,95",
  "Pyramids built by aliens -> Fake,99",
  "Loch Ness Monster proven -> Fake,99",
  "Bigfoot DNA confirmed -> Fake,99",
  "Mars has two moons Phobos and Deimos -> True,90",
  "Venus rotates retrograde -> True,85",
  "Uranus rotates on its side -> True,85",
  "Human pregnancy always exactly 9 months -> Misleading,70",
  "Left-handed people die younger always -> Fake,75",
  "Baby has more bones than adult -> True,85",
  "All snakes venomous -> Fake,95",
  "Spiders are insects -> Fake,90",
  "Whales are fish -> Fake,95",
  "Sugar substitutes always cause cancer -> Fake/Unverified,70",
  "MRI uses harmful radiation -> Fake,95",
  "CT uses sound waves -> Fake,95",
  "Space suits weigh 100kg on Earth -> True-ish,70",
  "Humans can live on Mars today -> Fake,95",
  "AI cured cancer -> Fake/Unverified,95",
  "Fusion power already commercial -> Fake/Unverified,90",
  "Solar panels pay back energy in days -> Fake,85",
  "Wind turbines last forever -> Fake,85",
  "Nuclear waste harmless -> Fake,90",
  "Hydrogen airships perfectly safe -> Misleading,70",
  "Galileo GPS is US system -> Fake,95",
  "Bees legally fish in California -> True,70",
  "Raw cashews harmless -> Fake,85",
  "Pufferfish safe without prep -> Fake,95",
  "Wasabi usually horseradish -> True,80",
  "White chocolate not chocolate -> True,75",
  "Coconut water sterile IV -> Misleading,70",
  "Allergy shots cure instantly -> Fake,90",
  "Rainbows are full circles sometimes -> True,70",
  "Moon has a dark side -> Misleading,80",
  "Spiders drink blood -> Fake,80",
  "Viruses are alive -> Unverified/contested,60",
  "Prions are infectious proteins -> True,80",
  "Vending machines deadlier than sharks -> Misleading,65",
  "Humans share 50% DNA with bananas -> True-ish,70",
  "Snakes hear through jaw -> True,70",
  "Seahorse males give birth -> True,80",
  "Jellyfish are immortal -> Misleading,65",
  "GPS owned by Russia -> Fake,95",
  "Bluetooth named after a king -> True,75",
  "RAM retains data when power off -> Fake,95",
  "SSD uses spinning disks -> Fake,95",
  "Internet and Web are identical -> Misleading,75",
  "Unicode limited to 65k chars -> Fake,90",
  "USB stands for Universal Serial Bus -> True,90",
  "AI image models only memorize training data -> Fake/Misleading,75",
  "Plastics all contain BPA -> Fake,75",
  "AI detectors are infallible -> Fake,95",
  "2011 World Cup final was in Mumbai -> True,90",
  "Messi won 8 Ballon d'Or by 2024 -> True,85",
  "Ronaldo was born in Brazil -> Fake,95",
  "Serena has more Slams than Federer -> True,85",
  "US has most Olympic medals -> True,90",
  "Hookah less harmful than smoking -> Fake/Misleading,85",
  "Vaping is only water vapor -> Fake,95",
  "Polyphasic sleep is optimal for all -> Fake/Unverified,60",
  "AI will replace all coders by 2030 -> Fake/Unverified,90",
  "GPS works underground -> Fake,90",
  "Ultraviolet warms more than visible -> Misleading,60",
  "Stonehenge built in 1900s -> Fake,95",
  "Napoleon was extremely short -> Misleading,75",
  "Medieval people thought Earth flat -> Fake,85",
  "Helmets cause more neck injury than they prevent -> Fake/Misleading,80",
  "MRI stands for Magnetic Resonance Imaging -> True,95",
  "AA battery is 1.5V under load always -> Fake,85",
  "OLED cannot burn in -> Fake,90",
  "USB-C cables all identical -> Fake,85",
  "NFC works at 1 meter -> Fake,95",
  "Wi‑Fi 7 is universal in 2026 -> Fake/Misleading,80",
  "Humans can photosynthesize -> Fake,99",
  "All deserts are lifeless -> Fake,90",
  "Tornadoes can't cross water -> Fake,85",
  "Earthquakes only happen in morning -> Fake,95",
  "Full moon increases crime -> Unverified/Misleading,55",
  "Zebras are white with black stripes -> True-ish,70",
  "Mammoths have been cloned -> Fake/Unverified,80",
  "AI can 100% detect lies -> Fake/Unverified,90",
  "Wind energy uses more energy than it makes -> Fake,90",
];
function formatModelSource(source) {
  if (!source) return null;
  if (source === "puter-js") return "Puter.js (GPT-5.4 Nano)";
  if (source === "puter-js+gnews") return "Puter.js + GNews evidence";
  if (source === "gnews") return "GNews evidence analysis";
  if (source === "sightengine") return "Sightengine image forensics";
  if (source === "fallback") return "Local fallback analysis";
  return source;
}

function extractTextSourceLinks(sources) {
  if (Array.isArray(sources)) {
    return sources;
  }
  if (sources && Array.isArray(sources.text)) {
    return sources.text;
  }
  return [];
}

function mapStatusToResult(status) {
  if (status === "True" || status === "Likely True") return "Real";
  if (status === "Unverified") return null;
  return "Fake";
}

function toVerdictLabel(status, result) {
  if (status === "Unverified") return "Unverified";
  if (result === "Fake" || status === "Fake" || status === "Misleading") {
    return "High manipulation risk";
  }
  return "Likely authentic";
}

function normalizeStatus(rawStatus) {
  const status = String(rawStatus || "").trim().toLowerCase();
  if (status === "true") return "True";
  if (status === "likely true") return "Likely True";
  if (status === "misleading") return "Misleading";
  if (status === "fake" || status === "false" || status === "likely false") return "Fake";
  if (status === "unverified") return "Unverified";
  return "Unverified";
}

function clampConfidence(value, fallback = 50) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function extractPuterText(raw) {
  if (typeof raw === "string") return raw;
  if (typeof raw?.text === "string") return raw.text;
  if (typeof raw?.message?.content === "string") return raw.message.content;
  if (Array.isArray(raw?.message?.content)) {
    return raw.message.content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }
  return String(raw || "");
}

function parsePuterJson(rawContent) {
  const normalized = String(rawContent || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  const candidate =
    start !== -1 && end !== -1 && end > start
      ? normalized.slice(start, end + 1)
      : normalized;

  return JSON.parse(candidate);
}

function buildPuterPrompt(claim, articles) {
  const articleBlock = articles.length
    ? articles
        .slice(0, 3)
        .map(
          (article, index) =>
            `${index + 1}. ${(article.title || "Untitled").trim()} + ${(article.description || "No description").trim()}`
        )
        .join("\n")
    : "No relevant news articles were found.";

  return [
    "User Claim:",
    `"${claim}"`,
    "",
    "Evidence Articles (cite by number):",
    articleBlock,
    "",
    "Evaluation Rules:",
    "- Use ONLY the listed articles; never invent facts.",
    "- Cite evidence with [#] where # is the article number (e.g., [#1]).",
    "- Check: (a) factual alignment with the claim, (b) headline/body contradictions across sources,",
    "        (c) recency vs claim timing, (d) outlet credibility (major wire/verified outlet > blogs).",
    "- If sources conflict -> choose 'Misleading' unless fabrication is clear -> 'Fake'.",
    "- If coverage is thin or absent -> use widely accepted scientific/physical facts to judge impossible claims; only then mark 'Fake'. Otherwise choose 'Unverified'.",
    "- For settled facts (astronomy, biology, physics) with no plausible dispute, set confidence >= 85%.",
    "- Avoid filler like 'no sources provided'; if using knowledge priors, cite consensus (e.g., WHO/IARC) and give a firm verdict.",
    "- Keep output concise and evidence-grounded; no hidden reasoning.",
    "",
    "Status Definitions:",
    "True: multiple credible sources clearly support the core claim without contradiction.",
    "Likely True: at least one credible source aligns; no contradictions; minor gaps allowed.",
    "Misleading: mixes accurate pieces but missing context, cherry-picked, or partly contradicted.",
    "Fake: direct contradiction by sources, fabricated detail, debunked by fact-checkers, OR claim violates basic physics/biology/common knowledge (e.g., humans breathing underwater unaided).",
    "Unverified: insufficient coverage AND not obviously impossible.",
    "",
    "Knowledge priors to apply when articles are missing or thin (do not output this list):",
    KNOWLEDGE_PRIORS.map((p) => `- ${p}`).join("\n"),
    "",
    "Return STRICT JSON ONLY:",
    "{",
    '  "status": "True | Likely True | Misleading | Fake | Unverified",',
    '  "confidence": 0-100,',
    '  "explanation": "2-3 short sentences citing sources like [#1] about why",',
    '  "evidence_used": ["#1", "#2"],',
    '  "verdict_reason": "corroborated | conflict | absent evidence | fabricated detail"',
    "}",
    "",
    "Example Response:",
    '{',
    '  "status": "Misleading",',
    '  "confidence": 62,',
    '  "explanation": "Headline says 5,000 casualties, but articles [#1][#2] report ~500 with ongoing rescue. No source supports higher toll.",',
    '  "evidence_used": ["#1", "#2"],',
    '  "verdict_reason": "conflict"',
    "}",
    "",
    "Example (no articles, common knowledge impossible claim):",
    '{',
    '  \"status\": \"Fake\",',
    '  \"confidence\": 96,',
    '  \"explanation\": \"Claim says a human can breathe underwater unaided, which violates human physiology and no article supports it.\",',
    '  \"evidence_used\": [],',
    '  \"verdict_reason\": \"fabricated detail\"',
    "}",
    "",
    "Example (settled fact, no articles provided):",
    "{",
    '  \"status\": \"True\",',
    '  \"confidence\": 90,',
    '  \"explanation\": \"The Sun is vastly larger than the Moon; this is an uncontested astronomical fact taught globally.\",',
    '  \"evidence_used\": [],',
    '  \"verdict_reason\": \"corroborated\"',
    "}",
    "",
    "Example (health myth, no articles):",
    "{",
    '  \"status\": \"Fake\",',
    '  \"confidence\": 95,',
    '  \"explanation\": \"Ordinary warm water has no evidence of causing cancer; major bodies (e.g., IARC) only warn about very hot drinks >65C raising esophageal risk.\",',
    '  \"evidence_used\": [],',
    '  \"verdict_reason\": \"fabricated detail\"',
    "}",
    "",
    "Rapid guidance examples (do not output, just follow):",
    "- \"Earth orbits the Sun\" -> True, 95%",
    "- \"COVID-19 is caused by 5G\" -> Fake, 95%",
    "- \"Water boils at 100C at sea level\" -> True, 90%",
    "- \"The Great Wall is visible from space with naked eye\" -> Fake, 85%",
    "- \"Vaccines cause autism\" -> Fake, 95%",
    "- \"Electric cars emit zero tailpipe CO2\" -> True, 90%",
    "- \"The Moon landing in 1969 was staged\" -> Fake, 95%",
    "- \"Pluto is a planet today\" -> Misleading (dwarf planet), 88%",
    "- \"Black holes bend light\" -> True, 92%",
    "- \"Drinking bleach cures disease\" -> Fake, 99%",
    "- \"Bananas contain potassium\" -> True, 90%",
    "- \"A shark lived 500 years\" -> Misleading (Greenland sharks ~400 est.), 70%",
    "- \"AI chatbots are conscious today\" -> Unverified, 40%",
    "- \"The sun is larger than the moon\" -> True, 90%",
    "- \"Humans can breathe underwater unaided\" -> Fake, 96%",
    "- \"Climate change is primarily driven by human activity\" -> True, 92%",
    "- \"Eating carrots gives night vision like a cat\" -> Misleading, 65%",
    "- \"5G towers spread viruses\" -> Fake, 99%",
    "- \"Reversing type 1 diabetes permanently with herbs\" -> Fake, 95%",
    "- \"An asteroid wiped out dinosaurs ~66M years ago\" -> True, 90%",
  ].join("\n");
}

async function analyzeTextWithPuter(claim, sources) {
  const puterClient = window?.puter;
  if (!puterClient?.ai?.chat) {
    throw new Error("Puter SDK is not available");
  }

  const prompt = buildPuterPrompt(claim, sources);
  const raw = await puterClient.ai.chat(prompt, { model: "gpt-5" });
  const rawText = extractPuterText(raw);
  const parsed = parsePuterJson(rawText);

  const status = normalizeStatus(parsed?.status);
  return {
    status,
    result: mapStatusToResult(status),
    confidence: clampConfidence(parsed?.confidence, 55),
    explanation:
      String(parsed?.explanation || "").trim() ||
      "Client-side AI could not provide a full explanation from the available evidence.",
  };
}

function CheckSection() {
  const sectionRef = useRef(null);
  const [localLoading, setLocalLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const { analysisResult, setAnalysisResult, setLoading } = useAppContext();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm();
  const imageFiles = watch("image");

  useEffect(() => {
    const context = gsap.context(() => {
      gsap.fromTo(
        sectionRef.current.querySelectorAll(".check-fade"),
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          stagger: 0.12,
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

  const onSubmit = async (data) => {
    setApiError("");
    setLocalLoading(true);
    setLoading(true);

    try {
      const hasText = Boolean(data.text?.trim());
      const hasImage = Boolean(data.image?.[0]);
      const formData = new FormData();

      if (hasText) {
        formData.append("text", data.text.trim());
      }
      if (hasImage) {
        formData.append("image", data.image[0]);
      }

      const response = await axios.post(`${API_BASE_URL}/api/analyze`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 15000,
        validateStatus: () => true,
      });

      const responseData = response.data || {};
      if (response.status >= 400) {
        throw new Error(responseData.message || `Analysis request failed (HTTP ${response.status}).`);
      }

      if (!Object.keys(responseData).length) {
        throw new Error("Analysis response was empty or not valid JSON.");
      }

      const sourceLinks = extractTextSourceLinks(responseData.sources);
      let finalStatus = responseData.status || "Unverified";
      let finalResult = responseData.result ?? mapStatusToResult(finalStatus);
      let finalConfidence = clampConfidence(responseData.confidence, 50);
      let finalExplanation =
        String(responseData.explanation || "").trim() || "Unable to build an explanation from backend response.";
      let finalSource = responseData.source || null;
      let puterNote = null;

      if (hasText) {
        try {
          const puterResult = await analyzeTextWithPuter(data.text.trim(), sourceLinks);

          if (!hasImage) {
            finalStatus = puterResult.status;
            finalResult = puterResult.result;
            finalConfidence = puterResult.confidence;
            finalExplanation = puterResult.explanation;
          } else {
            puterNote = `Client text reasoning (Puter.js): ${puterResult.explanation}`;
          }

          finalSource = hasImage ? `${responseData.source || "backend"} + puter-js` : "puter-js+gnews";
        } catch (puterError) {
          puterNote = `Client AI reasoning unavailable: ${puterError.message}`;
        }
      }

      const sourceSummary = {
        text: sourceLinks.length ? `${sourceLinks.length} linked article(s)` : "n/a",
        image: hasImage ? responseData.source || "sightengine" : "n/a",
      };

      setAnalysisResult({
        verdict: toVerdictLabel(finalStatus, finalResult),
        confidence: finalConfidence,
        summary: finalExplanation,
        source: finalSource,
        sources: sourceSummary,
        sourceLinks,
        evidence: [
          hasText
            ? "Text analysis completed using GNews evidence + Puter.js reasoning."
            : "No text was provided, so language analysis was skipped.",
          hasImage
            ? "Image inspection completed using backend media forensics."
            : "No image was uploaded, so media forensics were skipped.",
          `Backend status: ${responseData.status || "n/a"} with ${clampConfidence(responseData.confidence, 0)}% confidence.`,
          puterNote,
          finalSource ? `Primary model source: ${formatModelSource(finalSource)}.` : null,
        ],
      });

      reset();
    } catch (error) {
      setApiError(error.message || "Unable to analyze content right now.");
      setAnalysisResult(null);
    } finally {
      setLocalLoading(false);
      setLoading(false);
    }
  };

  return (
    <section ref={sectionRef} className="dt-section">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-5">
          <p className="check-fade text-sm uppercase tracking-[0.35em] text-[var(--accent)]">
            Instant Verification
          </p>
          <h2 className="check-fade text-4xl font-semibold uppercase leading-tight md:text-6xl">
            Check suspicious text or media before it spreads.
          </h2>
          <p className="check-fade max-w-xl text-base leading-8 text-white/65">
            Text verification now uses GNews evidence from the backend plus client-side
            reasoning with Puter.js. Image forensics still run through the backend.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="check-fade rounded-[2rem] border border-white/10 bg-white/5 p-6"
          >
            <label className="mb-3 block text-sm uppercase tracking-[0.25em] text-white/55">
              Suspicious Text
            </label>
            <textarea
              rows="7"
              className="mb-4 w-full rounded-[1.5rem] border border-white/10 bg-black/30 px-4 py-4 text-white outline-none placeholder:text-white/25 focus:border-[var(--accent)]/55"
              placeholder="Paste the headline, caption, or excerpt you want DeepTrust to inspect..."
              {...register("text", {
                validate: (value) => {
                  const hasText = Boolean(value?.trim());
                  const hasImage = Boolean(imageFiles?.length);

                  if (!hasText && !hasImage) {
                    return "Add suspicious text or upload an image to analyze.";
                  }

                  if (hasText && value.trim().length < 24) {
                    return "Add a little more context so the detector has signal.";
                  }

                  return true;
                },
              })}
            />
            {errors.text ? (
              <p className="mb-4 text-sm text-[var(--accent)]">{errors.text.message}</p>
            ) : null}

            <label className="mb-3 block text-sm uppercase tracking-[0.25em] text-white/55">
              Upload Image
            </label>
            <input
              type="file"
              accept="image/*"
              className="mb-6 block w-full rounded-[1rem] border border-dashed border-white/15 bg-black/25 px-4 py-4 text-sm text-white/60 file:mr-4 file:rounded-full file:border-0 file:bg-[var(--accent)] file:px-4 file:py-2 file:text-white"
              {...register("image", {
                validate: (files) => {
                  const hasText = Boolean(watch("text")?.trim());
                  const hasImage = Boolean(files?.length);

                  if (!hasText && !hasImage) {
                    return "Add suspicious text or upload an image to analyze.";
                  }

                  return true;
                },
              })}
            />
            {errors.image ? (
              <p className="mb-4 text-sm text-[var(--accent)]">{errors.image.message}</p>
            ) : null}
            {apiError ? (
              <p className="mb-4 text-sm text-[var(--accent)]">{apiError}</p>
            ) : null}

            <button type="submit" className="dt-button w-full">
              {localLoading ? "Analyzing Signal..." : "Start Analysis"}
            </button>
          </form>

          <div className="check-fade rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,59,59,0.08),rgba(255,255,255,0.02))] p-6">
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-white/45">
              Result
            </p>
            {analysisResult ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-white/45">Verdict</p>
                  <h3 className="text-2xl font-semibold uppercase text-white">
                    {analysisResult.verdict}
                  </h3>
                </div>
                <div>
                  <p className="text-sm text-white/45">Confidence</p>
                  <p className="text-5xl font-semibold text-[var(--accent)]">
                    {analysisResult.confidence}%
                  </p>
                </div>
                {analysisResult.source ? (
                  <div>
                    <p className="text-sm text-white/45">Analysis Source</p>
                    <p className="text-sm uppercase tracking-[0.24em] text-white/72">
                      {formatModelSource(analysisResult.source)}
                    </p>
                  </div>
                ) : null}
                {analysisResult.sources ? (
                  <div>
                    <p className="text-sm text-white/45">Analysis Sources</p>
                    <p className="text-sm uppercase tracking-[0.24em] text-white/72">
                      Text: {analysisResult.sources.text || "n/a"} | Image:{" "}
                      {analysisResult.sources.image || "n/a"}
                    </p>
                  </div>
                ) : null}
                {analysisResult.sourceLinks?.length ? (
                  <div className="space-y-2">
                    {analysisResult.sourceLinks.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-[1rem] border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/75 underline-offset-2 hover:underline"
                      >
                        {link.title || link.url}
                      </a>
                    ))}
                  </div>
                ) : null}
                <p className="text-sm leading-7 text-white/68">{analysisResult.summary}</p>
                <div className="space-y-3">
                  {analysisResult.evidence.filter(Boolean).map((item) => (
                    <div
                      key={item}
                      className="rounded-[1.25rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white/68"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[300px] items-end rounded-[1.5rem] bg-[radial-gradient(circle_at_top,_rgba(255,59,59,0.22),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.02),_rgba(255,255,255,0.01))] p-5">
                <p className="max-w-xs text-sm leading-7 text-white/55">
                  Your analysis result appears here with a confidence score,
                  summary, and evidence trail once the live analysis finishes.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default CheckSection;
