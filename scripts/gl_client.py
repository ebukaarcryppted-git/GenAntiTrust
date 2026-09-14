"""Shared helper for building a genlayer_py client from .env, used by every
script in this directory (deploy, demo, faucet check, ...)."""

from __future__ import annotations

import os

from dotenv import load_dotenv
from genlayer_py import create_account, create_client
from genlayer_py.chains import localnet, studionet, testnet_asimov, testnet_bradbury

load_dotenv()

_CHAINS = {
    "testnet-bradbury": testnet_bradbury,
    "testnet-asimov": testnet_asimov,
    "studionet": studionet,
    "localnet": localnet,
}


def get_chain():
    network = os.environ.get("GENLAYER_NETWORK", "testnet-bradbury")
    if network not in _CHAINS:
        raise SystemExit(
            f"Unknown GENLAYER_NETWORK={network!r}; choose one of {list(_CHAINS)}"
        )
    return _CHAINS[network], network


def get_client():
    """Returns (client, account, network_name). Requires GENLAYER_PRIVATE_KEY
    to be set in the environment / .env file."""
    chain, network = get_chain()
    private_key = os.environ.get("GENLAYER_PRIVATE_KEY", "").strip()
    if not private_key:
        raise SystemExit(
            "GENLAYER_PRIVATE_KEY is not set. Copy .env.example to .env and fill it in "
            "(see README.md 'Wallet setup')."
        )
    account = create_account(private_key)
    client = create_client(chain=chain, account=account)
    return client, account, network


def get_contract_address() -> str:
    addr = os.environ.get("CONTRACT_ADDRESS", "").strip()
    if not addr:
        raise SystemExit(
            "CONTRACT_ADDRESS is not set in .env. Run scripts/deploy.py first."
        )
    return addr
