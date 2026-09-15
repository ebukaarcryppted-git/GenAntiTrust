"use client";

import { EvidenceTimeline } from "@/components/EvidenceTimeline";
import { VerdictCard } from "@/components/VerdictCard";
import { formatGenCompact } from "@/lib/genlayer";
import type { NetworkAdapter } from "@/lib/network";
import { Dispute, Scenario } from "@/lib/types";

export type ScenarioKind = "clean" | "rigged";

type Step = {
  n: number;
  title: string;
  body: string;
  cta: string;
  busyLabel: string;
  busyKey: string;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
};

export function Console({
  network,
  scenario,
  scenarioKind,
  setScenarioKind,
  dispute,
  disputeId,
  minBond,
  busy,
  error,
  notice,
  address,
  onFile,
  onResolve,
  onAppeal,
  onFinalize,
  onWithdraw,
  claimable,
}: {
  network: NetworkAdapter;
  scenario: Scenario | null;
  scenarioKind: ScenarioKind;
  setScenarioKind: (k: ScenarioKind) => void;
  dispute: Dispute | null;
  disputeId: string | null;
  minBond: bigint;
  busy: string | null;
  error: string | null;
  notice?: string | null;
  address: string | null;
  onFile: () => void;
  onResolve: () => void;
  onAppeal: () => void;
  onFinalize: () => void;
  onWithdraw: () => void;
  claimable: bigint;
}) {
  const steps: Step[] = [
    {
      n: 1,
      title: "File the complaint",
      body: `Escrows a ${formatGenCompact(minBond)} bond with the evidence above.`,
      cta: "File complaint",
      busyLabel: "Filing…",
      busyKey: "filing",
      onClick: onFile,
      disabled: !!busy || !scenario,
      primary: true,
    },
    {
      n: 2,
      title: "Resolve — the verdict moment",
      body: "Runs the Equivalence Principle round across five validators.",
      cta: "Resolve dispute",
      busyLabel: "Judging…",
      busyKey: "resolving",
      onClick: onResolve,
      disabled: !disputeId || !!busy || dispute?.status !== "filed",
    },
    {
      n: 3,
      title: "Appeal with a rebuttal",
      body: "Posts a matching bond and forces a re-judgment on new evidence.",
      cta: "Appeal verdict",
      busyLabel: "Appealing…",
      busyKey: "appealing",
      onClick: onAppeal,
      disabled:
        !disputeId ||
        !!busy ||
        dispute?.status !== "verdict_reached" ||
        (dispute?.appeal_count ?? 0) >= (dispute?.max_appeals ?? 0),
    },
    {
      n: 4,
      title: network.hasWithdraw ? "Finalize and settle" : "Finalize and release escrow",
      body: network.hasWithdraw
        ? "Credits the bond to the winning party's ledger, deterministically."
        : "Pays the bond directly to the winning party, deterministically.",
      cta: "Finalize",
      busyLabel: "Finalizing…",
      busyKey: "finalizing",
      onClick: onFinalize,
      disabled: !disputeId || !!busy || dispute?.status !== "verdict_reached",
    },
    ...(network.hasWithdraw
      ? [
          {
            n: 5,
            title: "Withdraw your award",
            body:
              claimable > 0n
                ? `${formatGenCompact(claimable)} is owed to your wallet.`
                : "Settled awards are pulled by their owner, not pushed.",
            cta: "Withdraw",
            busyLabel: "Withdrawing…",
            busyKey: "withdrawing",
            onClick: onWithdraw,
            disabled: !!busy || claimable <= 0n,
          },
        ]
      : []),
  ];

  return (
    <section id="console" className="px-4 pt-24 sm:px-6 sm:pt-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink sm:text-[42px]">
            The tribunal console
          </h2>
          <p className="mt-5 text-[16px] leading-relaxed text-ink-muted">
            Pick a marketplace, read the evidence, and put it to the validators.
            Every action here is a real transaction on {network.label}.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-12">
          {/* Evidence */}
          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-2xl border border-hairline bg-paper">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
                <div>
                  <div className="text-[15px] font-semibold text-ink">
                    Evidence feed
                  </div>
                  <div className="text-[12.5px] text-ink-muted">
                    Simulated agent negotiation log
                  </div>
                </div>
                <div className="flex gap-1 rounded-xl bg-milk-deep p-1">
                  {(["rigged", "clean"] as ScenarioKind[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setScenarioKind(k)}
                      className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                        scenarioKind === k
                          ? "bg-paper text-ink shadow-[0_1px_2px_rgba(19,18,17,0.08)]"
                          : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      {k === "rigged" ? "Rigged" : "Clean"}
                    </button>
                  ))}
                </div>
              </div>

              {scenario ? (
                <>
                  <p className="border-b border-hairline px-5 py-4 text-[13.5px] leading-relaxed text-ink-muted">
                    {scenario.summary}
                  </p>
                  <EvidenceTimeline evidence={scenario.evidence} />
                </>
              ) : (
                <div className="px-5 py-16 text-center text-[13.5px] text-ink-faint">
                  Loading scenario…
                </div>
              )}
            </div>
          </div>

          {/* Actions + verdict */}
          <div className="space-y-5 lg:col-span-5">
            <div className="rounded-2xl border border-hairline bg-paper p-5">
              <div className="flex items-center justify-between">
                <div className="text-[15px] font-semibold text-ink">
                  Dispute lifecycle
                </div>
                {disputeId && (
                  <span className="font-mono text-[11.5px] text-ink-faint">
                    {disputeId}
                  </span>
                )}
              </div>

              {!address && (
                <div className="mt-4 rounded-xl border border-sky bg-sky-tint px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink">
                  Connect a wallet on {network.label} (chain{" "}
                  {parseInt(network.chainIdHex, 16)}) to run these steps — it
                  will be added for you. The dashboard stays fully readable
                  without one.
                </div>
              )}

              <ol className="mt-4 space-y-2">
                {steps.map((s) => {
                  const isBusy = busy === s.busyKey;
                  return (
                    <li
                      key={s.n}
                      className={`flex flex-wrap items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                        s.disabled && !isBusy
                          ? "border-hairline bg-milk opacity-60"
                          : "border-hairline bg-paper"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11.5px] font-semibold ${
                          s.disabled && !isBusy
                            ? "bg-milk-deep text-ink-faint"
                            : "bg-darkmilk-tint text-darkmilk"
                        }`}
                      >
                        {s.n}
                      </span>
                      <div className="min-w-[11rem] flex-1">
                        <div className="text-[13.5px] font-semibold text-ink">
                          {s.title}
                        </div>
                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">
                          {s.body}
                        </p>
                      </div>
                      <button
                        onClick={s.onClick}
                        disabled={s.disabled}
                        className={`w-full shrink-0 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed sm:w-auto sm:self-center ${
                          s.primary
                            ? "bg-darkmilk text-paper hover:bg-darkmilk-deep disabled:bg-milk-deep disabled:text-ink-faint"
                            : "border border-hairline bg-paper text-ink hover:bg-milk-deep disabled:text-ink-faint"
                        }`}
                      >
                        {isBusy ? s.busyLabel : s.cta}
                      </button>
                    </li>
                  );
                })}
              </ol>

              {error && (
                <p className="mt-4 rounded-xl bg-darkmilk-tint px-3.5 py-2.5 text-[12.5px] leading-relaxed text-darkmilk-deep">
                  {error}
                </p>
              )}
              {notice && !error && (
                <p className="mt-4 rounded-xl border border-sky bg-sky-tint px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink">
                  {notice}
                </p>
              )}
            </div>

            {dispute && <VerdictCard dispute={dispute} />}
          </div>
        </div>
      </div>
    </section>
  );
}
