"use client";

import { EvidenceRecord } from "@/lib/types";

export function EvidenceTimeline({ evidence }: { evidence: EvidenceRecord[] }) {
  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border border-neutral-800 divide-y divide-neutral-800">
      {evidence.map((r, i) => (
        <div
          key={i}
          className={`px-3 py-2 text-xs flex items-start gap-3 ${
            r.type === "message"
              ? "bg-red-950/30"
              : r.type === "rebuttal"
              ? "bg-sky-950/30"
              : ""
          }`}
        >
          <span className="text-neutral-500 shrink-0 w-40 font-mono">
            {r.t}
          </span>
          <span className="shrink-0 w-28 truncate font-medium text-neutral-300">
            {r.agent}
          </span>
          <span className="flex-1 text-neutral-400">
            {r.type === "price_update" && (
              <>
                set price to{" "}
                <span className="text-neutral-200 font-mono">
                  ${r.price?.toFixed(2)}
                </span>
              </>
            )}
            {r.type === "message" && (
              <span className="text-red-300">💬 {r.text}</span>
            )}
            {r.type === "rebuttal" && (
              <span className="text-sky-300">📎 {r.text}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
