"""Direct-mode (in-memory, no Studio required) tests for the GenAntiTrust
Tribunal contract. Web/LLM calls are mocked so these run in milliseconds and
exercise every deterministic code path plus both sides of the Equivalence
Principle call (a "collusion" mock and a "legitimate" mock).

Run with:
    pytest tests/direct/ -v
"""

import hashlib
import json

import pytest

CONTRACT_PATH = "contracts/tribunal.py"
MIN_BOND = 1 * 10**18

# A valid-shaped (20-byte / 40-hex-char) placeholder address -- not a real account.
RESPONDENT = "0x" + hashlib.sha256(b"agent-bravo").hexdigest()[:40]
EVIDENCE = json.dumps(
    [
        {"t": "2026-08-01T00:00:00Z", "agent": "agent-alpha", "type": "price_update", "price": 20.0},
        {"t": "2026-08-01T00:05:00Z", "agent": "agent-bravo", "type": "message", "text": "hold at 21 together"},
        {"t": "2026-08-01T00:10:00Z", "agent": "agent-bravo", "type": "price_update", "price": 21.2},
    ]
)

COLLUSION_LLM_RESPONSE = json.dumps(
    {
        "verdict": "collusion",
        "confidence": 91,
        "key_signals": ["private message 'hold at 21 together'", "lockstep price move to 21.2"],
        "reasoning": "The agents privately coordinated a price floor and moved in lockstep with no public trigger.",
    }
)

LEGITIMATE_LLM_RESPONSE = json.dumps(
    {
        "verdict": "legitimate",
        "confidence": 76,
        "key_signals": ["independent price drift toward public average"],
        "reasoning": "Each agent adjusted independently toward the observed public average with idiosyncratic noise.",
    }
)


def _file_and_get_id(direct_vm, contract, sender, bond=MIN_BOND, evidence=EVIDENCE, context_url=""):
    direct_vm.sender = sender
    direct_vm.value = bond
    contract.file_complaint(RESPONDENT, "sku-widget-9000", evidence, context_url)
    direct_vm.value = 0
    ids = contract.list_disputes()
    return ids[-1]


def test_file_complaint_requires_min_bond(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    direct_vm.value = MIN_BOND - 1
    with direct_vm.expect_revert():
        contract.file_complaint(RESPONDENT, "sku-widget-9000", EVIDENCE, "")


def test_file_complaint_rejects_invalid_evidence_json(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    direct_vm.value = MIN_BOND
    with direct_vm.expect_revert():
        contract.file_complaint(RESPONDENT, "sku-widget-9000", "not json", "")


def test_file_complaint_rejects_self_complaint(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.sender = direct_alice
    direct_vm.value = MIN_BOND
    with direct_vm.expect_revert():
        contract.file_complaint(str(direct_alice), "sku-widget-9000", EVIDENCE, "")


def test_resolve_dispute_collusion_refunds_complainant(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.mock_llm(r".*", COLLUSION_LLM_RESPONSE)

    dispute_id = _file_and_get_id(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_alice
    contract.resolve_dispute(dispute_id)

    dispute = contract.get_dispute(dispute_id)
    assert dispute["verdict"] == "collusion"
    assert dispute["confidence"] == 91
    assert dispute["status"] == "verdict_reached"
    assert "hold at 21 together" in " ".join(dispute["key_signals"])

    alice_balance_before = direct_vm._balances.get(direct_vm._to_bytes(direct_alice), 0)
    contract.finalize_dispute(dispute_id)
    dispute = contract.get_dispute(dispute_id)
    assert dispute["status"] == "closed"
    assert dispute["bond"] == 0
    alice_balance_after = direct_vm._balances.get(direct_vm._to_bytes(direct_alice), 0)
    assert alice_balance_after == alice_balance_before + MIN_BOND


def test_resolve_dispute_legitimate_pays_respondent(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.mock_llm(r".*", LEGITIMATE_LLM_RESPONSE)

    dispute_id = _file_and_get_id(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_alice
    contract.resolve_dispute(dispute_id)
    dispute = contract.get_dispute(dispute_id)
    assert dispute["verdict"] == "legitimate"

    respondent_balance_before = direct_vm._balances.get(direct_vm._to_bytes(RESPONDENT), 0)
    contract.finalize_dispute(dispute_id)
    respondent_balance_after = direct_vm._balances.get(direct_vm._to_bytes(RESPONDENT), 0)
    assert respondent_balance_after == respondent_balance_before + MIN_BOND


def test_cannot_resolve_twice(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.mock_llm(r".*", LEGITIMATE_LLM_RESPONSE)
    dispute_id = _file_and_get_id(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_alice
    contract.resolve_dispute(dispute_id)
    with direct_vm.expect_revert():
        contract.resolve_dispute(dispute_id)


def test_only_party_can_appeal(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.mock_llm(r".*", LEGITIMATE_LLM_RESPONSE)
    dispute_id = _file_and_get_id(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_alice
    contract.resolve_dispute(dispute_id)

    direct_vm.sender = direct_bob
    direct_vm.value = MIN_BOND
    with direct_vm.expect_revert():
        contract.appeal_verdict(dispute_id, "")


def test_successful_appeal_flips_verdict_and_refunds_appellant(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.mock_llm(r".*", LEGITIMATE_LLM_RESPONSE)
    dispute_id = _file_and_get_id(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_alice
    contract.resolve_dispute(dispute_id)
    assert contract.get_dispute(dispute_id)["verdict"] == "legitimate"

    # New evidence flips the verdict on appeal.
    direct_vm.clear_mocks()
    direct_vm.mock_llm(r".*", COLLUSION_LLM_RESPONSE)

    direct_vm.sender = direct_alice
    direct_vm.value = MIN_BOND
    contract.appeal_verdict(dispute_id, json.dumps([{"text": "smoking gun message found"}]))
    direct_vm.value = 0

    dispute = contract.get_dispute(dispute_id)
    assert dispute["verdict"] == "collusion"
    assert dispute["appeal_count"] == 1
    assert dispute["appeal_bond"] == 0  # settled immediately


def test_failed_appeal_forfeits_bond_to_other_party(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.mock_llm(r".*", LEGITIMATE_LLM_RESPONSE)
    dispute_id = _file_and_get_id(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_alice
    contract.resolve_dispute(dispute_id)

    # Appeal, but the verdict is confirmed again (same mock response).
    respondent_balance_before = direct_vm._balances.get(direct_vm._to_bytes(RESPONDENT), 0)
    direct_vm.sender = direct_alice
    direct_vm.value = MIN_BOND
    contract.appeal_verdict(dispute_id, "")
    direct_vm.value = 0

    dispute = contract.get_dispute(dispute_id)
    assert dispute["verdict"] == "legitimate"
    assert dispute["appeal_count"] == 1
    assert dispute["appeal_bond"] == 0
    # The complainant's failed appeal bond is forfeited to the respondent.
    respondent_balance_after = direct_vm._balances.get(direct_vm._to_bytes(RESPONDENT), 0)
    assert respondent_balance_after == respondent_balance_before + MIN_BOND


def test_max_appeals_enforced(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.mock_llm(r".*", LEGITIMATE_LLM_RESPONSE)
    dispute_id = _file_and_get_id(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_alice
    contract.resolve_dispute(dispute_id)

    max_appeals = contract.get_max_appeals()
    for _ in range(max_appeals):
        direct_vm.sender = direct_alice
        direct_vm.value = MIN_BOND
        contract.appeal_verdict(dispute_id, "")
    direct_vm.value = 0

    direct_vm.sender = direct_alice
    direct_vm.value = MIN_BOND
    with direct_vm.expect_revert():
        contract.appeal_verdict(dispute_id, "")


def test_inconclusive_verdict_refunds_complainant_on_finalize(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.mock_llm(
        r".*",
        json.dumps(
            {
                "verdict": "inconclusive",
                "confidence": 40,
                "key_signals": [],
                "reasoning": "Evidence is too thin to conclude either way.",
            }
        ),
    )
    dispute_id = _file_and_get_id(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_alice
    contract.resolve_dispute(dispute_id)
    assert contract.get_dispute(dispute_id)["verdict"] == "inconclusive"

    alice_balance_before = direct_vm._balances.get(direct_vm._to_bytes(direct_alice), 0)
    contract.finalize_dispute(dispute_id)
    alice_balance_after = direct_vm._balances.get(direct_vm._to_bytes(direct_alice), 0)
    assert alice_balance_after == alice_balance_before + MIN_BOND


def test_malformed_llm_output_falls_back_to_inconclusive(direct_vm, direct_deploy, direct_alice):
    contract = direct_deploy(CONTRACT_PATH)
    direct_vm.mock_llm(r".*", json.dumps({"verdict": "not-a-real-verdict", "confidence": 999}))
    dispute_id = _file_and_get_id(direct_vm, contract, direct_alice)

    direct_vm.sender = direct_alice
    contract.resolve_dispute(dispute_id)
    dispute = contract.get_dispute(dispute_id)
    assert dispute["verdict"] == "inconclusive"
    assert dispute["confidence"] == 100  # clamped


def test_views_before_any_dispute(direct_vm, direct_deploy):
    contract = direct_deploy(CONTRACT_PATH)
    assert contract.list_disputes() == []
    assert contract.get_all_disputes() == {}
    assert contract.get_min_bond() == MIN_BOND
    assert contract.get_max_appeals() == 2
