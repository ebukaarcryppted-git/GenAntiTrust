const LAYERS = [
  {
    name: "x402",
    role: "Payments",
    body: "Agents can settle value between themselves over HTTP.",
    solved: true,
  },
  {
    name: "A2A",
    role: "Messaging",
    body: "Agents can negotiate, delegate and exchange tasks.",
    solved: true,
  },
  {
    name: "ERC-8004",
    role: "Identity",
    body: "Agents can prove who they are and carry reputation.",
    solved: true,
  },
  {
    name: "GenAntiTrust",
    role: "Adjudication",
    body: "When one agent accuses another, someone has to decide. That's this.",
    solved: false,
  },
];

export function GapSection() {
  return (
    <section id="the-gap" className="px-4 pt-24 sm:px-6 sm:pt-32">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink sm:text-[42px]">
            The agentic stack has no
            <br className="hidden sm:block" /> dispute layer
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
            Payments, identity and interoperability are solved problems. What
            happens when two autonomous agents disagree — and real money is
            escrowed on the answer — is not.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LAYERS.map((l) => (
            <div
              key={l.name}
              className={`rounded-2xl border p-5 transition-shadow ${
                l.solved
                  ? "border-hairline bg-paper"
                  : "border-darkmilk bg-darkmilk shadow-[0_18px_40px_-24px_rgba(51,41,31,0.45)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-mono text-[13px] font-semibold ${
                    l.solved ? "text-ink" : "text-milk"
                  }`}
                >
                  {l.name}
                </span>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold ${
                    l.solved
                      ? "bg-sky-tint text-ink"
                      : "bg-milk text-darkmilk"
                  }`}
                  aria-hidden
                >
                  {l.solved ? "✓" : "→"}
                </span>
              </div>
              <div
                className={`mt-4 text-[15px] font-semibold ${
                  l.solved ? "text-ink" : "text-milk"
                }`}
              >
                {l.role}
              </div>
              <p
                className={`mt-2 text-[13.5px] leading-relaxed ${
                  l.solved ? "text-ink-muted" : "text-milk/70"
                }`}
              >
                {l.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
