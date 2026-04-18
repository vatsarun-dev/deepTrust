function TruthBreakdown({ breakdown }) {
  if (!breakdown) return null;

  const items = [
    { label: "Claim", value: breakdown.claim },
    { label: "Fact", value: breakdown.fact },
    { label: "Mismatch", value: breakdown.mismatch },
    { label: "Verdict", value: breakdown.verdict },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm uppercase tracking-[0.28em] text-white/45">
        Truth Breakdown
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-white/42">
              {item.label}
            </p>
            <p className="mt-2 text-sm leading-7 text-white/78">{item.value}</p>
          </div>
        ))}
      </div>
      {breakdown.reasons?.length ? (
        <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
          <p className="text-xs uppercase tracking-[0.24em] text-white/42">
            Reasons
          </p>
          <div className="mt-2 space-y-2 text-sm leading-7 text-white/78">
            {breakdown.reasons.map((reason) => (
              <p key={reason}>• {reason}</p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default TruthBreakdown;
