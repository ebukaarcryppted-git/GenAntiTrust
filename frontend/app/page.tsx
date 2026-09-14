"use client";

import { useCallback, useEffect, useState } from "react";
import { WalletBar } from "@/components/WalletBar";
import { EvidenceTimeline } from "@/components/EvidenceTimeline";
import { VerdictCard } from "@/components/VerdictCard";
import {
  readContract,
  writeContract,
  getWalletClient,
  formatGen,
  CONTRACT_ADDRESS,
} from "@/lib/genlayer";
import { Dispute, Scenario } from "@/lib/types";

type ScenarioKind = "clean" | "rigged";

export default function Home() {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [scenarioKind, setScenarioKind] = useState<ScenarioKind>("rigged");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [minBond, setMinBond] = useState<bigint>(1_000_000_000_000_000_000n);
  const [treasury, setTreasury] = useState<number>(0);
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [allDisputes, setAllDisputes] = useState<Dispute[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/scenarios/${scenarioKind}`)
      .then((r) => r.json())
      .then(setScenario)
      .catch(() => setScenario(null));
  }, [scenarioKind]);

  const refreshGlobal = useCallback(async () => {
    if (!CONTRACT_ADDRESS) return;
    try {
      const [bond, bal, all] = await Promise.all([
        readContract<number>("get_min_bond"),
        readContract<number>("get_treasury_balance"),
        readContract<Record<string, Dispute>>("get_all_disputes"),
      ]);
      setMinBond(BigInt(bond));
      setTreasury(bal);
      setAllDisputes(Object.values(all).reverse());
    } catch (e) {
      // contract not deployed yet / network hiccup - non-fatal for the demo
      console.warn("refreshGlobal failed", e);
    }
  }, []);

  useEffect(() => {
    refreshGlobal();
    const t = setInterval(refreshGlobal, 8000);
    return () => clearInterval(t);
  }, [refreshGlobal]);

  const refreshDispute = useCallback(async (id: string) => {
    const d = await readContract<Dispute>("get_dispute", [id]);
    setDispute(d);
    return d;
  }, []);

  async function withWallet<T>(fn: (client: Awaited<ReturnType<typeof getWalletClient>>) => Promise<T>) {
    if (!address) {
      setError("Connect a wallet first.");
      return null;
    }
    setError(null);
    try {
      const client = await getWalletClient(address);
      return await fn(client);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || String(e));
      return null;
    }
  }

  async function fileComplaint() {
    if (!scenario) return;
    setBusy("filing");
    try {
      const result = await withWallet((client) =>
        writeContract(
          client,
          "file_complaint",
          [scenario.respondent_wallet, scenario.market_id, JSON.stringify(scenario.evidence), ""],
          minBond
        )
      );
      if (result?.success) {
        const ids = await readContract<string[]>("list_disputes");
        const id = ids[ids.length - 1];
        setDisputeId(id);
        await refreshDispute(id);
      } else if (result) {
        setError(`file_complaint did not succeed (${result.statusName ?? "unknown status"})`);
      }
    } finally {
      setBusy(null);
      refreshGlobal();
    }
  }

  async function resolve() {
    if (!disputeId) return;
    setBusy("resolving");
    try {
      const result = await withWallet((client) =>
        writeContract(client, "resolve_dispute", [disputeId])
      );
      if (result?.success) await refreshDispute(disputeId);
      else if (result) setError(`resolve_dispute did not succeed (${result.statusName ?? "unknown"})`);
    } finally {
      setBusy(null);
      refreshGlobal();
    }
  }

  async function appeal() {
    if (!disputeId || !dispute) return;
    setBusy("appealing");
    try {
      const rebuttal = JSON.stringify([
        {
          t: new Date().toISOString(),
          agent: "respondent",
          type: "rebuttal",
          text: "This move matched a publicly reported cost shock, not private coordination.",
        },
      ]);
      const result = await withWallet((client) =>
        writeContract(client, "appeal_verdict", [disputeId, rebuttal], BigInt(dispute.bond))
      );
      if (result?.success) await refreshDispute(disputeId);
      else if (result) setError(`appeal_verdict did not succeed (${result.statusName ?? "unknown"})`);
    } finally {
      setBusy(null);
      refreshGlobal();
    }
  }

  async function finalize() {
    if (!disputeId) return;
    setBusy("finalizing");
    try {
      const result = await withWallet((client) =>
        writeContract(client, "finalize_dispute", [disputeId])
      );
      if (result?.success) await refreshDispute(disputeId);
      else if (result) setError(`finalize_dispute did not succeed (${result.statusName ?? "unknown"})`);
    } finally {
      setBusy(null);
      refreshGlobal();
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      <WalletBar address={address} onConnect={setAddress} />

      {!CONTRACT_ADDRESS && (
        <div className="rounded-lg border border-amber-700 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          NEXT_PUBLIC_CONTRACT_ADDRESS is not set. Deploy the contract
          (<code>python scripts/deploy.py</code>) and set it in{" "}
          <code>frontend/.env.local</code>.
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
            1. Marketplace scenario
          </h2>
          <span className="text-xs text-neutral-500">(simulated evidence feed)</span>
        </div>
        <div className="flex gap-2">
          {(["rigged", "clean"] as ScenarioKind[]).map((k) => (
            <button
              key={k}
              onClick={() => setScenarioKind(k)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                scenarioKind === k
                  ? "bg-indigo-600 text-white"
                  : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {k === "rigged" ? "🚨 Rigged market" : "✅ Clean market"}
            </button>
          ))}
        </div>
        {scenario && (
          <>
            <p className="text-sm text-neutral-400">{scenario.summary}</p>
            <EvidenceTimeline evidence={scenario.evidence} />
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
          2. File &amp; resolve a dispute
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={fileComplaint}
            disabled={!!busy || !scenario}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy === "filing" ? "Filing…" : `File complaint (${formatGen(minBond)} bond)`}
          </button>
          <button
            onClick={resolve}
            disabled={!disputeId || !!busy || dispute?.status !== "filed"}
            className="rounded-lg bg-neutral-700 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-600 disabled:opacity-50"
          >
            {busy === "resolving" ? "Resolving…" : "Resolve dispute (verdict moment)"}
          </button>
          <button
            onClick={appeal}
            disabled={
              !disputeId ||
              !!busy ||
              dispute?.status !== "verdict_reached" ||
              (dispute?.appeal_count ?? 0) >= (dispute?.max_appeals ?? 0)
            }
            className="rounded-lg bg-neutral-700 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-600 disabled:opacity-50"
          >
            {busy === "appealing" ? "Appealing…" : "Appeal with rebuttal"}
          </button>
          <button
            onClick={finalize}
            disabled={!disputeId || !!busy || dispute?.status !== "verdict_reached"}
            className="rounded-lg bg-neutral-700 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-600 disabled:opacity-50"
          >
            {busy === "finalizing" ? "Finalizing…" : "Finalize (release escrow)"}
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {disputeId && (
          <p className="text-xs text-neutral-500 font-mono">dispute: {disputeId}</p>
        )}
      </section>

      {dispute && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
            3. Verdict
          </h2>
          <VerdictCard dispute={dispute} />
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wide">
            All disputes
          </h2>
          <span className="text-xs text-neutral-500">
            treasury: {formatGen(treasury)}
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-neutral-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900 text-neutral-500">
              <tr>
                <th className="px-3 py-2">id</th>
                <th className="px-3 py-2">market</th>
                <th className="px-3 py-2">status</th>
                <th className="px-3 py-2">verdict</th>
                <th className="px-3 py-2">confidence</th>
                <th className="px-3 py-2">bond</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {allDisputes.map((d) => (
                <tr
                  key={d.id}
                  className="hover:bg-neutral-900 cursor-pointer"
                  onClick={() => {
                    setDisputeId(d.id);
                    setDispute(d);
                  }}
                >
                  <td className="px-3 py-2 font-mono">{d.id}</td>
                  <td className="px-3 py-2">{d.market_id}</td>
                  <td className="px-3 py-2">{d.status}</td>
                  <td className="px-3 py-2">{d.verdict || "—"}</td>
                  <td className="px-3 py-2">{d.verdict ? `${d.confidence}%` : "—"}</td>
                  <td className="px-3 py-2">{formatGen(d.bond)}</td>
                </tr>
              ))}
              {allDisputes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-neutral-600">
                    No disputes filed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
