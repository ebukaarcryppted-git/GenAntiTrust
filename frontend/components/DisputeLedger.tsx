"use client";

import { formatGen } from "@/lib/genlayer";
import type { NetworkAdapter } from "@/lib/network";
import { Dispute } from "@/lib/types";

const VERDICT_CHIP: Record<string, string> = {
  collusion: "bg-darkmilk text-milk",
  legitimate: "bg-sky-tint text-ink",
  inconclusive: "bg-milk-deep text-ink-muted",
};

export function DisputeLedger({
  network,
  disputes,
  treasury,
  onSelect,
}: {
  network: NetworkAdapter;
  disputes: Dispute[];
  treasury: number;
  onSelect: (d: Dispute) => void;
}) {
  return (
    <section className="px-4 pt-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-2xl border border-hairline bg-paper">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-4">
            <div>
              <div className="text-[15px] font-semibold text-ink">
                Dispute ledger
              </div>
              <div className="text-[12.5px] text-ink-muted">
                Read live from {network.shortLabel}, polled every 15 seconds
              </div>
            </div>
            <span className="rounded-lg bg-milk px-3 py-1.5 font-mono text-[12px] text-ink-muted">
              escrow held: {formatGen(treasury)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-hairline text-[11px] uppercase tracking-[0.1em] text-ink-faint">
                  <th className="px-5 py-3 font-medium">Dispute</th>
                  <th className="px-5 py-3 font-medium">Market</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Verdict</th>
                  <th className="px-5 py-3 font-medium">Confidence</th>
                  <th className="px-5 py-3 font-medium">Bond</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {disputes.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => onSelect(d)}
                    className="cursor-pointer transition-colors hover:bg-milk"
                  >
                    <td className="px-5 py-3.5 font-mono text-[12.5px] text-ink">
                      {d.id}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-ink-muted">
                      {d.market_id}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-ink-muted">
                      {d.status.replace("_", " ")}
                    </td>
                    <td className="px-5 py-3.5">
                      {d.verdict ? (
                        <span
                          className={`rounded-md px-2 py-1 text-[12px] font-semibold ${
                            VERDICT_CHIP[d.verdict] ?? VERDICT_CHIP.inconclusive
                          }`}
                        >
                          {d.verdict}
                        </span>
                      ) : (
                        <span className="text-[13px] text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[12.5px] text-ink-muted">
                      {d.verdict ? `${d.confidence}%` : "—"}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[12.5px] text-ink-muted">
                      {formatGen(d.bond)}
                    </td>
                  </tr>
                ))}
                {disputes.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-14 text-center text-[13.5px] text-ink-faint"
                    >
                      No disputes filed yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-hairline px-5 py-3.5">
            <a
              href={`${network.explorerUrl}address/${network.contractAddress}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[12px] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              {network.contractAddress} ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
