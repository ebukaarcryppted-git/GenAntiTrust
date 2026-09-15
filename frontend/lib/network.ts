/**
 * Both deployments (Studio Next / Consensus v0.6, and the original Bradbury
 * / Consensus v0.5) expose the same shape to the UI, even though they're
 * backed by two different major versions of genlayer-js under the hood —
 * v0.5's calldata encoding isn't readable by the v2 client. Components take
 * a `NetworkAdapter` instead of importing either lib module directly, so the
 * network switcher in Nav is the only place that decides which is active.
 */
export interface WriteOutcome {
  txId: string;
  success: boolean;
  statusName?: string;
  executionResult?: string;
}

export interface NetworkAdapter {
  id: "studio" | "bradbury";
  label: string;
  shortLabel: string;
  explorerUrl: string;
  contractAddress: `0x${string}`;
  chainIdHex: string;
  /** v0.6 (Studio) funds every write with a quoted fee deposit; v0.5
   *  (Bradbury) has no fee market at all. Both are fully interactive. */
  feeFunded: boolean;
  /** The Studio contract settles awards to a claimable ledger and requires a
   *  separate withdraw() (v0.6 needs every emitted message pre-declared, and
   *  a verdict-dependent payee can't be declared before the verdict exists).
   *  The Bradbury contract pushes the payout directly on finalize/appeal —
   *  there is no withdraw step because v0.5 has no such restriction. */
  hasWithdraw: boolean;
  read<T = any>(fn: string, args?: any[]): Promise<T>;
  connect(): Promise<`0x${string}`>;
  getWalletClient(address: `0x${string}`): Promise<any>;
  write(
    client: any,
    fn: string,
    args?: any[],
    value?: bigint
  ): Promise<WriteOutcome>;
}
