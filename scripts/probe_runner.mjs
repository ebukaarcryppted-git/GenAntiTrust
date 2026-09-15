/**
 * Studio Next rejected our pinned runner with "invalid_contract runner
 * malformed". Deploy a minimal contract under each candidate runner spec to
 * find which one this GenVM actually serves.
 *
 *   node scripts/probe_runner.mjs
 */
import {
  ensureFunded,
  getStudioAccount,
  getStudioClient,
  quoteFees,
} from "./studio_client.mjs";

const CANDIDATES = [
  "py-genlayer:test",
  "py-genlayer:latest",
  "py-genlayer:9b8kjyda2ycxyq4ea6g4yfpnydxhd52gqba5rb8dw7krkh5mn9p0",
  "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng",
];

const body = (runner) => `# { "Depends": "${runner}" }
import genlayer as gl


class Probe(gl.contract.Contract):
    n: gl.u256

    def __init__(self):
        self.n = gl.u256(7)

    @gl.public.view
    def get_n(self) -> int:
        return int(self.n)
`;

const account = getStudioAccount();
const client = getStudioClient(account);
await ensureFunded(client, account);
const fees = await quoteFees(client, "deploy");

for (const runner of CANDIDATES) {
  process.stdout.write(`\n${runner}\n  `);
  try {
    const hash = await client.deployContract({
      code: new TextEncoder().encode(body(runner)),
      args: [],
      fees,
    });
    const r = await client.waitForTransactionReceipt({
      hash,
      waitUntil: "decided",
      interval: 2000,
      retries: 120,
    });
    const lr = r.consensus_data?.leader_receipt;
    const rec = Array.isArray(lr) ? lr[0] : lr;
    const payload = rec?.result?.payload ?? "";
    const ok = r.txExecutionResultName === "FINISHED_WITH_RETURN";
    console.log(
      `${ok ? "OK" : "FAIL"}  status=${r.statusName} exec=${r.txExecutionResultName}` +
        (payload ? ` payload=${String(payload).slice(0, 90)}` : "")
    );
    if (ok) {
      const addr = r.data?.contract_address ?? r.txDataDecoded?.contractAddress;
      console.log(`  -> deployed at ${addr}`);
    }
  } catch (e) {
    console.log(`ERROR ${String(e?.message || e).slice(0, 140)}`);
  }
}
