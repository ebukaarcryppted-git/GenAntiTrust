"use client";

import { Dispute } from "@/lib/types";
import { formatGen } from "@/lib/genlayer";

const VERDICT_STYLE: Record<
  string,
  { label: string; emoji: string; bg: string; border: string; text: string }
> = {
  collusion: {
    label: "COLLUSION",
    emoji: "🚨",
    bg: "bg-red-950/40",
    border: "border-red-500/60",
    text: "text-red-300",
  },
  legitimate: {
    label: "LEGITIMATE COMPETITION",
    emoji: "✅",
    bg: "bg-emerald-950/40",
    border: "border-emerald-500/60",
    text: "text-emerald-300",
  },
  inconclusive: {
    label: "INCONCLUSIVE",
    emoji: "❔",
    bg: "bg-amber-950/40",
    border: "border-amber-500/60",
    text: "text-amber-300",
  },
};

export function VerdictCard({ dispute }: { dispute: Dispute }) {
  if (!dispute.verdict) {
    return (
      <div className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-6 text-neutral-400 animate-pulse">
        Validators are independently reasoning over the evidence
        (gl.eq_principle.prompt_non_comparative) …
      </div>
    );
  }

  const style = VERDICT_STYLE[dispute.verdict] ?? VERDICT_STYLE.inconclusive;

  return (
    <div
      className={`rounded-xl border-2 ${style.border} ${style.bg} p-6 shadow-lg animate-[fadeIn_0.4s_ease-out]`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className={`text-2xl font-bold tracking-tight ${style.text}`}>
          {style.emoji} {style.label}
        </div>
        <div className="text-sm text-neutral-400">
          confidence{" "}
          <span className="font-mono text-neutral-100">
            {dispute.confidence}%
          </span>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full rounded-full ${style.text.replace("text-", "bg-")}`}
          style={{ width: `${dispute.confidence}%` }}
        />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-neutral-200">
        {dispute.reasoning}
      </p>

      {dispute.key_signals?.length > 0 && (
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
            Key signals cited by the validators
          </div>
          <ul className="space-y-1">
            {dispute.key_signals.map((s, i) => (
              <li
                key={i}
                className="text-sm text-neutral-300 bg-neutral-800/60 rounded px-2 py-1"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
        <span>bond escrowed: {formatGen(dispute.bond)}</span>
        <span>
          appeals: {dispute.appeal_count}/{dispute.max_appeals}
        </span>
        <span>status: {dispute.status}</span>
        {dispute.resolved_at && <span>resolved: {dispute.resolved_at}</span>}
      </div>
    </div>
  );
}
