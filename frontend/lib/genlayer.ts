"use client";

import { createClient } from "genlayer-js";
import { studionet, testnetBradbury, localnet } from "genlayer-js/chains";
import { TransactionHashVariant } from "genlayer-js/types";
import type { GenLayerChain, GenLayerClient, GenLayerTransaction } from "genlayer-js/types";

const CHAINS: Record<string, GenLayerChain> = {
  "testnet-bradbury": testnetBradbury,
  studionet: studionet,
  localnet: localnet,
};

export const NETWORK =
  process.env.NEXT_PUBLIC_GENLAYER_NETWORK || "testnet-bradbury";

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "") as `0x${string}`;

export function getChain(): GenLayerChain {
  const chain = CHAINS[NETWORK];
  if (!chain) {
    throw new Error(`Unknown NEXT_PUBLIC_GENLAYER_NETWORK=${NETWORK}`);
  }
  return chain;
}

/** Account-free client, sufficient for every read (view) call. */
export function getReadClient(): GenLayerClient<any> {
  return createClient({ chain: getChain() });
}

/** Provider-backed client for a connected browser wallet (MetaMask etc). */
export async function getWalletClient(
  address: `0x${string}`
): Promise<GenLayerClient<any>> {
  const chain = getChain();
  const eth = (window as any).ethereum;
  if (!eth) {
    throw new Error("No injected wallet found (window.ethereum is undefined)");
  }
  const client = createClient({
    chain,
    account: address,
    provider: eth,
  });
  await client.connect(NETWORK as any);
  return client;
}

export async function readContract<T = any>(
  functionName: string,
  args: any[] = []
): Promise<T> {
  const client = getReadClient();
  return client.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
  }) as Promise<T>;
}

/** True if the leader's execution actually succeeded (not just that the
 * transaction reached a terminal consensus status). */
export function txSucceeded(tx: GenLayerTransaction): boolean {
  const receipts = tx.consensus_data?.leader_receipt;
  if (!receipts || receipts.length === 0) return false;
  return receipts[0].execution_result === "SUCCESS";
}

export interface WriteResult {
  txHash: string;
  success: boolean;
  statusName?: string;
  receipt: GenLayerTransaction;
}

export async function writeContract(
  client: GenLayerClient<any>,
  functionName: string,
  args: any[] = [],
  value: bigint = 0n
): Promise<WriteResult> {
  const txHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args,
    value,
  });
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    retries: 300,
    interval: 2000,
  });
  return {
    txHash: String(txHash),
    success: txSucceeded(receipt),
    statusName: receipt.statusName as unknown as string | undefined,
    receipt,
  };
}

export const ONE_GEN = 1_000_000_000_000_000_000n;

export function formatGen(wei: number | bigint | string): string {
  const v = typeof wei === "bigint" ? wei : BigInt(Math.trunc(Number(wei)));
  const whole = v / ONE_GEN;
  const frac = v % ONE_GEN;
  const fracStr = frac.toString().padStart(18, "0").slice(0, 4);
  return `${whole}.${fracStr} GEN`;
}
