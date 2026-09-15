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
import { studioAdapter } from "@/lib/genlayer";
import { bradburyAdapter } from "@/lib/bradbury";
import type { NetworkAdapter } from "@/lib/network";
import { Dispute, Scenario } from "@/lib/types";

const NETWORKS: Record<"studio" | "bradbury", NetworkAdapter> = {
  studio: studioAdapter,
  bradbury: bradburyAdapter,
};

// Studio Next enforces 30 requests/minute; three reads every 15s is 12/min,
// well clear of it. Bradbury has no such limit but there's no reason to hit
// it harder than the network that does.
const POLL_MS = 15000;

export default function Home() {
  const [networkId, setNetworkId] = useState<"studio" | "bradbury">("studio");
  const net = NETWORKS[networkId];

  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [scenarioKind, setScenarioKind] = useState<ScenarioKind>("rigged");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [minBond, setMinBond] = useState<bigint>(1_000_000_000_000_000_000n);
  const [treasury, setTreasury] = useState<number>(0);
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [allDisputes, setAllDisputes] = useState<Dispute[]>([]);
  const [claimable, setClaimable] = useState<bigint>(0n);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Switching networks means a different contract and a different wallet
  // chain; a dispute id from the old one is meaningless on the new one.
  function switchNetwork(id: "studio" | "bradbury") {
    setNetworkId(id);
    setAddress(null);
    setDisputeId(null);
    setDispute(null);
    setError(null);
    setNotice(null);
  }

  useEffect(() => {
    fetch(`/scenarios/${scenarioKind}.json`)
      .then((r) => r.json())
      .then(setScenario)
      .catch(() => setScenario(null));
  }, [scenarioKind]);

  const refreshGlobal = useCallback(async () => {
    try {
      const [bond, bal, all] = await Promise.all([
        net.read<string | number>("get_min_bond"),
        net.read<string | number>("get_treasury_balance"),
        net.read<Record<string, Dispute>>("get_all_disputes"),
      ]);
      setMinBond(BigInt(bond));
      setTreasury(Number(bal));
      setAllDisputes(Object.values(all ?? {}).reverse());
    } catch (e) {
      // network hiccup / contract unreachable — non-fatal, the UI stays readable
      console.warn("refreshGlobal failed", e);
    }
  }, [net]);

  useEffect(() => {
    refreshGlobal();
    const t = setInterval(refreshGlobal, POLL_MS);
    return () => clearInterval(t);
  }, [refreshGlobal]);

  const refreshClaimable = useCallback(async () => {
    if (!address || !net.hasWithdraw) {
      setClaimable(0n);
      return;
    }
    try {
      const owed = await net.read<string | number>("get_claimable", [address]);
      setClaimable(BigInt(owed ?? 0));
    } catch {
      setClaimable(0n);
    }
  }, [address, net]);

  useEffect(() => {
    refreshClaimable();
    const t = setInterval(refreshClaimable, POLL_MS);
    return () => clearInterval(t);
  }, [refreshClaimable]);

  const refreshDispute = useCallback(
    async (id: string) => {
      const d = await net.read<Dispute>("get_dispute", [id]);
      setDispute(d);
      return d;
    },
    [net]
  );

  async function withWallet<T>(
    fn: (client: Awaited<ReturnType<typeof net.getWalletClient>>) => Promise<T>
  ) {
    if (!address) {
      setError("Connect a wallet first.");
      return null;
    }
    setError(null);
    try {
      const client = await net.getWalletClient(address);
      return await fn(client);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || String(e));
      return null;
    }
  }

  function describeFailure(
    action: string,
    result: { executionResult?: string; statusName?: string }
  ) {
    return `${action} did not succeed (${result.executionResult ?? result.statusName ?? "unknown"})`;
  }

  async function fileComplaint() {
    if (!scenario) return;
    setBusy("filing");
    setNotice(null);
    try {
      const result = await withWallet((client) =>
        net.write(
          client,
          "file_complaint",
          [scenario.respondent_wallet, scenario.market_id, JSON.stringify(scenario.evidence), ""],
          minBond
        )
      );
      if (result?.success) {
        const ids = await net.read<string[]>("list_disputes");
        const id = ids[ids.length - 1];
        setDisputeId(id);
        await refreshDispute(id);
      } else if (result) {
        setError(describeFailure("file_complaint", result));
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
        net.write(client, "resolve_dispute", [disputeId])
      );
      if (result?.success) await refreshDispute(disputeId);
      else if (result) setError(describeFailure("resolve_dispute", result));
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
        net.write(client, "appeal_verdict", [disputeId, rebuttal], BigInt(dispute.bond))
      );
      if (result?.success) await refreshDispute(disputeId);
      else if (result) setError(describeFailure("appeal_verdict", result));
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
        net.write(client, "finalize_dispute", [disputeId])
      );
      if (result?.success) await refreshDispute(disputeId);
      else if (result) setError(describeFailure("finalize_dispute", result));
    } finally {
      setBusy(null);
      refreshGlobal();
    }
  }

  async function withdraw() {
    setBusy("withdrawing");
    setNotice(null);
    try {
      const result = await withWallet((client) => net.write(client, "withdraw", []));
      if (result?.success) {
        setNotice(
          "Withdrawal accepted. The transfer is an external message, so it lands in your wallet once this transaction finalizes."
        );
      } else if (result) {
        setError(describeFailure("withdraw", result));
      }
    } finally {
      setBusy(null);
      refreshClaimable();
      refreshGlobal();
    }
  }

  return (
    <main className="min-h-screen">
      <Nav
        network={net}
        onSwitchNetwork={switchNetwork}
        address={address}
        onConnect={setAddress}
      />
      <Hero />
      <StatsBand disputeCount={allDisputes.length} minBond={minBond} network={net} />
      <GapSection />
      <Console
        network={net}
        scenario={scenario}
        scenarioKind={scenarioKind}
        setScenarioKind={setScenarioKind}
        dispute={dispute}
        disputeId={disputeId}
        minBond={minBond}
        busy={busy}
        error={error}
        notice={notice}
        address={address}
        onFile={fileComplaint}
        onResolve={resolve}
        onAppeal={appeal}
        onFinalize={finalize}
        onWithdraw={withdraw}
        claimable={claimable}
      />
      <DisputeLedger
        network={net}
        disputes={allDisputes}
        treasury={treasury}
        onSelect={(d) => {
          setDisputeId(d.id);
          setDispute(d);
        }}
      />
      <HowItWorks />
      <Footer network={net} />
    </main>
  );
}
