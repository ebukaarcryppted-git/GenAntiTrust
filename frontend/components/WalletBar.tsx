"use client";

import { useState } from "react";
import { NETWORK, CONTRACT_ADDRESS } from "@/lib/genlayer";

export function WalletBar({
  address,
  onConnect,
}: {
  address: string | null;
  onConnect: (addr: `0x${string}`) => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    setConnecting(true);
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error("No wallet found. Install MetaMask.");
      const accounts: string[] = await eth.request({
        method: "eth_requestAccounts",
      });
      if (accounts[0]) onConnect(accounts[0] as `0x${string}`);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-800 pb-4">
      <div>
        <h1 className="text-lg font-semibold text-neutral-100">
          GenAntiTrust Tribunal
        </h1>
        <p className="text-xs text-neutral-500 font-mono">
          {NETWORK} · {CONTRACT_ADDRESS || "CONTRACT_ADDRESS not set"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-red-400">{error}</span>}
        {address ? (
          <span className="rounded-full bg-neutral-800 px-3 py-1.5 text-xs font-mono text-emerald-300">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        ) : (
          <button
            onClick={connect}
            disabled={connecting}
            className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </div>
    </div>
  );
}
