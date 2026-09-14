"""End-to-end GenAntiTrust demo driver.

Files a complaint built from one of the simulator scenarios, resolves it
(the Equivalence-Principle "verdict moment"), optionally appeals it with a
rebuttal, and finalizes it -- against the REAL deployed Intelligent Contract.

Usage:
    python scripts/demo.py rigged                 # file + resolve
    python scripts/demo.py rigged --finalize       # ... + finalize
    python scripts/demo.py rigged --appeal         # ... + appeal + finalize
    python scripts/demo.py clean                   # control scenario
"""

from __future__ import annotations

import argparse
import io
import json
import pathlib
import sys
import time

# Windows consoles often default to a legacy codepage (cp1252) that can't
# encode the emoji used below; force UTF-8 so this runs the same everywhere.
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from gl_client import get_client, get_contract_address, read_contract_patched  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent


def banner(text: str) -> None:
    print("\n" + "=" * 78)
    print(text)
    print("=" * 78)


def read(client, address, fn, args=None):
    return read_contract_patched(client, address, fn, args or [])


def _execution_succeeded(receipt: dict) -> bool:
    # genlayer_py's simplified receipt exposes this at the top level as
    # `tx_execution_result_name` (e.g. "FINISHED_WITH_RETURN" / "FINISHED_WITH_ERROR"),
    # not nested under consensus_data.leader_receipt (that field comes back
    # empty from this client). That alone only says the *leader's* execution
    # produced a return value -- the round can still fail to reach a
    # majority (status "UNDETERMINED", NO_MAJORITY), which is a genuine
    # "validators disagreed" outcome, not a code bug, but also not a
    # committed state change. Require both.
    return (
        receipt.get("tx_execution_result_name") == "FINISHED_WITH_RETURN"
        and receipt.get("status_name") in ("ACCEPTED", "FINALIZED")
    )


def write(client, address, fn, args=None, value=0, label=""):
    print(f"  -> submitting {fn}({', '.join(str(a)[:60] for a in (args or []))}) ...")

    # Submission itself occasionally reverts at the raw EVM/consensus-contract
    # layer on a nonce race with a just-mined prior tx; retry the submission,
    # not just the receipt wait, before giving up.
    tx_hash = None
    for attempt in range(3):
        try:
            tx_hash = client.write_contract(
                address=address, function_name=fn, args=args or [], value=value
            )
            break
        except Exception as e:
            if attempt == 2:
                raise
            print(f"     (transient error submitting transaction, retrying: {e})")
            time.sleep(5)
    print(f"     tx: {tx_hash}")
    print("     waiting for validator consensus (LLM calls can take 1-3 minutes) ...")

    # Bradbury's RPC occasionally resets long-polling connections; retry the
    # wait itself a couple of times rather than treating that as fatal.
    receipt = None
    for attempt in range(3):
        try:
            receipt = client.wait_for_transaction_receipt(
                transaction_hash=tx_hash, retries=150, interval=2000
            )
            break
        except Exception as e:
            if attempt == 2:
                raise
            print(f"     (transient error polling receipt, retrying: {e})")

    status = receipt.get("status_name") or receipt.get("status")
    exec_result = receipt.get("tx_execution_result_name")
    ok = _execution_succeeded(receipt)
    print(f"     status: {status}  execution: {exec_result}")
    if not ok:
        print(
            "     (use `genlayer trace <txId>` for the full stderr/traceback if this is unexpected)"
        )
    return receipt


def print_dispute(d: dict) -> None:
    print(f"  id:            {d['id']}")
    print(f"  status:        {d['status']}")
    print(f"  market:        {d['market_id']}")
    print(f"  complainant:   {d['complainant']}")
    print(f"  respondent:    {d['respondent']}")
    print(f"  bond (wei):    {d['bond']}")
    print(f"  appeal count:  {d['appeal_count']} / {d['max_appeals']}")
    if d["verdict"]:
        marker = {"collusion": "🚨", "legitimate": "✅", "inconclusive": "❔"}.get(
            d["verdict"], ""
        )
        print(f"\n  {marker}  VERDICT: {d['verdict'].upper()}  (confidence {d['confidence']}%)")
        print(f"  reasoning: {d['reasoning']}")
        signals = d.get("key_signals") or []
        if signals:
            print("  key signals:")
            for s in signals:
                print(f"    - {s}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("scenario", choices=["clean", "rigged"])
    parser.add_argument("--appeal", action="store_true", help="also file an appeal after the first verdict")
    parser.add_argument("--finalize", action="store_true", help="also finalize (pay out) after the verdict")
    parser.add_argument("--context-url", default="", help="optional public URL for live market context")
    args = parser.parse_args()

    scenario_path = ROOT / "simulator" / "scenarios" / f"{args.scenario}.json"
    if not scenario_path.exists():
        raise SystemExit(f"{scenario_path} not found -- run: python simulator/marketplace.py {args.scenario}")
    scenario = json.loads(scenario_path.read_text())

    client, account, network = get_client()
    address = get_contract_address()

    banner(f"GenAntiTrust Tribunal @ {address}  ({network})")
    print(f"Caller: {account.address}")

    min_bond = int(read(client, address, "get_min_bond"))
    print(f"Minimum bond: {min_bond} wei ({min_bond / 1e18:g} GEN)")

    evidence_json = json.dumps(scenario["evidence"])
    print(f"\nScenario: {args.scenario} -- {scenario['summary']}")
    print(f"Filing complaint against {scenario['respondent_name']} ({scenario['respondent_wallet']}) ...")

    receipt = write(
        client,
        address,
        "file_complaint",
        args=[scenario["respondent_wallet"], scenario["market_id"], evidence_json, args.context_url],
        value=min_bond,
        label="file_complaint",
    )
    if not _execution_succeeded(receipt):
        raise SystemExit("file_complaint did not succeed on-chain; aborting.")

    dispute_ids = read(client, address, "list_disputes")
    dispute_id = dispute_ids[-1]
    print(f"Dispute filed: {dispute_id}")

    banner("Resolving dispute -- validators independently judge the evidence")
    t0 = time.time()
    receipt = write(client, address, "resolve_dispute", args=[dispute_id])
    print(f"(resolution took {time.time() - t0:.1f}s)")
    if not _execution_succeeded(receipt):
        dispute = read(client, address, "get_dispute", args=[dispute_id])
        print_dispute(dispute)
        raise SystemExit(
            "resolve_dispute did not reach a verdict on-chain (often a validator "
            "timeout on a slow LLM round -- safe to retry: "
            f"python scripts/demo.py {args.scenario} ...)."
        )

    dispute = read(client, address, "get_dispute", args=[dispute_id])
    print_dispute(dispute)

    if args.appeal:
        banner("Appealing the verdict with a rebuttal")
        rebuttal = json.dumps(
            [
                {
                    "t": "2026-08-11T00:00:00Z",
                    "agent": scenario["respondent_name"],
                    "type": "rebuttal",
                    "sku": scenario["market_id"],
                    "price": None,
                    "text": (
                        "Respondent contends the price moves matched a public "
                        "cost shock; see attached context URL for corroborating "
                        "public reporting."
                    ),
                }
            ]
        )
        receipt = write(
            client,
            address,
            "appeal_verdict",
            args=[dispute_id, rebuttal],
            value=dispute["bond"],
        )
        if not _execution_succeeded(receipt):
            print("  (appeal_verdict did not succeed on-chain -- skipping finalize)")
        dispute = read(client, address, "get_dispute", args=[dispute_id])
        print_dispute(dispute)

    if args.finalize and dispute["status"] == "verdict_reached":
        banner("Finalizing -- releasing escrow according to the verdict")
        write(client, address, "finalize_dispute", args=[dispute_id])
        dispute = read(client, address, "get_dispute", args=[dispute_id])
        print_dispute(dispute)
    elif args.finalize:
        print(f"\nSkipping finalize: dispute status is '{dispute['status']}', not 'verdict_reached'.")

    banner("Done")
    print(f"View on explorer: {client.chain.block_explorers['default']['url']}")


if __name__ == "__main__":
    main()
