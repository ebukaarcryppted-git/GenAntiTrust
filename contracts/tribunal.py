# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
GenAntiTrust Tribunal
======================

An Equivalence-Principle Intelligent Contract for GenLayer that adjudicates
agent-to-agent antitrust disputes: given a market's pricing / negotiation
history between autonomous merchant-pricing agents, it renders a subjective
verdict -- "collusion", "legitimate", or "inconclusive" -- and releases an
escrowed bond according to that verdict.

Why this is an Intelligent Contract and not a dApp with an LLM bolted on:
  * The core question ("is this parallel pricing implicit collusion, or
    legitimate independent optimization?") has no deterministic answer -- it
    is a genuinely subjective judgment call that a majority of validators
    must independently reach consensus on. That is exactly what the
    Equivalence Principle exists for.
  * `gl.eq_principle.prompt_non_comparative` is the non-deterministic,
    load-bearing call: the leader runs an LLM over the evidence, and every
    validator independently re-grounds and re-judges that answer against the
    same evidence (and any live web context) using the criteria below. If a
    majority disagrees with the leader, the round is rejected and a new
    leader is chosen (Optimistic Democracy) -- this contract has no fallback
    deterministic path that produces a verdict without that call.
  * Money moves only as a *consequence* of the verdict (deterministic
    bookkeeping is kept entirely separate from the non-deterministic
    judgment call, per GenLayer's recommended pattern).

Bond / escrow lifecycle:
  1. `file_complaint`  -- complainant posts a GEN bond (anti-spam stake) and
     the raw evidence. Funds are now held by the contract.
  2. `resolve_dispute`  -- runs the Equivalence-Principle verdict. No funds
     move yet; the dispute becomes appealable.
  3. `appeal_verdict`   -- either party may, up to MAX_APPEALS times, post a
     fresh appeal bond (>= the original bond) together with new evidence to
     force a re-judgment. The appeal bond is settled immediately: if the
     verdict flips, the appellant is refunded in full; if it is confirmed,
     the appellant's bond is forfeited to the other party. This is deliberately
     modeled on GenLayer's own appeal-bond economics (an appeal is a bet that
     the network got it wrong).
  4. `finalize_dispute` -- once no further appeal is filed, anyone can
     finalize: a "legitimate" verdict pays the original bond to the
     respondent (compensation for a complaint that didn't hold up);
     "collusion" or "inconclusive" refunds the complainant.
"""

import json
from dataclasses import dataclass
from genlayer import *


MIN_BOND = u256(1 * 10**18)  # 1 GEN minimum anti-spam bond to file a complaint
MAX_APPEALS = 2

VERDICT_COLLUSION = "collusion"
VERDICT_LEGITIMATE = "legitimate"
VERDICT_INCONCLUSIVE = "inconclusive"
_VALID_VERDICTS = (VERDICT_COLLUSION, VERDICT_LEGITIMATE, VERDICT_INCONCLUSIVE)

STATUS_FILED = "filed"
STATUS_VERDICT_REACHED = "verdict_reached"
STATUS_CLOSED = "closed"

# `Address.ZERO` is not available on every GenVM runner version; construct it
# explicitly instead so this works across the pinned "Depends" runner hash.
ZERO_ADDRESS = Address("0x0000000000000000000000000000000000000000")


# EVM external-message interface used to pay out GEN to a plain wallet
# (EOA) address -- merchant agents are ordinary wallets, not contracts.
@gl.evm.contract_interface
class _Eoa:
    class View:
        pass

    class Write:
        pass


@allow_storage
@dataclass
class Dispute:
    id: str
    complainant: Address
    respondent: Address
    market_id: str
    evidence_json: str
    context_url: str
    bond: u256
    appeal_bond: u256
    last_appellant: Address
    status: str
    verdict: str
    confidence: u256
    key_signals_json: str
    reasoning: str
    appeal_count: u256
    filed_at: str
    resolved_at: str


class GenAntiTrustTribunal(gl.Contract):
    dispute_ids: DynArray[str]
    disputes: TreeMap[str, Dispute]
    next_id: u256

    def __init__(self):
        self.next_id = u256(0)

    # ------------------------------------------------------------------
    # Deterministic helpers
    # ------------------------------------------------------------------

    def _new_dispute_id(self) -> str:
        n = int(self.next_id)
        self.next_id = u256(n + 1)
        return f"DISPUTE-{n:06d}"

    def _now(self) -> str:
        # `gl.message.raw` / `gl.message_raw` availability varies across GenVM
        # runner versions -- this is cosmetic metadata only, so never let it
        # fail the transaction if the field isn't exposed on this runner.
        try:
            return str(gl.message.raw["datetime"])
        except Exception:
            pass
        try:
            return str(gl.message_raw["datetime"])
        except Exception:
            pass
        return ""

    def _compact_evidence(self, evidence_json: str, limit: int = 25) -> str:
        """Renders evidence records as compact one-line-per-record text
        instead of full JSON (dropping redundant wallet/sku fields) so the
        LLM prompt stays short enough for every validator to independently
        finish their own judgment call within the round's time budget. Caps
        to the most recent `limit` records for the same reason."""
        try:
            records = json.loads(evidence_json)
        except Exception:
            return evidence_json
        if not isinstance(records, list):
            return evidence_json
        records = records[-limit:]
        lines = []
        for r in records:
            if not isinstance(r, dict):
                continue
            t = r.get("t", "")
            agent = r.get("agent", "")
            kind = r.get("type", "")
            if kind == "price_update":
                lines.append(f"{t} {agent} price={r.get('price')}")
            elif r.get("text"):
                lines.append(f"{t} {agent} [{kind}]: {r.get('text')}")
            else:
                lines.append(f"{t} {agent} [{kind}]")
        return "\n".join(lines)

    def _run_verdict(self, dispute_id: str, extra_evidence_json: str) -> None:
        """Runs the Equivalence-Principle judgment call and stores the result.

        This is the ONLY place the contract touches non-deterministic
        execution (an LLM call, plus an optional live web fetch). Everything
        that decides where money goes (resolve/appeal/finalize) reads the
        plain deterministic `verdict` string this leaves behind.
        """
        dispute = self.disputes[dispute_id]
        evidence_json = dispute.evidence_json
        context_url = dispute.context_url
        market_id = dispute.market_id

        def gather_input() -> str:
            """Supplies the raw material the Equivalence Principle's LLM call
            reasons over. `prompt_non_comparative` itself performs `task` on
            whatever this returns -- it must NOT pre-compute the verdict."""
            context_text = ""
            if context_url:
                try:
                    resp = gl.nondet.web.get(context_url)
                    context_text = resp.body.decode("utf-8", errors="ignore")[:4000]
                except Exception as e:
                    context_text = f"(context url could not be fetched: {e})"

            extra_block = ""
            if extra_evidence_json:
                extra_block = (
                    "\n\nADDITIONAL EVIDENCE SUBMITTED ON APPEAL:\n"
                    + self._compact_evidence(extra_evidence_json, limit=10)
                )

            return f"""Market: {market_id}

PRICING / NEGOTIATION EVIDENCE (one line per agent action: timestamp, agent, then price or message):
{self._compact_evidence(evidence_json)}
{extra_block}

INDEPENDENT MARKET CONTEXT (fetched live from a source cited by a party, may be empty):
{context_text}"""

        task = """You are an antitrust economist. Decide whether the pricing behavior described in the input reflects illegal algorithmic collusion (tacit/implicit coordination between the agents) or legitimate independent competitive optimization.

Weigh signals such as: synchronized price changes with no public trigger, pricing-related language exchanged directly between agents, sustained supra-competitive margins absent an independent justification, and facilitating practices -- AGAINST legitimate explanations such as: independent reaction to publicly observable competitor prices, a shared public cost shock confirmed by the market context, and ordinary profit-maximizing behavior.

Respond with ONLY a JSON object of this exact shape, nothing else, no markdown fences, no commentary before or after:
{
  "verdict": "collusion" | "legitimate" | "inconclusive",
  "confidence": <integer 0-100>,
  "key_signals": ["<short evidence citation>", "..."],
  "reasoning": "<2-4 sentence economic justification, grounded only in the evidence and context given>"
}"""
        criteria = """Accept the leader's answer only if ALL of the following hold:
1. It is valid JSON with exactly the keys: verdict, confidence, key_signals, reasoning.
2. verdict is exactly one of "collusion", "legitimate", "inconclusive".
3. confidence is an integer between 0 and 100.
4. key_signals cites concrete details that actually appear in the supplied evidence or market context (agent names, prices, timestamps, or quoted phrases) -- no fabricated or invented facts.
5. reasoning is economically sound: parallel or matching prices ALONE are NOT sufficient for a "collusion" verdict without an actual signal of coordination (explicit signaling, synchronized moves with no public trigger, sustained supra-competitive margins). Independently reasonable explanations (public price-matching, a shared public cost shock, ordinary optimization) must count against a "collusion" verdict.
6. If the evidence is too thin or ambiguous to support either conclusion with reasonable confidence, "inconclusive" must be preferred over guessing.
Reject the leader's answer (return False) if it violates any of the above."""

        result_str = gl.eq_principle.prompt_non_comparative(
            gather_input, task=task, criteria=criteria
        )
        cleaned = result_str.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
        try:
            result = json.loads(cleaned)
        except Exception:
            result = {
                "verdict": VERDICT_INCONCLUSIVE,
                "confidence": 0,
                "key_signals": [],
                "reasoning": f"Model output was not valid JSON: {result_str[:300]}",
            }

        verdict = str(result.get("verdict", VERDICT_INCONCLUSIVE)).strip().lower()
        if verdict not in _VALID_VERDICTS:
            verdict = VERDICT_INCONCLUSIVE

        confidence = int(result.get("confidence", 0))
        confidence = max(0, min(100, confidence))

        key_signals = result.get("key_signals", [])
        if not isinstance(key_signals, list):
            key_signals = [str(key_signals)]

        dispute = self.disputes[dispute_id]
        dispute.verdict = verdict
        dispute.confidence = u256(confidence)
        dispute.key_signals_json = json.dumps(key_signals)
        dispute.reasoning = str(result.get("reasoning", ""))
        dispute.status = STATUS_VERDICT_REACHED
        dispute.resolved_at = self._now()

    def _dispute_to_dict(self, d: "Dispute") -> dict:
        return {
            "id": d.id,
            "complainant": d.complainant.as_hex,
            "respondent": d.respondent.as_hex,
            "market_id": d.market_id,
            "evidence_json": d.evidence_json,
            "context_url": d.context_url,
            "bond": int(d.bond),
            "appeal_bond": int(d.appeal_bond),
            "last_appellant": d.last_appellant.as_hex,
            "status": d.status,
            "verdict": d.verdict,
            "confidence": int(d.confidence),
            "key_signals": json.loads(d.key_signals_json) if d.key_signals_json else [],
            "reasoning": d.reasoning,
            "appeal_count": int(d.appeal_count),
            "max_appeals": MAX_APPEALS,
            "filed_at": d.filed_at,
            "resolved_at": d.resolved_at,
        }

    # ------------------------------------------------------------------
    # Public writes
    # ------------------------------------------------------------------

    @gl.public.write.payable
    def file_complaint(
        self,
        respondent: str,
        market_id: str,
        evidence_json: str,
        context_url: str = "",
    ) -> str:
        value = gl.message.value
        if value < MIN_BOND:
            raise gl.vm.UserError(
                f"bond must be at least {int(MIN_BOND)} wei (1 GEN); got {int(value)}"
            )

        try:
            json.loads(evidence_json)
        except Exception:
            raise gl.vm.UserError("evidence_json must be valid JSON")

        sender = gl.message.sender_address
        respondent_addr = Address(respondent)
        if respondent_addr == sender:
            raise gl.vm.UserError("cannot file a complaint against yourself")

        dispute_id = self._new_dispute_id()
        dispute = Dispute(
            id=dispute_id,
            complainant=sender,
            respondent=respondent_addr,
            market_id=market_id,
            evidence_json=evidence_json,
            context_url=context_url,
            bond=u256(int(value)),
            appeal_bond=u256(0),
            last_appellant=ZERO_ADDRESS,
            status=STATUS_FILED,
            verdict="",
            confidence=u256(0),
            key_signals_json="[]",
            reasoning="",
            appeal_count=u256(0),
            filed_at=self._now(),
            resolved_at="",
        )
        self.disputes[dispute_id] = dispute
        self.dispute_ids.append(dispute_id)
        return dispute_id

    @gl.public.write
    def resolve_dispute(self, dispute_id: str) -> str:
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("dispute not found")
        dispute = self.disputes[dispute_id]
        if dispute.status != STATUS_FILED:
            raise gl.vm.UserError("dispute is not awaiting an initial verdict")

        self._run_verdict(dispute_id, extra_evidence_json="")
        return self.disputes[dispute_id].verdict

    @gl.public.write.payable
    def appeal_verdict(
        self, dispute_id: str, additional_evidence_json: str = ""
    ) -> str:
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("dispute not found")
        dispute = self.disputes[dispute_id]
        if dispute.status != STATUS_VERDICT_REACHED:
            raise gl.vm.UserError("dispute has no active verdict to appeal")
        if int(dispute.appeal_count) >= MAX_APPEALS:
            raise gl.vm.UserError("maximum number of appeals already reached")

        sender = gl.message.sender_address
        if sender != dispute.complainant and sender != dispute.respondent:
            raise gl.vm.UserError("only a party to the dispute may appeal its verdict")

        required_bond = dispute.bond
        value = gl.message.value
        if value < required_bond:
            raise gl.vm.UserError(
                f"appeal bond must be at least the original bond "
                f"({int(required_bond)} wei); got {int(value)}"
            )

        previous_verdict = dispute.verdict
        dispute.appeal_bond = u256(int(value))
        dispute.last_appellant = sender

        self._run_verdict(dispute_id, extra_evidence_json=additional_evidence_json)

        dispute = self.disputes[dispute_id]
        dispute.appeal_count = u256(int(dispute.appeal_count) + 1)

        appeal_bond = dispute.appeal_bond
        if dispute.verdict != previous_verdict:
            # The appeal changed the outcome: the appellant was right to
            # challenge it. Refund their appeal bond in full.
            _Eoa(sender).emit_transfer(value=appeal_bond)
        else:
            # The appeal failed to move the verdict: forfeit the bond to the
            # other party as compensation for a frivolous appeal.
            other = (
                dispute.respondent
                if sender == dispute.complainant
                else dispute.complainant
            )
            _Eoa(other).emit_transfer(value=appeal_bond)
        dispute.appeal_bond = u256(0)

        return dispute.verdict

    @gl.public.write
    def finalize_dispute(self, dispute_id: str) -> str:
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("dispute not found")
        dispute = self.disputes[dispute_id]
        if dispute.status != STATUS_VERDICT_REACHED:
            raise gl.vm.UserError("dispute has no verdict awaiting finalization")

        bond = dispute.bond
        if dispute.verdict == VERDICT_LEGITIMATE:
            # The complaint didn't hold up: the bond compensates the accused.
            _Eoa(dispute.respondent).emit_transfer(value=bond)
        else:
            # "collusion" confirmed, or "inconclusive": benefit of the doubt
            # goes to whoever raised the complaint.
            _Eoa(dispute.complainant).emit_transfer(value=bond)

        dispute.bond = u256(0)
        dispute.status = STATUS_CLOSED
        dispute.resolved_at = self._now()
        return dispute.status

    # ------------------------------------------------------------------
    # Public views
    # ------------------------------------------------------------------

    @gl.public.view
    def get_dispute(self, dispute_id: str) -> dict:
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("dispute not found")
        return self._dispute_to_dict(self.disputes[dispute_id])

    @gl.public.view
    def list_disputes(self) -> list:
        return list(self.dispute_ids)

    @gl.public.view
    def get_all_disputes(self) -> dict:
        return {d_id: self._dispute_to_dict(self.disputes[d_id]) for d_id in self.dispute_ids}

    @gl.public.view
    def get_treasury_balance(self) -> int:
        return int(self.balance)

    @gl.public.view
    def get_min_bond(self) -> int:
        return int(MIN_BOND)

    @gl.public.view
    def get_max_appeals(self) -> int:
        return MAX_APPEALS
