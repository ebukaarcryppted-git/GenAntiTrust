"""
GenAntiTrust marketplace simulator.

Generates synthetic pricing / negotiation histories for a small set of
autonomous merchant-pricing agents competing on one SKU, in two flavors:

  * "clean"  -- agents react only to public rival prices and independent
    demand/cost noise. Prices track each other loosely (because everyone is
    watching the same public signals) but movements are NOT synchronized and
    there is no private communication about price.

  * "rigged" -- the same agents, but a subset of them exchange private
    "negotiation" messages that explicitly coordinate price floors, and then
    move price in lockstep immediately afterward with no public trigger.

This is the *only* fake part of the project: it stands in for what a real
deployment would ingest from live agent-to-agent negotiation logs (e.g. an
A2A message bus). Everything downstream -- the dispute, the verdict, the
escrow release -- runs for real against the deployed Intelligent Contract.

Output shape (one JSON object per record), matches what
`GenAntiTrustTribunal.file_complaint` expects as `evidence_json`:

    {
      "t": "2026-09-01T00:00:00Z",   // ISO timestamp
      "agent": "agent-alpha",
      "type": "price_update" | "message",
      "sku": "sku-widget-9000",
      "price": 19.99,                 // present for price_update
      "text": "..."                   // present for message
    }
"""

from __future__ import annotations

import argparse
import json
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone


SKU = "sku-widget-9000"
BASE_PRICE = 20.00


@dataclass
class Agent:
    name: str
    wallet: str
    base_price: float
    is_colluder: bool = False


def _iso(t: datetime) -> str:
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def generate_clean_market(
    agents: list[Agent],
    start: datetime,
    days: int = 10,
    rng: random.Random | None = None,
) -> list[dict]:
    """Independent competitive pricing: each agent nudges its price toward
    the observed *public* market average plus its own private cost/demand
    noise. No private messages are ever exchanged."""
    rng = rng or random.Random(1)
    records: list[dict] = []
    prices = {a.name: a.base_price for a in agents}

    for day in range(days):
        t = start + timedelta(days=day, hours=rng.uniform(0, 6))
        public_avg = sum(prices.values()) / len(prices)
        for a in agents:
            # independent reaction to the *public* average, plus private noise
            drift = (public_avg - prices[a.name]) * rng.uniform(0.05, 0.2)
            noise = rng.uniform(-0.35, 0.35)
            prices[a.name] = round(max(1.0, prices[a.name] + drift + noise), 2)
            records.append(
                {
                    "t": _iso(t + timedelta(minutes=rng.uniform(0, 90))),
                    "agent": a.name,
                    "wallet": a.wallet,
                    "type": "price_update",
                    "sku": SKU,
                    "price": prices[a.name],
                    "text": "",
                }
            )
    records.sort(key=lambda r: r["t"])
    return records


def generate_rigged_market(
    agents: list[Agent],
    start: datetime,
    days: int = 10,
    rng: random.Random | None = None,
) -> list[dict]:
    """A subset of `agents` (those with is_colluder=True) privately exchange
    price-floor instructions, then move in lockstep within minutes, with no
    public trigger (no cost shock, no rival move) preceding the jump."""
    rng = rng or random.Random(2)
    records: list[dict] = []
    prices = {a.name: a.base_price for a in agents}
    colluders = [a for a in agents if a.is_colluder]
    honest = [a for a in agents if not a.is_colluder]

    coordination_messages = [
        "let's hold the line above {price} this week, no point racing to the bottom",
        "moving to {price} at 3pm, match me and we both keep margin",
        "confirmed, {price} floor starting today, don't undercut",
        "competitor still asleep, we can push to {price} together",
    ]

    for day in range(days):
        t = start + timedelta(days=day, hours=rng.uniform(0, 6))

        # honest agents behave exactly like the clean scenario
        public_avg = sum(prices.values()) / len(prices)
        for a in honest:
            drift = (public_avg - prices[a.name]) * rng.uniform(0.05, 0.2)
            noise = rng.uniform(-0.35, 0.35)
            prices[a.name] = round(max(1.0, prices[a.name] + drift + noise), 2)
            records.append(
                {
                    "t": _iso(t + timedelta(minutes=rng.uniform(0, 90))),
                    "agent": a.name,
                    "wallet": a.wallet,
                    "type": "price_update",
                    "sku": SKU,
                    "price": prices[a.name],
                    "text": "",
                }
            )

        # every ~3 days, colluders privately coordinate a synchronized hike
        if day % 3 == 0 and colluders:
            new_price = round(max(prices[c.name] for c in colluders) * 1.06, 2)
            msg_time = t + timedelta(minutes=rng.uniform(0, 20))
            template = rng.choice(coordination_messages)
            sender = colluders[0]
            for c in colluders:
                records.append(
                    {
                        "t": _iso(msg_time),
                        "agent": sender.name,
                        "wallet": sender.wallet,
                        "type": "message",
                        "sku": SKU,
                        "price": None,
                        "text": f"[private to {c.name}] "
                        + template.format(price=new_price),
                    }
                )
            # lockstep move minutes later, with no public trigger
            for c in colluders:
                prices[c.name] = new_price
                records.append(
                    {
                        "t": _iso(msg_time + timedelta(minutes=rng.uniform(4, 12))),
                        "agent": c.name,
                        "wallet": c.wallet,
                        "type": "price_update",
                        "sku": SKU,
                        "price": new_price,
                        "text": "",
                    }
                )

    records.sort(key=lambda r: r["t"])
    return records


def default_agents() -> list[Agent]:
    return [
        Agent("agent-alpha", "0x1000000000000000000000000000000000000a1", BASE_PRICE + 0.0, is_colluder=True),
        Agent("agent-bravo", "0x1000000000000000000000000000000000000b2", BASE_PRICE + 0.4, is_colluder=True),
        Agent("agent-charlie", "0x1000000000000000000000000000000000000c3", BASE_PRICE - 0.3, is_colluder=False),
        Agent("agent-delta", "0x1000000000000000000000000000000000000d4", BASE_PRICE + 0.1, is_colluder=False),
    ]


def build_scenario(kind: str, days: int = 10, seed: int = 7) -> dict:
    """Returns a full scenario dict: agents, evidence records, and a
    ready-to-use narrative summary for the demo."""
    agents = default_agents()
    start = datetime(2026, 8, 1, tzinfo=timezone.utc)
    rng = random.Random(seed)

    if kind == "clean":
        records = generate_clean_market(agents, start, days=days, rng=rng)
        respondent = agents[0]
        summary = (
            f"{len(agents)} independent pricing agents on {SKU} over {days} days. "
            "Prices loosely track the public average with idiosyncratic noise; "
            "no private coordination of any kind."
        )
    elif kind == "rigged":
        records = generate_rigged_market(agents, start, days=days, rng=rng)
        respondent = next(a for a in agents if a.is_colluder)
        summary = (
            f"{len(agents)} pricing agents on {SKU} over {days} days. "
            f"{sum(a.is_colluder for a in agents)} of them privately exchange "
            "price-floor messages every few days and then move price in "
            "lockstep minutes later, with no public trigger."
        )
    else:
        raise ValueError("kind must be 'clean' or 'rigged'")

    return {
        "kind": kind,
        "market_id": SKU,
        "agents": [a.__dict__ for a in agents],
        "respondent_wallet": respondent.wallet,
        "respondent_name": respondent.name,
        "summary": summary,
        "evidence": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a GenAntiTrust market scenario")
    parser.add_argument("kind", choices=["clean", "rigged"])
    parser.add_argument("--days", type=int, default=10)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--out", type=str, default=None)
    args = parser.parse_args()

    scenario = build_scenario(args.kind, days=args.days, seed=args.seed)
    out_path = args.out or f"simulator/scenarios/{args.kind}.json"
    import os

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(scenario, f, indent=2)
    print(f"Wrote {len(scenario['evidence'])} evidence records to {out_path}")
    print(scenario["summary"])


if __name__ == "__main__":
    main()
