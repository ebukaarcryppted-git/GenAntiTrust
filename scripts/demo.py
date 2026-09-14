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
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from gl_client import get_client, get_contract_address  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent


def banner(text: str) -> None:
    print("\n" + "=" * 78)
    print(text)
    print("=" * 78)


def read(client, address, fn, args=None):
    return client.read_contract(address=address, function_name=fn, args=args or [])


def write(client, address, fn, args=None, value=0, label=""):
    print(f"  -> submitting {fn}({', '.join(str(a)[:60] for a in (args or []))}) ...")
    tx_hash = client.write_contract(
        address=address, function_name=fn, args=args or [], value=value
    )
    print(f"     tx: {tx_hash}")
    print("     waiting for validator consensus ...")
    receipt = client.wait_for_transaction_receipt(
        transaction_hash=tx_hash, retries=300, interval=2000
    )
    status = receipt.get("status_name") or receipt.get("status")
    print(f"     status: {status}")
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

    write(
        client,
        address,
        "file_complaint",
        args=[scenario["respondent_wallet"], scenario["market_id"], evidence_json, args.context_url],
        value=min_bond,
        label="file_complaint",
    )

    dispute_ids = read(client, address, "list_disputes")
    dispute_id = dispute_ids[-1]
    print(f"Dispute filed: {dispute_id}")

    banner("Resolving dispute -- validators independently judge the evidence")
    t0 = time.time()
    write(client, address, "resolve_dispute", args=[dispute_id])
    print(f"(resolution took {time.time() - t0:.1f}s)")

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
        write(
            client,
            address,
            "appeal_verdict",
            args=[dispute_id, rebuttal],
            value=dispute["bond"],
        )
        dispute = read(client, address, "get_dispute", args=[dispute_id])
        print_dispute(dispute)

    if args.finalize:
        banner("Finalizing -- releasing escrow according to the verdict")
        write(client, address, "finalize_dispute", args=[dispute_id])
        dispute = read(client, address, "get_dispute", args=[dispute_id])
        print_dispute(dispute)

    banner("Done")
    print(f"View on explorer: {client.chain.block_explorers['default']['url']}")


if __name__ == "__main__":
    main()
