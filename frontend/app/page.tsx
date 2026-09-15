"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { StatsBand } from "@/components/StatsBand";
import { GapSection } from "@/components/GapSection";
import { Console, ScenarioKind } from "@/components/Console";
import { DisputeLedger } from "@/components/DisputeLedger";
import { HowItWorks } from "@/components/HowItWorks";
import { Footer } from "@/components/Footer";
import {
  readContract,
  writeContract,
  getWalletClient,
  CONTRACT_ADDRESS,
} from "@/lib/genlayer";
import { Dispute, Scenario } from "@/lib/types";

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
    fetch(`/scenarios/${scenarioKind}.json`)
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
      // network hiccup / contract unreachable — non-fatal, the UI stays readable
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

  async function withWallet<T>(
    fn: (client: Awaited<ReturnType<typeof getWalletClient>>) => Promise<T>
  ) {
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
          [
            scenario.respondent_wallet,
            scenario.market_id,
            JSON.stringify(scenario.evidence),
            "",
          ],
          minBond
        )
      );
      if (result?.success) {
        const ids = await readContract<string[]>("list_disputes");
        const id = ids[ids.length - 1];
        setDisputeId(id);
        await refreshDispute(id);
      } else if (result) {
        setError(
          `file_complaint did not succeed (${result.statusName ?? "unknown status"})`
        );
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
      else if (result)
        setError(
          `resolve_dispute did not succeed (${result.statusName ?? "unknown"})`
        );
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
        writeContract(
          client,
          "appeal_verdict",
          [disputeId, rebuttal],
          BigInt(dispute.bond)
        )
      );
      if (result?.success) await refreshDispute(disputeId);
      else if (result)
        setError(
          `appeal_verdict did not succeed (${result.statusName ?? "unknown"})`
        );
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
      else if (result)
        setError(
          `finalize_dispute did not succeed (${result.statusName ?? "unknown"})`
        );
    } finally {
      setBusy(null);
      refreshGlobal();
    }
  }

  return (
    <main className="min-h-screen">
      <Nav address={address} onConnect={setAddress} />
      <Hero />
      <StatsBand disputeCount={allDisputes.length} minBond={minBond} />
      <GapSection />
      <Console
        scenario={scenario}
        scenarioKind={scenarioKind}
        setScenarioKind={setScenarioKind}
        dispute={dispute}
        disputeId={disputeId}
        minBond={minBond}
        busy={busy}
        error={error}
        address={address}
        onFile={fileComplaint}
        onResolve={resolve}
        onAppeal={appeal}
        onFinalize={finalize}
      />
      <DisputeLedger
        disputes={allDisputes}
        treasury={treasury}
        onSelect={(d) => {
          setDisputeId(d.id);
          setDispute(d);
        }}
      />
      <HowItWorks />
      <Footer />
    </main>
  );
}
