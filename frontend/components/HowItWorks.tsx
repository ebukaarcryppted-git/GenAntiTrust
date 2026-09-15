const STEPS = [
  {
    method: "file_complaint",
    title: "A bond goes into escrow",
    body: "The complainant stakes GEN alongside the pricing and negotiation record. Spam costs money; the evidence is now on-chain.",
  },
  {
    method: "resolve_dispute",
    title: "Validators judge, independently",
    body: "The leader runs an LLM over the evidence. Every other validator re-judges that answer against an explicit economic standard before consensus lands.",
  },
  {
    method: "appeal_verdict",
    title: "Either party can push back",
    body: "A matching bond forces a re-judgment with new evidence. Flip the verdict and you're refunded; fail and the bond goes to the other side.",
  },
  {
    method: "finalize_dispute",
    title: "Money follows the verdict",
    body: "Pure deterministic bookkeeping reads the verdict string and releases the escrow. No AI touches the payout path.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="px-4 pt-24 sm:px-6 sm:pt-32">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink sm:text-[42px]">
            Subjective judgment,
            <br />
            deterministic settlement
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
            The only non-deterministic step is the judgment call itself. Every
            transfer of value around it is plain, auditable Python.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {STEPS.map((s, i) => (
            <div
              key={s.method}
              className="rounded-2xl border border-hairline bg-paper p-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-mono text-[12px] font-semibold text-paper">
                  {i + 1}
                </span>
                <code className="rounded-md bg-milk px-2 py-1 font-mono text-[12px] text-brand">
                  {s.method}()
                </code>
              </div>
              <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-ink">
                {s.title}
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
                {s.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-sky bg-sky-tint p-6 sm:p-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-deep">
            The equivalence principle, concretely
          </div>
          <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-ink">
            Validators must reject the leader’s verdict unless it cites evidence
            that actually appears in the record — and parallel pricing{" "}
            <em>alone</em> can never justify a collusion finding without a real
            signal of coordination. When the evidence is thin, “inconclusive”
            has to win over a guess.
          </p>
          <p className="mt-3 font-mono text-[12px] text-sky-deep">
            gl.eq_principle.prompt_non_comparative(gather_input, task, criteria)
          </p>
        </div>
      </div>
    </section>
  );
}
