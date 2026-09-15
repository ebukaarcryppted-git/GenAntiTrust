"use client";

import type { NetworkAdapter } from "./network";
import { createClient, isSuccessful } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";
import type { GenLayerChain, GenLayerClient } from "genlayer-js/types";

/* ------------------------------------------------------------------ *
 * Network — GenLayer Studio Next (Consensus v0.6)
 * ------------------------------------------------------------------ */

const RPC_URL =
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio-next.genlayer.com/api";
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID || 61997);
const CHAIN_NAME =
  process.env.NEXT_PUBLIC_GENLAYER_CHAIN_NAME || "GenLayer Studio Next";

export const EXPLORER_URL = "https://explorer-studio-dev.genlayer.com/";
export const NETWORK = CHAIN_NAME;

/**
 * genlayer-js 2.0 ships `studioDevnet` pointing at studio-dev.genlayer.com.
 * Studio Next is the same chain (61997 — verified via eth_chainId) under the
 * developer-facing hostname, so we clone the preset and swap only the RPC.
 * Chain identity and consensus addresses must move together, per the v0.6
 * migration guide, which is why this is one shared object.
 */
export const STUDIO_CHAIN: GenLayerChain = {
  ...studioDevnet,
  id: CHAIN_ID,
  name: CHAIN_NAME,
  rpcUrls: { default: { http: [RPC_URL] } },
} as GenLayerChain;

export const CHAIN_ID_HEX = `0x${CHAIN_ID.toString(16)}`;

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x35C99C265EAB76476f4E3E3B922d131bb416b7c3") as `0x${string}`;

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

/** genlayer-js 2.0 decodes contract dicts as `Map`s and large ints as
 *  strings. Normalise both so React components see plain data. */
export function toPlain<T = any>(value: any): T {
  if (value instanceof Map) {
    return Object.fromEntries(
      [...value.entries()].map(([k, v]) => [k, toPlain(v)])
    ) as T;
  }
  if (Array.isArray(value)) return value.map(toPlain) as unknown as T;
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, toPlain(v)])
    ) as T;
  }
  return value as T;
}

export function getReadClient(): GenLayerClient<any> {
  return createClient({ chain: STUDIO_CHAIN, endpoint: RPC_URL });
}

export async function readContract<T = any>(
  functionName: string,
  args: any[] = []
): Promise<T> {
  const client = getReadClient();
  const raw = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
  });
  return toPlain<T>(raw);
}

/* ------------------------------------------------------------------ *
 * Wallet
 * ------------------------------------------------------------------ */

function getProvider(): any {
  const eth = (globalThis as any).window?.ethereum;
  if (!eth) throw new Error("No injected wallet found — install MetaMask");
  return eth;
}

/** Make sure the wallet is actually on Studio Next before signing, adding the
 *  chain if the user has never seen it. Signing on the wrong chain is the most
 *  common way a dApp "works" but produces transactions nobody can find. */
export async function ensureStudioNetwork(): Promise<void> {
  const eth = getProvider();
  const current = await eth.request({ method: "eth_chainId" });
  if (String(current).toLowerCase() === CHAIN_ID_HEX.toLowerCase()) return;

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (err: any) {
    // 4902 = chain unknown to the wallet
    if (err?.code === 4902 || /Unrecognized chain/i.test(err?.message ?? "")) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN_ID_HEX,
            chainName: CHAIN_NAME,
            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: [EXPLORER_URL],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export async function connectWallet(): Promise<`0x${string}`> {
  const eth = getProvider();
  const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
  if (!accounts?.[0]) throw new Error("Wallet returned no account");
  await ensureStudioNetwork();
  return accounts[0] as `0x${string}`;
}

export async function getWalletClient(
  address: `0x${string}`
): Promise<GenLayerClient<any>> {
  await ensureStudioNetwork();
  return createClient({
    chain: STUDIO_CHAIN,
    endpoint: RPC_URL,
    account: address,
    provider: getProvider(),
  });
}

/* ------------------------------------------------------------------ *
 * Fees (Consensus v0.6)
 * ------------------------------------------------------------------ */

/**
 * Every v0.6 write is funded up front: the transaction carries a
 * FeesDistribution plus a quoted deposit, or the consensus contract reverts
 * (FeeValueMustBeNonZero). Budgets are expressed as multiples of the live
 * `executionBudgetFloor` rather than absolute numbers — anything under the
 * floor reverts with BudgetTooLow, and the floor is a policy value that moves.
 *
 * Phase time is capped by policy at 600 time units (PhaseTimeoutOutOfBounds),
 * so the LLM-heavy calls take max phase time and buy real headroom through
 * the execution budget instead. Unused deposit is refunded at finalization.
 */
const TIMEUNIT_MAX = 600;
const clamp = (n: number) => Math.max(30, Math.min(TIMEUNIT_MAX, n));

const FEE_PROFILE: Record<
  string,
  { leader: number; validator: number; budgetX: number; messageFees: bigint }
> = {
  file_complaint: { leader: 200, validator: 400, budgetX: 3, messageFees: 0n },
  finalize_dispute: { leader: 250, validator: 500, budgetX: 4, messageFees: 0n },
  resolve_dispute: { leader: 600, validator: 600, budgetX: 40, messageFees: 0n },
  appeal_verdict: { leader: 600, validator: 600, budgetX: 40, messageFees: 0n },
};

let policyCache: any = null;

async function quoteFees(client: GenLayerClient<any>, method: string) {
  const profile = FEE_PROFILE[method];
  if (!profile) throw new Error(`No fee profile for ${method}`);

  policyCache ??= await client.getCurrentFeePolicy();
  const floor = BigInt(policyCache.executionBudgetFloor ?? 0);

  const estimate = await client.estimateTransactionFees({
    leaderTimeunitsAllocation: clamp(profile.leader),
    validatorTimeunitsAllocation: clamp(profile.validator),
    executionBudgetPerRound: floor * BigInt(profile.budgetX),
    totalMessageFees: profile.messageFees,
    appealRounds: 1,
    rotations: [1, 1],
  });

  return { distribution: estimate.distribution, feeValue: estimate.feeValue };
}

/**
 * `withdraw()` is the only method that emits a value message, and v0.6 refuses
 * a fee-bearing message unless the transaction declares it in an allocation
 * tree. The emitted transfer is an *internal* message with nested fee params,
 * so rather than hand-building that tree we let the SDK simulate the call and
 * report the allocations it actually observes.
 */
async function quoteFeesBySimulation(
  client: GenLayerClient<any>,
  method: string,
  args: any[]
) {
  const estimate = await client.estimateTransactionFeesForWrite({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
  });
  return {
    distribution: estimate.distribution,
    feeValue: estimate.feeValue,
    messageAllocations: estimate.messageAllocations,
  };
}

export interface WriteResult {
  txId: string;
  success: boolean;
  statusName?: string;
  executionResult?: string;
}

/**
 * Submit a write and wait for a decision.
 *
 * v0.6: an ACCEPTED/FINALIZED status alone does NOT prove the call succeeded —
 * the round can decide on a reverted execution. `isSuccessful` checks both.
 */
export async function writeContract(
  client: GenLayerClient<any>,
  functionName: string,
  args: any[] = [],
  value: bigint = 0n
): Promise<WriteResult> {
  const fees =
    functionName === "withdraw"
      ? await quoteFeesBySimulation(client, functionName, args)
      : await quoteFees(client, functionName);

  const txId = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value,
    fees: fees as any,
  });

  const receipt = await client.waitForTransactionReceipt({
    hash: txId as any,
    waitUntil: "decided",
    interval: 3000,
    retries: 200,
  });

  return {
    txId: String(txId),
    success: isSuccessful(receipt as any),
    statusName: (receipt as any).statusName,
    executionResult: (receipt as any).txExecutionResultName,
  };
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export const ONE_GEN = 1_000_000_000_000_000_000n;

function toBig(wei: number | bigint | string): bigint {
  if (typeof wei === "bigint") return wei;
  if (typeof wei === "string") return BigInt(wei || "0");
  return BigInt(Math.trunc(wei));
}

export function formatGen(wei: number | bigint | string): string {
  const v = toBig(wei);
  const whole = v / ONE_GEN;
  const frac = v % ONE_GEN;
  return `${whole}.${frac.toString().padStart(18, "0").slice(0, 4)} GEN`;
}

/** Trims trailing zeros: 1e18 -> "1 GEN". */
export function formatGenCompact(wei: number | bigint | string): string {
  const gen = Number(toBig(wei)) / 1e18;
  const n = gen % 1 === 0 ? String(gen) : gen.toFixed(2).replace(/0+$/, "");
  return `${n} GEN`;
}

/* ------------------------------------------------------------------ *
 * Adapter — the shape components consume, independent of network
 * ------------------------------------------------------------------ */

export const studioAdapter: NetworkAdapter = {
  id: "studio",
  label: "GenLayer Studio Next",
  shortLabel: "Studio Next",
  explorerUrl: EXPLORER_URL,
  contractAddress: CONTRACT_ADDRESS,
  chainIdHex: CHAIN_ID_HEX,
  feeFunded: true,
  hasWithdraw: true,
  read: readContract,
  connect: connectWallet,
  getWalletClient,
  write: writeContract,
};
