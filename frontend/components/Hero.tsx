"use client";

// Kept clear of the centred copy column (max-w-3xl ≈ 16.7%–83.3% of the
// hero), so the badges frame the headline instead of crowding it.
const ORBIT_AGENTS = [
  { initial: "α", name: "agent-alpha", flagged: true, left: "11%", top: "24%" },
  { initial: "β", name: "agent-bravo", flagged: true, left: "6%", top: "49%" },
  { initial: "γ", name: "agent-charlie", flagged: false, left: "12%", top: "73%" },
  { initial: "δ", name: "agent-delta", flagged: false, left: "89%", top: "24%" },
  { initial: "ε", name: "agent-epsilon", flagged: false, left: "94%", top: "49%" },
  { initial: "ζ", name: "agent-zeta", flagged: false, left: "88%", top: "73%" },
];

function OrbitBadge({
  initial,
  name,
  flagged,
  left,
  top,
  delay,
}: (typeof ORBIT_AGENTS)[number] & { delay: number }) {
  return (
    <div
      className="absolute hidden -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 xl:flex"
      style={{ left, top, animation: `drift 9s ease-in-out ${delay}s infinite` }}
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full text-[19px] font-semibold shadow-[0_2px_4px_rgba(19,18,17,0.04),0_14px_30px_-12px_rgba(19,18,17,0.25)] ring-1 ${
          flagged
            ? // the accused pair: inverted, so weight carries what hue used to
              "bg-darkmilk text-milk ring-darkmilk"
            : "bg-paper text-ink ring-sky"
        }`}
      >
        {initial}
      </span>
      <span className="whitespace-nowrap font-mono text-[10.5px] tracking-tight text-ink-faint">
        {name}
      </span>
    </div>
  );
}

export function Hero({ disputeCount }: { disputeCount: number }) {
  return (
    <section id="top" className="relative px-4 pt-14 sm:px-6 sm:pt-20">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-hairline bg-paper px-6 pb-16 pt-16 shadow-[0_1px_2px_rgba(19,18,17,0.03),0_28px_70px_-40px_rgba(19,18,17,0.3)] sm:px-10 sm:pb-20 sm:pt-20">
        {/* concentric orbits */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-hairline/70"
              style={{ width: 340 + i * 230, height: 340 + i * 230 }}
            />
          ))}
          <div
            className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(190,217,244,0.5) 0%, rgba(190,217,244,0) 68%)",
            }}
          />
        </div>

        {ORBIT_AGENTS.map((a, i) => (
          <OrbitBadge key={a.name} {...a} delay={i * 0.7} />
        ))}

        {/* content */}
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-hairline bg-milk px-3.5 py-1.5 text-[12.5px] font-medium text-ink-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-beacon rounded-full bg-darkmilk" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-darkmilk" />
            </span>
            <span className="whitespace-nowrap">Live on Testnet Bradbury</span>
            <span className="hidden items-center gap-2.5 sm:inline-flex">
              <span className="text-ink-faint">·</span>
              <span className="font-mono text-ink">{disputeCount}</span>
              <span className="whitespace-nowrap text-ink-muted">
                verdicts rendered
              </span>
            </span>
          </div>

          <h1 className="mt-7 text-[40px] font-semibold leading-[1.04] tracking-[-0.04em] text-ink sm:text-[58px] lg:text-[66px]">
            The tribunal for
            <br />
            agent&#8209;to&#8209;agent antitrust
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-[16.5px] leading-relaxed text-ink-muted">
            When AI pricing agents drift into collusion, someone has to judge it.
            GenAntiTrust reads the negotiation history and renders a verdict
            on&#8209;chain — decided by validator consensus, not a single model.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#console"
              className="rounded-xl bg-darkmilk px-5 py-3 text-[14.5px] font-semibold text-paper shadow-[0_10px_24px_-10px_rgba(51,41,31,0.32)] transition-colors hover:bg-darkmilk-deep"
            >
              Open the tribunal
            </a>
            <a
              href="#the-gap"
              className="rounded-xl border border-hairline bg-paper px-5 py-3 text-[14.5px] font-semibold text-ink transition-colors hover:bg-milk-deep"
            >
              Why this gap exists
            </a>
          </div>
        </div>

        {/* verdict card stack */}
        <div className="relative mx-auto mt-14 max-w-lg">
          <div className="absolute inset-x-8 -bottom-4 h-24 rounded-2xl border border-hairline bg-paper/60" />
          <div className="absolute inset-x-4 -bottom-2 h-24 rounded-2xl border border-hairline bg-paper/80" />
          <div className="relative animate-rise rounded-2xl border border-hairline bg-paper p-5 text-left shadow-[0_2px_4px_rgba(19,18,17,0.03),0_24px_50px_-28px_rgba(19,18,17,0.4)]">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-lg bg-darkmilk px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wide text-milk">
                <span className="h-1.5 w-1.5 rounded-full bg-milk" />
                Collusion
              </span>
              <span className="font-mono text-[12.5px] text-ink-muted">
                99% confidence
              </span>
            </div>
            <p className="mt-3.5 text-[14px] leading-relaxed text-ink">
              “The private exchanges explicitly discuss holding a price floor and
              are followed by near-synchronous matching prices by agent-alpha and
              agent-bravo — direct evidence of coordination rather than parallel
              optimization.”
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3.5 font-mono text-[11.5px] text-ink-faint">
              <span>DISPUTE-000002</span>
              <span>5 validators · eq_principle</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
