/**
 * Shared Studio Next (Consensus v0.6) client for the Node-side scripts.
 *
 * genlayer-js 2.0.0-rc.1 ships a `studioDevnet` preset pointing at
 * studio-dev.genlayer.com. Studio Next is the same chain (id 61997, verified
 * via eth_chainId) under the developer-facing hostname, so we clone the preset
 * and swap only the RPC — chain identity and consensus addresses must stay
 * aligned, per the v0.6 migration guide.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAccount,
  createClient,
  generatePrivateKey,
} from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const STUDIO_RPC =
  process.env.STUDIO_RPC_URL || "https://studio-next.genlayer.com/api";
export const STUDIO_EXPLORER = "https://explorer-studio-dev.genlayer.com/";

export const STUDIO_CHAIN = {
  ...studioDevnet,
  name: "GenLayer Studio Next",
  rpcUrls: { default: { http: [STUDIO_RPC] } },
};

const ENV_PATH = path.join(ROOT, ".env");

export function readEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const out = {};
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

export function writeEnv(updates) {
  const lines = fs.existsSync(ENV_PATH)
    ? fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)
    : [];
  for (const [key, value] of Object.entries(updates)) {
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (idx >= 0) lines[idx] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  fs.writeFileSync(ENV_PATH, lines.filter((l, i, a) => l || i < a.length - 1).join("\n") + "\n");
}

/**
 * Studio accounts are ephemeral and faucet-funded, so the script mints its own
 * key on first run rather than reusing the Bradbury deployer.
 */
export function getStudioAccount() {
  const env = { ...readEnv(), ...process.env };
  let key = (env.STUDIO_PRIVATE_KEY || "").trim();
  if (!key) {
    key = generatePrivateKey();
    writeEnv({ STUDIO_PRIVATE_KEY: key });
    console.log("Generated a new Studio Next key and stored it in .env");
  }
  return createAccount(key);
}

export function getStudioClient(account) {
  return createClient({ chain: STUDIO_CHAIN, account, endpoint: STUDIO_RPC });
}

/**
 * Consensus v0.6 funds every deploy and write up front: the transaction must
 * carry a FeesDistribution and a quoted feeValue, or the consensus contract
 * reverts with FeeValueMustBeNonZero. We keep a small profile per operation
 * (mirroring the boilerplate's fee-profile.json) and let the SDK price it
 * against live network rates. Unused budget is refunded at finalization.
 *
 * resolve_dispute / appeal_verdict run an LLM round across five validators,
 * so they get a far larger execution budget and time allocation than the
 * purely deterministic calls.
 */
/**
 * Budgets are expressed as multiples of the network's live
 * `executionBudgetFloor` rather than absolute numbers: the floor is a policy
 * value (currently ~7.65e13) and anything under it reverts with BudgetTooLow,
 * so hardcoding would silently rot the next time the policy moves.
 */
/**
 * Phase timeouts are bounded by the network policy (min_commit/propose 30,
 * max 600 time units). Asking for more reverts with PhaseTimeoutOutOfBounds,
 * so LLM-heavy calls take the maximum phase time and buy their real headroom
 * through executionBudgetPerRound instead.
 */
export const TIMEUNIT_MIN = 30;
export const TIMEUNIT_MAX = 600;
const clampTimeunits = (n) => Math.max(TIMEUNIT_MIN, Math.min(TIMEUNIT_MAX, n));

export const FEE_PROFILE = {
  deploy: { leader: 200, validator: 400, budgetX: 3, messageFees: 0n },
  file_complaint: { leader: 200, validator: 400, budgetX: 3, messageFees: 0n },
  // settles to the claimable ledger only — no messages emitted
  finalize_dispute: { leader: 250, validator: 500, budgetX: 4, messageFees: 0n },
  // the one method that emits a value message, always to the caller
  withdraw: { leader: 250, validator: 500, budgetX: 4, messageFees: 10n ** 16n },
  // non-deterministic: optional web fetch + an LLM round that every validator
  // re-runs independently — max phase time, much larger execution budget
  resolve_dispute: { leader: 600, validator: 600, budgetX: 40, messageFees: 0n },
  appeal_verdict: { leader: 600, validator: 600, budgetX: 40, messageFees: 0n },
};

let cachedPolicy = null;

/**
 * Fee quote for a call that emits messages (only `withdraw` does).
 *
 * v0.6 refuses a fee-bearing emitted message unless the transaction declares
 * it in an allocation tree. Rather than hand-building that tree — the emitted
 * transfer turns out to be an *internal* message with nested fee params, not
 * the external one you'd assume — we let the SDK simulate the call and report
 * the allocations it actually observes. Only used for message-emitting calls,
 * since simulating resolve_dispute would run the whole LLM round twice.
 */
export async function quoteFeesForWrite(client, { address, functionName, args = [], value }) {
  const estimate = await client.estimateTransactionFeesForWrite({
    address,
    functionName,
    args,
    ...(value === undefined ? {} : { value }),
  });
  return {
    distribution: estimate.distribution,
    feeValue: estimate.feeValue,
    messageAllocations: estimate.messageAllocations,
  };
}

/** Price a profile entry against current network rates. */
export async function quoteFees(client, key, options = {}) {
  const profile = FEE_PROFILE[key];
  if (!profile) throw new Error(`No fee profile for "${key}"`);

  cachedPolicy ??= await client.getCurrentFeePolicy();
  const floor = BigInt(cachedPolicy.executionBudgetFloor ?? 0);

  const estimate = await client.estimateTransactionFees({
    leaderTimeunitsAllocation: clampTimeunits(profile.leader),
    validatorTimeunitsAllocation: clampTimeunits(profile.validator),
    executionBudgetPerRound: floor * BigInt(profile.budgetX),
    totalMessageFees: profile.messageFees,
    appealRounds: 1,
    rotations: [1, 1],
    ...(options.messageAllocations
      ? { messageAllocations: options.messageAllocations }
      : {}),
  });

  return {
    distribution: estimate.distribution,
    feeValue: estimate.feeValue,
    ...(estimate.messageAllocations
      ? { messageAllocations: estimate.messageAllocations }
      : {}),
  };
}

/**
 * Top up from the Studio faucet so fee deposits always clear.
 *
 * The SDK's client.fundAccount() refuses anything but localnet, so this posts
 * sim_fundAccount directly. Note the amount is in **wei**, not GEN — passing
 * 1000 credits 1000 wei, not 1000 GEN.
 */
export async function ensureFunded(client, account, minimum = 200n * 10n ** 18n) {
  let balance = await client.getBalance({ address: account.address });
  if (balance >= minimum) return balance;

  console.log(`Funding ${account.address} from the Studio faucet…`);
  const res = await fetch(STUDIO_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sim_fundAccount",
      params: [account.address, 1000 * 1e18],
    }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`Faucet failed: ${JSON.stringify(body.error)}`);

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const next = await client.getBalance({ address: account.address });
    if (next > balance) return next;
  }
  return client.getBalance({ address: account.address });
}
