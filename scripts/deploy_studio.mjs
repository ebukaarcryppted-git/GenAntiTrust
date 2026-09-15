/**
 * Deploy contracts/tribunal.py to GenLayer Studio Next (Consensus v0.6).
 *
 *   node scripts/deploy_studio.mjs
 *
 * Writes STUDIO_CONTRACT_ADDRESS back into .env on success.
 */
import fs from "node:fs";
import path from "node:path";
import { isSuccessful } from "genlayer-js";
import {
  ROOT,
  STUDIO_EXPLORER,
  STUDIO_RPC,
  ensureFunded,
  getStudioAccount,
  getStudioClient,
  quoteFees,
  writeEnv,
} from "./studio_client.mjs";

const CONTRACT = path.join(ROOT, "contracts", "tribunal.py");

/**
 * Consensus v0.6: an ACCEPTED/FINALIZED status only says the round reached a
 * decision — the contract can still have reverted inside it. Require the
 * execution result too, per the migration guide.
 */
function isDeployed(receipt) {
  const n = Number(receipt.status);
  const decided =
    n === 5 ||
    n === 7 ||
    receipt.statusName === "ACCEPTED" ||
    receipt.statusName === "FINALIZED";
  return decided && receipt.txExecutionResultName === "FINISHED_WITH_RETURN";
}

async function main() {
  const account = getStudioAccount();
  const client = getStudioClient(account);

  console.log(`Network:  Studio Next (${STUDIO_RPC}, chain 61997)`);
  console.log(`Deployer: ${account.address}`);

  const balance = await ensureFunded(client, account);
  console.log(`Balance:  ${Number(balance) / 1e18} GEN`);

  const code = new Uint8Array(fs.readFileSync(CONTRACT));
  console.log(`Deploying ${path.relative(ROOT, CONTRACT)} (${code.length} bytes)…`);

  const fees = await quoteFees(client, "deploy");
  console.log(`Fee quote: ${Number(fees.feeValue) / 1e18} GEN deposit`);

  const hash = await client.deployContract({ code, args: [], fees });
  console.log(`Deploy tx: ${hash}`);

  const receipt = await client.waitForTransactionReceipt({
    hash,
    waitUntil: "decided",
    interval: 2000,
    retries: 300,
  });

  console.log(`Status:    ${receipt.statusName ?? receipt.status}`);
  console.log(`Execution: ${receipt.txExecutionResultName ?? "-"}`);

  if (!isDeployed(receipt)) {
    console.error(JSON.stringify(receipt, (k, v) => (typeof v === "bigint" ? String(v) : v), 2));
    throw new Error("Deployment was not accepted");
  }

  const address =
    receipt.data?.contract_address ?? receipt.txDataDecoded?.contractAddress;
  if (!address) throw new Error("Receipt carried no contract address");

  console.log(`\nContract:  ${address}`);
  console.log(`Explorer:  ${STUDIO_EXPLORER}address/${address}`);
  console.log(`isSuccessful(): ${isSuccessful(receipt)}`);

  writeEnv({
    STUDIO_CONTRACT_ADDRESS: address,
    NEXT_PUBLIC_CONTRACT_ADDRESS: address,
  });
  console.log("\nWrote STUDIO_CONTRACT_ADDRESS + NEXT_PUBLIC_CONTRACT_ADDRESS to .env");
}

main().catch((e) => {
  console.error("\nDeploy failed:", e?.message || e);
  process.exit(1);
});
