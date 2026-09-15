"use client";

import { formatGenCompact } from "@/lib/genlayer";

function Stat({
  value,
  label,
  detail,
}: {
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="px-6 py-8 text-center sm:py-10">
      <div className="text-[34px] font-semibold leading-none tracking-[-0.04em] text-ink sm:text-[40px]">
        {value}
      </div>
      <div className="mt-3 text-[14.5px] font-semibold text-ink">{label}</div>
      <p className="mx-auto mt-1.5 max-w-[24ch] text-[13px] leading-relaxed text-ink-muted">
        {detail}
      </p>
    </div>
  );
}

export function StatsBand({
  disputeCount,
  minBond,
}: {
  disputeCount: number;
  minBond: bigint;
}) {
  return (
    <section className="px-4 pt-20 sm:px-6 sm:pt-28">
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-[13px] font-medium uppercase tracking-[0.14em] text-ink-faint">
          Running live, not mocked
        </p>
        <div className="mt-8 grid grid-cols-1 divide-y divide-hairline sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
          <Stat
            value={String(disputeCount)}
            label="Verdicts on-chain"
            detail="Every one decided by a real Equivalence Principle round on Bradbury."
          />
          <Stat
            value="5"
            label="Validators per round"
            detail="Each independently re-judges the leader's answer against the criteria."
          />
          <Stat
            value={formatGenCompact(minBond).replace(" GEN", "")}
            label="GEN minimum bond"
            detail="Escrowed on filing, released deterministically by the verdict."
          />
          <Stat
            value="0"
            label="Deterministic fallbacks"
            detail="Remove the AI call and the contract cannot decide anything at all."
          />
        </div>
      </div>
    </section>
  );
}
