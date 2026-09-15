/**
 * End-to-end GenAntiTrust lifecycle against Studio Next (Consensus v0.6).
 *
 *   node scripts/demo_studio.mjs rigged --appeal --finalize
 *   node scripts/demo_studio.mjs clean --finalize
 *
 * Files a complaint from a simulator scenario, resolves it (the
 * Equivalence-Principle verdict moment), optionally appeals, then finalizes —
 * all as real fee-funded transactions on the deployed contract.
 */
import fs from "node:fs";
import path from "node:path";
import { isSuccessful } from "genlayer-js";
import {
  ROOT,
  STUDIO_EXPLORER,
  ensureFunded,
  getStudioAccount,
  getStudioClient,
  quoteFees,
  quoteFeesForWrite,
  readEnv,
} from "./studio_client.mjs";

const args = process.argv.slice(2);
const kind = args.find((a) => !a.startsWith("--")) || "rigged";
const wantAppeal = args.includes("--appeal");
const wantFinalize = args.includes("--finalize");

/** v2 decodes contract dicts as Maps; normalise to plain JS objects. */
export function toPlain(value) {
  if (value instanceof Map) {
    return Object.fromEntries([...value.entries()].map(([k, v]) => [k, toPlain(v)]));
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  }
  return value;
}

const banner = (t) => console.log(`\n${"=".repeat(74)}\n${t}\n${"=".repeat(74)}`);

const account = getStudioAccount();
const client = getStudioClient(account);
const address = readEnv().STUDIO_CONTRACT_ADDRESS;
if (!address) throw new Error("STUDIO_CONTRACT_ADDRESS missing — run deploy_studio.mjs");

const read = async (fn, a = []) =>
  toPlain(await client.readContract({ address, functionName: fn, args: a }));

async function write(fn, a = [], value = 0n, { simulate = false } = {}) {
  // Message-emitting calls need a simulation-derived allocation tree.
  const fees = simulate
    ? await quoteFeesForWrite(client, { address, functionName: fn, args: a, value })
    : await quoteFees(client, fn);
  process.stdout.write(`  -> ${fn}(${a.map((x) => String(x).slice(0, 40)).join(", ")})\n`);
  console.log(`     fee deposit: ${Number(fees.feeValue) / 1e18} GEN`);

  const hash = await client.writeContract({
    address,
    functionName: fn,
    args: a,
    value,
    fees,
  });
  console.log(`     tx: ${hash}`);

  const receipt = await client.waitForTransactionReceipt({
    hash,
    waitUntil: "decided",
    interval: 2000,
    retries: 300,
  });
  // v0.6: status alone is not success — check the execution result too.
  const ok = isSuccessful(receipt);
  console.log(
    `     status: ${receipt.statusName} | execution: ${receipt.txExecutionResultName} | ok: ${ok}`
  );
  return { receipt, ok };
}

function printDispute(d) {
  console.log(`  id            ${d.id}`);
  console.log(`  status        ${d.status}`);
  console.log(`  bond (wei)    ${d.bond}`);
  console.log(`  appeals       ${d.appeal_count}/${d.max_appeals}`);
  if (d.verdict) {
    const mark = { collusion: "[!]", legitimate: "[ok]", inconclusive: "[?]" }[d.verdict] || "";
    console.log(`\n  ${mark} VERDICT: ${String(d.verdict).toUpperCase()} (confidence ${d.confidence}%)`);
    console.log(`  reasoning: ${d.reasoning}`);
    for (const s of d.key_signals || []) console.log(`    - ${s}`);
  }
}

const scenarioPath = path.join(ROOT, "simulator", "scenarios", `${kind}.json`);
const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));

banner(`GenAntiTrust @ ${address} (Studio Next, chain 61997)`);
console.log(`Caller: ${account.address}`);
await ensureFunded(client, account);

const minBond = BigInt(await read("get_min_bond"));
console.log(`Minimum bond: ${Number(minBond) / 1e18} GEN`);
console.log(`\nScenario: ${kind} — ${scenario.summary}`);

banner("1. Filing the complaint (escrows the bond)");
const filed = await write(
  "file_complaint",
  [scenario.respondent_wallet, scenario.market_id, JSON.stringify(scenario.evidence), ""],
  minBond
);
if (!filed.ok) throw new Error("file_complaint did not succeed");

const ids = await read("list_disputes");
const disputeId = ids[ids.length - 1];
console.log(`Dispute filed: ${disputeId}`);

banner("2. Resolving — validators judge the evidence independently");
const t0 = Date.now();
const resolved = await write("resolve_dispute", [disputeId]);
console.log(`(took ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
printDispute(await read("get_dispute", [disputeId]));
if (!resolved.ok) {
  console.log("\nresolve_dispute did not reach a verdict (validator timeout / no majority).");
  console.log("This is a legitimate consensus outcome — the dispute stays 'filed' and can be retried.");
  process.exit(1);
}

if (wantAppeal) {
  banner("3. Appealing with a rebuttal");
  const d = await read("get_dispute", [disputeId]);
  const rebuttal = JSON.stringify([
    {
      t: new Date().toISOString(),
      agent: scenario.respondent_name,
      type: "rebuttal",
      text: "Respondent contends the moves tracked a public cost shock, not private coordination.",
    },
  ]);
  await write("appeal_verdict", [disputeId, rebuttal], BigInt(d.bond));
  printDispute(await read("get_dispute", [disputeId]));
}

if (wantFinalize) {
  const d = await read("get_dispute", [disputeId]);
  if (d.status === "verdict_reached") {
    banner("4. Finalizing — releasing escrow per the verdict");
    await write("finalize_dispute", [disputeId]);
    printDispute(await read("get_dispute", [disputeId]));
  } else {
    console.log(`\nSkipping finalize: status is '${d.status}'.`);
  }
}

banner("5. Withdrawing the settled award (pull payment)");
const owed = await read("get_claimable", [account.address]);
console.log(`Claimable for ${account.address}: ${Number(owed) / 1e18} GEN`);
if (BigInt(owed) > 0n) {
  const before = await client.getBalance({ address: account.address });
  await write("withdraw", [], 0n, { simulate: true });
  console.log(`Wallet before: ${Number(before) / 1e18} GEN`);
  console.log(
    "(the transfer is an external message — it credits once this tx finalizes)"
  );
} else {
  console.log("Nothing owed to this account.");
}

banner("Done");
console.log(`Explorer: ${STUDIO_EXPLORER}address/${address}`);
