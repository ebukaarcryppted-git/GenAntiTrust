"use client";

/**
 * GenLayer Testnet Bradbury — Consensus v0.5.
 *
 * Bradbury has not received the v0.6 upgrade yet (the migration guide is
 * explicit: move production testing to Bradbury only after v0.6 is promoted
 * there), so it runs the older, fee-less write path and an older calldata
 * encoding. genlayer-js 2.0's client cannot parse a v0.5 contract's return
 * data — it resolves method names differently and the runner rejects the
 * call. This module is intentionally pinned to genlayer-js@1.1.8 (imported
 * under the "genlayer-js-v1" alias in package.json) so the original working
 * deployment stays readable without touching the Studio Next code path.
 */
import { createClient } from "genlayer-js-v1";
import { testnetBradbury } from "genlayer-js-v1/chains";
import { TransactionHashVariant } from "genlayer-js-v1/types";
import type { GenLayerClient } from "genlayer-js-v1/types";
import type { NetworkAdapter } from "./network";

export const BRADBURY_EXPLORER = "https://explorer-bradbury.genlayer.com/";
export const BRADBURY_CHAIN_ID_HEX = "0x107c"; // 4220
export const BRADBURY_RPC = "https://rpc-bradbury.genlayer.com";

export const BRADBURY_CONTRACT_ADDRESS =
  "0x70096Df3A29293C5FEA914333074467E56725b3d" as `0x${string}`;

function toPlain<T = any>(value: any): T {
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

function getReadClient(): GenLayerClient<any> {
  return createClient({ chain: testnetBradbury });
}

export async function readBradbury<T = any>(
  functionName: string,
  args: any[] = []
): Promise<T> {
  const client = getReadClient();
  const raw = await client.readContract({
    address: BRADBURY_CONTRACT_ADDRESS,
    functionName,
    args,
    transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
  });
  return toPlain<T>(raw);
}

function getProvider(): any {
  const eth = (globalThis as any).window?.ethereum;
  if (!eth) throw new Error("No injected wallet found — install MetaMask");
  return eth;
}

export async function ensureBradburyNetwork(): Promise<void> {
  const eth = getProvider();
  const current = await eth.request({ method: "eth_chainId" });
  if (String(current).toLowerCase() === BRADBURY_CHAIN_ID_HEX) return;
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BRADBURY_CHAIN_ID_HEX }],
    });
  } catch (err: any) {
    if (err?.code === 4902 || /Unrecognized chain/i.test(err?.message ?? "")) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BRADBURY_CHAIN_ID_HEX,
            chainName: "GenLayer Bradbury Testnet",
            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
            rpcUrls: [BRADBURY_RPC],
            blockExplorerUrls: [BRADBURY_EXPLORER],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export async function connectBradburyWallet(): Promise<`0x${string}`> {
  const eth = getProvider();
  const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
  if (!accounts?.[0]) throw new Error("Wallet returned no account");
  await ensureBradburyNetwork();
  return accounts[0] as `0x${string}`;
}

export async function getBradburyWalletClient(
  address: `0x${string}`
): Promise<GenLayerClient<any>> {
  await ensureBradburyNetwork();
  return createClient({
    chain: testnetBradbury,
    account: address,
    provider: getProvider(),
  });
}

/** v0.5 has no fee-funded write path — value is the only thing to pass. */
export async function writeBradbury(
  client: GenLayerClient<any>,
  functionName: string,
  args: any[] = [],
  value: bigint = 0n
): Promise<{ txId: string; success: boolean; statusName?: string }> {
  const txId = await client.writeContract({
    address: BRADBURY_CONTRACT_ADDRESS,
    functionName,
    args,
    value,
  });
  const receipt: any = await client.waitForTransactionReceipt({
    hash: txId as any,
    retries: 200,
    interval: 3000,
  });
  return {
    txId: String(txId),
    success: receipt.tx_execution_result_name === "FINISHED_WITH_RETURN",
    statusName: receipt.status_name,
  };
}

/* ------------------------------------------------------------------ *
 * Adapter — same shape the Studio module exports, so the UI can switch
 * ------------------------------------------------------------------ */

export const bradburyAdapter: NetworkAdapter = {
  id: "bradbury",
  label: "GenLayer Testnet Bradbury",
  shortLabel: "Bradbury",
  explorerUrl: BRADBURY_EXPLORER,
  contractAddress: BRADBURY_CONTRACT_ADDRESS,
  chainIdHex: BRADBURY_CHAIN_ID_HEX,
  feeFunded: false,
  hasWithdraw: false,
  read: readBradbury,
  connect: connectBradburyWallet,
  getWalletClient: getBradburyWalletClient,
  write: writeBradbury,
};
