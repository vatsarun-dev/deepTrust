const MODES = ["simple", "technical", "legal"];

function ExplanationModeSwitcher({ value, onChange }) {
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-black/20 p-2">
      <p className="mb-3 text-xs uppercase tracking-[0.28em] text-white/45">
        Explanation Mode
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            className={`rounded-[1rem] px-4 py-3 text-xs uppercase tracking-[0.24em] transition ${
              value === mode
                ? "bg-[var(--accent)] text-white"
                : "border border-white/10 bg-white/5 text-white/68 hover:bg-white/10"
            }`}
          >
            {mode}
          </button>
        ))}
      </div>
    </div>
  );
}

export default ExplanationModeSwitcher;
