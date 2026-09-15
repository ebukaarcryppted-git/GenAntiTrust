"use client";

import { useState } from "react";
import { BrandLockup } from "@/components/Brand";
import type { NetworkAdapter } from "@/lib/network";

const LINKS = [
  { href: "#the-gap", label: "The gap" },
  { href: "#console", label: "Tribunal" },
  { href: "#how", label: "How it works" },
];

export function Nav({
  network,
  onSwitchNetwork,
  address,
  onConnect,
}: {
  network: NetworkAdapter;
  onSwitchNetwork: (id: "studio" | "bradbury") => void;
  address: string | null;
  onConnect: (addr: `0x${string}`) => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    setConnecting(true);
    try {
      // adds/switches the wallet to the active network before returning
      onConnect(await network.connect());
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setConnecting(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 rounded-2xl border border-hairline bg-paper/85 pl-5 pr-3 shadow-[0_1px_2px_rgba(19,18,17,0.04),0_12px_32px_-18px_rgba(19,18,17,0.22)] backdrop-blur-xl">
        <a href="#top" className="shrink-0">
          <BrandLockup />
        </a>

        <div className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-[14px] font-medium text-ink-muted transition-colors hover:bg-milk-deep hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {error && (
            <span className="hidden max-w-[160px] truncate text-xs text-darkmilk sm:block">
              {error}
            </span>
          )}

          <div className="flex gap-0.5 rounded-xl bg-milk-deep p-0.5">
            {(["studio", "bradbury"] as const).map((id) => (
              <button
                key={id}
                onClick={() => onSwitchNetwork(id)}
                title={id === "studio" ? "GenLayer Studio Next (Consensus v0.6)" : "GenLayer Testnet Bradbury (Consensus v0.5)"}
                className={`rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors ${
                  network.id === id
                    ? "bg-paper text-ink shadow-[0_1px_2px_rgba(19,18,17,0.08)]"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {id === "studio" ? "Studio Next" : "Bradbury"}
              </button>
            ))}
          </div>

          <a
            href={`${network.explorerUrl}address/${network.contractAddress}`}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-xl border border-hairline px-3.5 py-2 text-[13.5px] font-medium text-ink transition-colors hover:bg-milk-deep xl:block"
          >
            Contract ↗
          </a>
          {address ? (
            <span className="flex items-center gap-2 rounded-xl border border-sky bg-sky-tint px-3.5 py-2 font-mono text-[13px] text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-ink" />
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
          ) : (
            <button
              onClick={connect}
              disabled={connecting}
              className="rounded-xl bg-darkmilk px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-all hover:bg-darkmilk-deep disabled:opacity-50"
            >
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
