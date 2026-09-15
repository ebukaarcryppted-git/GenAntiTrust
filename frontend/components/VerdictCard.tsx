"use client";

import { Dispute } from "@/lib/types";
import { formatGen } from "@/lib/genlayer";

const STYLES: Record<
  string,
  { label: string; chip: string; bar: string; ring: string }
> = {
  collusion: {
    label: "Collusion",
    chip: "bg-darkmilk text-paper",
    bar: "bg-darkmilk",
    ring: "border-darkmilk/30",
  },
  legitimate: {
    label: "Legitimate competition",
    chip: "bg-sky text-ink",
    bar: "bg-sky",
    ring: "border-sky",
  },
  inconclusive: {
    label: "Inconclusive",
    chip: "bg-milk-deep text-ink-muted",
    bar: "bg-ink-faint",
    ring: "border-hairline",
  },
};

export function VerdictCard({ dispute }: { dispute: Dispute }) {
  if (!dispute.verdict) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline bg-milk p-6">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 animate-beacon rounded-full bg-darkmilk" />
          <span className="text-[14px] font-semibold text-ink">
            Validators are reasoning independently…
          </span>
        </div>
        <p className="mt-2 font-mono text-[12px] leading-relaxed text-ink-muted">
          gl.eq_principle.prompt_non_comparative — leader proposes, every
          validator re-judges against the criteria. This takes 1–3 minutes.
        </p>
      </div>
    );
  }

  const s = STYLES[dispute.verdict] ?? STYLES.inconclusive;

  return (
    <div
      className={`animate-rise rounded-2xl border bg-paper p-6 shadow-[0_2px_4px_rgba(19,18,17,0.03),0_24px_48px_-32px_rgba(19,18,17,0.35)] ${s.ring}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold uppercase tracking-wide ${s.chip}`}
        >
          {s.label}
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[26px] font-semibold leading-none tracking-tight text-ink">
            {dispute.confidence}
          </span>
          <span className="text-[13px] text-ink-muted">% confidence</span>
        </div>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-milk-deep">
        <div
          className={`h-full rounded-full transition-all duration-700 ${s.bar}`}
          style={{ width: `${dispute.confidence}%` }}
        />
      </div>

      <p className="mt-5 text-[14.5px] leading-relaxed text-ink">
        {dispute.reasoning}
      </p>

      {dispute.key_signals?.length > 0 && (
        <div className="mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
            Evidence cited
          </div>
          <ul className="mt-2.5 space-y-1.5">
            {dispute.key_signals.map((sig, i) => (
              <li
                key={i}
                className="flex gap-2.5 rounded-lg bg-milk px-3 py-2 text-[13px] leading-relaxed text-ink-muted"
              >
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-darkmilk" />
                <span>{sig}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-hairline pt-4 font-mono text-[11.5px] text-ink-faint">
        <span>{dispute.id}</span>
        <span>bond {formatGen(dispute.bond)}</span>
        <span>
          appeals {dispute.appeal_count}/{dispute.max_appeals}
        </span>
        <span>{dispute.status}</span>
      </div>
    </div>
  );
}
