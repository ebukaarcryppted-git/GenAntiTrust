"""Deploy contracts/tribunal.py to the network configured in .env and print /
persist the resulting contract address.

Usage:
    python scripts/deploy.py
"""

from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from gl_client import get_client  # noqa: E402

CONTRACT_PATH = pathlib.Path(__file__).resolve().parent.parent / "contracts" / "tribunal.py"


def _extract_contract_address(receipt: dict) -> str | None:
    data = receipt.get("data") or {}
    if isinstance(data, dict) and data.get("contract_address"):
        return data["contract_address"]
    decoded = receipt.get("tx_data_decoded") or {}
    if isinstance(decoded, dict) and decoded.get("contract_address"):
        return decoded["contract_address"]
    return None


def main() -> None:
    client, account, network = get_client()
    print(f"Network:  {network}")
    print(f"Deployer: {account.address}")
    print(f"Balance:  {client.provider.make_request(method='eth_getBalance', params=[account.address, 'latest'])}")

    code = CONTRACT_PATH.read_bytes()
    print(f"Deploying {CONTRACT_PATH} ({len(code)} bytes) ...")

    tx_hash = client.deploy_contract(code=code, args=[])
    print(f"Submitted deploy tx: {tx_hash}")
    print("Waiting for consensus (this can take a couple of minutes on Bradbury) ...")

    receipt = client.wait_for_transaction_receipt(transaction_hash=tx_hash, retries=300, interval=2000)
    status = receipt.get("status_name") or receipt.get("status")
    print(f"Final status: {status}")

    address = _extract_contract_address(receipt)
    if not address:
        print("Could not automatically extract the contract address from the receipt.")
        print("Full receipt:")
        import json

        print(json.dumps(receipt, indent=2, default=str))
        raise SystemExit(1)

    print(f"\nContract deployed at: {address}")
    print(f"Explorer: {client.chain.block_explorers['default']['url']}address/{address}")

    env_path = pathlib.Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        lines = env_path.read_text().splitlines()
        found = False
        for i, line in enumerate(lines):
            if line.startswith("CONTRACT_ADDRESS="):
                lines[i] = f"CONTRACT_ADDRESS={address}"
                found = True
            if line.startswith("NEXT_PUBLIC_CONTRACT_ADDRESS="):
                lines[i] = f"NEXT_PUBLIC_CONTRACT_ADDRESS={address}"
        if not found:
            lines.append(f"CONTRACT_ADDRESS={address}")
        env_path.write_text("\n".join(lines) + "\n")
        print(f"Wrote CONTRACT_ADDRESS to {env_path}")


if __name__ == "__main__":
    main()
