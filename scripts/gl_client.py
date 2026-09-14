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


def read_contract_patched(client, address: str, function_name: str, args=None):
    """Bradbury's current `gen_call` RPC nests the encoded return value one
    level deeper (`result['data']`) than genlayer_py==0.18's `read_contract`
    expects (a bare hex string) -- it crashes with
    `TypeError: can only concatenate str (not "dict") to str`. This
    reimplements just the response-parsing step against both shapes so the
    demo scripts work against the SDK version pinned in requirements.txt
    without needing an unreleased genlayer-py."""
    import eth_utils
    from genlayer_py.abi import calldata
    from genlayer_py.abi.transactions import serialize
    from genlayer_py.contracts.utils import make_calldata_object

    sender_address = client.local_account.address
    data = [
        calldata.encode(make_calldata_object(method=function_name, args=args, kwargs=None)),
        b"\x00",
    ]
    request_params = {
        "type": "read",
        "to": address,
        "from": sender_address,
        "data": serialize(data),
        "transaction_hash_variant": "latest-nonfinal",
    }
    raw = client.provider.make_request(method="gen_call", params=[request_params])
    result = raw["result"]
    enc_result = result["data"] if isinstance(result, dict) else result
    prefixed_result = "0x" + enc_result
    return calldata.decode(eth_utils.hexadecimal.decode_hex(prefixed_result))


def get_contract_address() -> str:
    addr = os.environ.get("CONTRACT_ADDRESS", "").strip()
    if not addr:
        raise SystemExit(
            "CONTRACT_ADDRESS is not set in .env. Run scripts/deploy.py first."
        )
    return addr
