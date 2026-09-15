"use client";

import { EvidenceRecord } from "@/lib/types";

function shortTime(t: string) {
  // "2026-08-04T03:25:06Z" -> "Aug 04 · 03:25"
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(t);
  if (!m) return t;
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[Number(m[2]) - 1]} ${m[3]} · ${m[4]}:${m[5]}`;
}

export function EvidenceTimeline({ evidence }: { evidence: EvidenceRecord[] }) {
  return (
    <div className="relative">
      <div className="feed-scroll max-h-[420px] overflow-y-auto">
        <ul className="divide-y divide-hairline">
          {evidence.map((r, i) => {
            const isMessage = r.type === "message";
            const isRebuttal = r.type === "rebuttal";
            return (
              <li
                key={i}
                className={`flex items-start gap-3 px-4 py-3 sm:px-5 ${
                  isMessage
                    ? "bg-brand-tint/60"
                    : isRebuttal
                    ? "bg-sky-tint"
                    : ""
                }`}
              >
                <span className="w-[92px] shrink-0 pt-0.5 font-mono text-[11px] leading-5 text-ink-faint">
                  {shortTime(r.t)}
                </span>
                <span
                  className={`w-[88px] shrink-0 truncate pt-0.5 text-[12.5px] font-semibold leading-5 ${
                    isMessage ? "text-brand" : "text-ink"
                  }`}
                >
                  {r.agent}
                </span>
                <span className="min-w-0 flex-1 text-[13px] leading-5">
                  {r.type === "price_update" && (
                    <span className="text-ink-muted">
                      listed at{" "}
                      <span className="font-mono font-medium text-ink">
                        ${r.price?.toFixed(2)}
                      </span>
                    </span>
                  )}
                  {isMessage && (
                    <span className="text-brand-deep">“{r.text}”</span>
                  )}
                  {isRebuttal && (
                    <span className="text-sky-deep">{r.text}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-paper to-transparent" />
    </div>
  );
}
