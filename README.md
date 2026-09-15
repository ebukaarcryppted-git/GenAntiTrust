# GenAntiTrust Tribunal

**An agent-to-agent antitrust dispute resolution Intelligent Contract, built on GenLayer.**

**Live dashboard:** [genantitrust.vercel.app](https://genantitrust.vercel.app) -- a network switcher in the nav lets you run the full dispute lifecycle against either live deployment: **GenLayer Studio Next** (Consensus v0.6, the hackathon's mandated network) or **GenLayer Testnet Bradbury** (Consensus v0.5). Connect a wallet holding GEN on either network to file/resolve/appeal/finalize disputes yourself; without a wallet the dashboard is still fully readable.

**This contract is deployed twice, independently, on two different consensus versions:**

| | Studio Next (primary) | Testnet Bradbury (secondary) |
|---|---|---|
| Consensus | v0.6 | v0.5 |
| Chain ID | `61997` | `4220` |
| Contract | [`0x35C99C265EAB76476f4E3E3B922d131bb416b7c3`](https://explorer-studio-dev.genlayer.com/address/0x35C99C265EAB76476f4E3E3B922d131bb416b7c3) | [`0x70096Df3A29293C5FEA914333074467E56725b3d`](https://explorer-bradbury.genlayer.com/address/0x70096Df3A29293C5FEA914333074467E56725b3d) |
| Source | [contracts/tribunal.py](contracts/tribunal.py) | [contracts/legacy/tribunal_consensus_v05.py](contracts/legacy/tribunal_consensus_v05.py) |
| Explorer | [explorer-studio-dev.genlayer.com](https://explorer-studio-dev.genlayer.com/) | [explorer-bradbury.genlayer.com](https://explorer-bradbury.genlayer.com/) |
| SDK | `genlayer-js@2.0.0-rc.1` | `genlayer-js@1.1.8` |
| Fees | Fee-funded (every write quotes and deposits a fee) | None |
| Settlement | Pull payment (`withdraw()` -- see below) | Direct push transfer |

The two versions are not source-identical: v0.6 requires every fee-bearing emitted message to be pre-declared in the submitting transaction's allocation tree, which a verdict-dependent payee (the winner of an appeal) can't satisfy. `contracts/tribunal.py` (Studio Next) is refactored around a `claimable` ledger and a `withdraw()` method so the only emitted transfer is to `gl.message.sender_address` -- always known in advance. `contracts/legacy/tribunal_consensus_v05.py` (Bradbury) keeps the original direct-payment design, which v0.5 supports natively.

As merchant-pricing agents proliferate, regulators worry about algorithmic
collusion: parallel pricing that emerges *without* any explicit human
agreement to fix prices. x402, A2A, and ERC-8004 give agents ways to pay each
other, prove identity, and interoperate -- but none of them give agents (or
the humans/DAOs behind them) a way to **dispute** each other's behavior. That
gap -- adjudication -- is what GenAntiTrust fills.

GenAntiTrust ingests a market's pricing/negotiation history between
autonomous merchant agents and renders a genuinely subjective verdict --
`collusion`, `legitimate`, or `inconclusive` -- using GenLayer's Equivalence
Principle, then escrows and releases a GEN bond according to that verdict.

> **This is an Equivalence Principle contract with a live-data component
> layered on.** "Legitimate optimization vs. implicit collusion" has no
> single correct phrasing -- validators must reach *consensus on a judgment
> call*, not match a string. That is the Equivalence Principle's reason for
> existing. The optional live web-context fetch (see below) is the secondary,
> live-data-driven angle: the verdict can be grounded against independently
> fetched public data, not just the evidence a party supplies.

## What's real vs. what's simulated

| | |
|---|---|
| **Real** | The `GenAntiTrustTribunal` Intelligent Contract, deployed and running on both **GenLayer Studio Next** and **GenLayer Testnet Bradbury**. Every verdict is a genuine `gl.eq_principle.prompt_non_comparative` call: the leader validator runs an LLM over the submitted evidence, and every other validator independently re-grounds and re-judges that answer against the same evidence (and any live web context) before consensus is reached. The escrow, bonds, and appeal-bond settlement are real GEN token transfers on both networks. |
| **Simulated** | The *marketplace* itself -- there is no live network of real merchant-pricing agents yet. [simulator/marketplace.py](simulator/marketplace.py) generates synthetic pricing/negotiation histories (a "clean" independent-competition scenario and a "rigged" scenario where two of four agents privately coordinate a price floor) and hands them to the contract exactly as a real agent-to-agent negotiation log would be. |

**Non-deterministic call used:** [`gl.eq_principle.prompt_non_comparative`](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle) (see `_run_verdict` in [contracts/tribunal.py](contracts/tribunal.py))

**Real verdicts already rendered on Studio Next** (chain 61997, check the [explorer](https://explorer-studio-dev.genlayer.com/address/0x35C99C265EAB76476f4E3E3B922d131bb416b7c3)):

| Dispute | Scenario | Verdict | Confidence | Status |
|---|---|---|---|---|
| `DISPUTE-000000` | rigged (colluding) | 🚨 `collusion` | 98% | `verdict_reached` |
| `DISPUTE-000001` | rigged (colluding) | 🚨 `collusion` | 90% | `closed` -- finalized, bond settled to the `claimable` ledger and withdrawn |

**Real verdicts already rendered on Bradbury** (chain 4220, check any of these on the [explorer](https://explorer-bradbury.genlayer.com/)):

| Dispute | Scenario | Verdict | Confidence | Tx |
|---|---|---|---|---|
| `DISPUTE-000002` | rigged (colluding) | 🚨 `collusion` | 99% | [resolve](https://explorer-bradbury.genlayer.com/transactions/0xeb545378e97f79d1e1b7864d94048530328ff75c140f8c8a1c4e74e4c0f7c197) |
| `DISPUTE-000002` (appeal) | rigged, re-judged with a rebuttal | 🚨 `collusion` confirmed | 98% | [appeal](https://explorer-bradbury.genlayer.com/transactions/0xb9b2a58ecd2f565222540663efe23483ec96b3c2cc86d2f93bcdbb0ec5b7f7d2) |
| `DISPUTE-000003` | clean (independent competition) | ❔ `inconclusive` | 45% | [resolve](https://explorer-bradbury.genlayer.com/transactions/0x177028c52af68eb52c5178dc63069359e284e20e2590bad5f2958efcc3615d27) |

The clean scenario correctly came back `inconclusive` rather than a confident `legitimate` -- there's no smoking-gun evidence either way in synthetic noise, and the Equivalence Principle's criteria explicitly requires the model to prefer "inconclusive" over guessing when evidence is thin. One resolution attempt on Bradbury also hit a genuine `NO_MAJORITY` validator split (round result `NO_MAJORITY`, no verdict recorded, dispute stayed `filed` and was safely re-resolved) -- a real instance of GenLayer's Optimistic Democracy rejecting a round rather than a scripted outcome.

## Why this qualifies as an Intelligent Contract, not a dApp with an LLM bolted on

- **Written in Python, extends `gl.Contract`.** No Solidity. See [contracts/tribunal.py](contracts/tribunal.py).
- **The non-deterministic call is load-bearing.** `resolve_dispute` / `appeal_verdict` cannot produce a verdict without `gl.eq_principle.prompt_non_comparative`, which itself calls `gl.nondet.exec_prompt` (and optionally `gl.nondet.web.get` for live market context) inside the wrapped leader function. There is no deterministic fallback path -- remove the AI call and the contract cannot decide anything.
- **A real Equivalence Principle is defined.** The `criteria` string passed to `prompt_non_comparative` is the actual consensus rule validators use to accept or reject the leader's answer: valid JSON shape, a verdict from a fixed enum, a confidence in range, evidence-grounded `key_signals` (no fabrication), and an explicit economic standard for when parallel pricing does *not* imply collusion. Without this, there is no real consensus mechanism -- just one validator's opinion.
- **Deterministic and non-deterministic logic are kept separate.** All bookkeeping -- creating disputes, tracking bonds, paying out escrow, enforcing the appeal cap -- is plain deterministic Python. The *only* non-deterministic block is the private `_run_verdict` helper.
- **Storage is declared correctly.** All persistent state is class-level fields with type annotations (`TreeMap`, `DynArray`, `u256`, and an `@allow_storage @dataclass` for `Dispute`) -- not bare `self.x = ...` outside the class body.
- **Designed for disagreement, not just success.** Up to `MAX_APPEALS = 2` rounds let either party force a re-judgment with new evidence; the appeal bond is won or forfeited depending on whether the appeal actually moves the verdict, mirroring GenLayer's own appeal-bond economics.

## Repository layout

```
contracts/tribunal.py               # the Studio Next (v0.6) Intelligent Contract
contracts/legacy/tribunal_consensus_v05.py  # the Bradbury (v0.5) Intelligent Contract
tests/direct/                        # fast in-memory tests (genlayer-test / gltest), mocked LLM
simulator/marketplace.py             # generates the "clean" / "rigged" evidence scenarios
simulator/scenarios/*.json           # generated evidence (checked in for reproducibility)

# Bradbury (v0.5) tooling -- Python
scripts/gl_client.py                 # shared genlayer_py client builder (reads .env)
scripts/deploy.py                    # deploys the legacy contract to Bradbury
scripts/demo.py                      # end-to-end CLI demo: file -> resolve -> appeal -> finalize

# Studio Next (v0.6) tooling -- Node / genlayer-js
scripts/studio_client.mjs            # shared client: funding, fee quoting, env helpers
scripts/deploy_studio.mjs            # deploys contracts/tribunal.py to Studio Next
scripts/demo_studio.mjs              # end-to-end CLI demo, including withdraw()
scripts/probe_runner.mjs             # diagnostic: finds which GenVM runner hash a Studio instance serves

frontend/                            # Next.js dashboard: dual-network switcher, live verdicts
frontend/lib/genlayer.ts             # Studio Next (v2 SDK) adapter
frontend/lib/bradbury.ts             # Bradbury (v1 SDK, npm-aliased) adapter
frontend/lib/network.ts              # shared NetworkAdapter interface the UI codes against
```

## Setup

### 1. GenLayer CLI + Python environment

```bash
npm install -g genlayer
python -m venv .venv
source .venv/Scripts/activate   # .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
```

### 2. Lint the contract

```bash
genvm-lint check contracts/tribunal.py
```

### 3. Run the direct-mode tests

```bash
pytest tests/direct/ -v
```

These mock the LLM call (`direct_vm.mock_llm`) and exercise every code path:
bond validation, the full collusion/legitimate/inconclusive verdict branches,
appeal success (verdict flips, appellant refunded), appeal failure (bond
forfeited to the other party), the `MAX_APPEALS` cap, and every view method.

> **Note:** the first run downloads a GenVM runner bundle (~135MB) from
> GitHub's release CDN into `~/.cache/gltest-direct/`. On a slow or
> rate-limited connection this can take a long time or fail with an
> `EOFError` on a truncated file -- delete the partial `.tar.xz` in that
> cache directory and rerun. This step is independent of the deployed
> contract, which is already verified live on Bradbury (see below).

### 4. Wallet setup

```bash
genlayer network set testnet-bradbury
genlayer account create --name tribunal-deployer
```

Fund it: get testnet GEN from the [GenLayer Bradbury faucet](https://testnet-faucet.genlayer.foundation/)
(sign-in with GitHub, paste the address `genlayer account show` prints).

For the Python scripts (`scripts/deploy.py`, `scripts/demo.py`), copy
`.env.example` to `.env` and set `GENLAYER_PRIVATE_KEY` to that account's
private key (`genlayer account export` to get a keystore, or generate a
fresh key with `python -c "from genlayer_py import generate_private_key; print(generate_private_key().hex())"`
and fund/import that instead if you'd rather not export the CLI key).

### 5. Deploy

**Bradbury (v0.5, legacy contract):**

```bash
genlayer network set testnet-bradbury
genlayer deploy --contract contracts/legacy/tribunal_consensus_v05.py
```

or, using the Python client (also writes `CONTRACT_ADDRESS` into `.env`):

```bash
python scripts/deploy.py
```

**Studio Next (v0.6, primary contract):**

```bash
npm install
npm run deploy:studio
```

This generates a fresh `STUDIO_PRIVATE_KEY` in `.env` on first run (fund it
yourself, or the script self-funds via `sim_fundAccount` on Studio Next),
quotes real fees against the network's live fee policy, and writes
`STUDIO_CONTRACT_ADDRESS` / `NEXT_PUBLIC_CONTRACT_ADDRESS` back to `.env`.

### 6. Generate scenarios and run the end-to-end demo

```bash
python simulator/marketplace.py clean
python simulator/marketplace.py rigged

# Bradbury (v0.5)
python scripts/demo.py rigged --finalize   # the "verdict moment"
python scripts/demo.py clean --finalize    # control: same pipeline, no collusion

# Studio Next (v0.6) -- same lifecycle, plus withdraw() at the end
npm run demo:studio -- rigged --finalize
npm run demo:studio -- clean --finalize
```

### 7. Run the frontend

It's already live at **[genantitrust.vercel.app](https://genantitrust.vercel.app)**
(both deployed contract addresses are baked in as public defaults, so it
works with no env setup). To run it locally instead:

```bash
cd frontend
npm install
cp .env.local.example .env.local   # optional: override NEXT_PUBLIC_CONTRACT_ADDRESS (Studio Next)
npm run dev
```

Open http://localhost:3000. A pill in the nav switches the whole dashboard
between the two live networks:

- **Studio Next** (default) -- chain `61997`, added to your wallet
  automatically on connect. Five lifecycle steps, including `withdraw()`.
- **Bradbury** -- chain `4220`, RPC `https://rpc-bradbury.genlayer.com`. Four
  lifecycle steps (no withdraw -- Bradbury pays out directly).

Without a wallet the dashboard still works read-only on either network.
Scenario evidence is served as static files from `frontend/public/scenarios/`
-- regenerate both the source copy and this one with
`python simulator/marketplace.py <clean|rigged>`.

The frontend runs two major versions of `genlayer-js` side by side (`2.0.0-rc.1`
for Studio Next, and `1.1.8` aliased as `genlayer-js-v1` for Bradbury) because
v2's calldata encoding can't call a v0.5 contract. `lib/network.ts` defines a
shared `NetworkAdapter` interface so the rest of the UI never imports either
SDK directly.

To redeploy after a change: `cd frontend && vercel deploy --prod`.

## How a dispute flows through the contract

1. **`file_complaint(respondent, market_id, evidence_json, context_url)`**
   (payable, >= 1 GEN) -- a complainant posts an anti-spam bond and the raw
   pricing/negotiation evidence. Funds move into the contract; nothing has
   been judged yet.
2. **`resolve_dispute(dispute_id)`** -- runs the Equivalence Principle call.
   The leader validator prompts an LLM with the evidence (and, if a
   `context_url` was supplied, live-fetched public web content) and returns
   a verdict. Every other validator independently re-fetches that same
   context and re-judges the leader's answer against the criteria below --
   if a majority disagrees, GenLayer rotates to a new leader and retries.
   No funds move yet; the dispute becomes appealable.
3. **`appeal_verdict(dispute_id, additional_evidence_json)`** (payable, >=
   the original bond) -- either party can, up to twice, post a fresh appeal
   bond with new evidence to force a re-judgment. The appeal bond settles
   immediately: if the verdict flips, the appellant is refunded in full; if
   it's confirmed, the bond is forfeited to the other party.
4. **`finalize_dispute(dispute_id)`** -- once nobody appeals further, anyone
   can finalize: a `legitimate` verdict pays the original bond to the
   respondent (compensation for an unfounded complaint); `collusion` or
   `inconclusive` refunds the complainant.
5. **`withdraw()`** (Studio Next / v0.6 only) -- pulls whatever a wallet is
   owed. On Bradbury, `finalize_dispute` pays the winning party directly. On
   Studio Next, Consensus v0.6 requires every fee-bearing emitted message to
   be pre-declared in the *submitting* transaction's message-allocation
   tree -- but an appeal's eventual payee isn't known until the verdict
   round decides it. `finalize_dispute` and `appeal_verdict` instead credit
   a `claimable` ledger (pure deterministic bookkeeping, no message
   emitted); `withdraw()` is the one place that actually emits a transfer,
   and its recipient is always `gl.message.sender_address` -- known before
   the call even starts, so the allocation is trivial to pre-declare.

**On payout timing:** every payout uses GenLayer's EVM-external-message
transfer (`on='finalized'` by default) -- the safe option, meaning the GEN
actually lands in the recipient's wallet only once that transaction's own
appeal window has closed and it reaches `FINALIZED` (not merely `ACCEPTED`).
This is standard GenLayer settlement behavior, not a delay specific to this
contract: you can watch it happen on either explorer -- the transaction's
`messages` field shows the queued transfer immediately, and
`triggered_transactions` populates once it activates.

## The Equivalence Principle, concretely

```python
# `gather_input` supplies the raw material (evidence + any live-fetched
# market context) -- it must NOT pre-compute a verdict itself. The
# Equivalence Principle performs `task` on that input via its own LLM
# call, and every validator independently redoes exactly that.
result_str = gl.eq_principle.prompt_non_comparative(
    gather_input,
    task="Classify the supplied pricing evidence as antitrust 'collusion', "
         "'legitimate' competition, or 'inconclusive', with a confidence "
         "score and reasoning grounded in the evidence and any live market context.",
    criteria="""Accept the leader's answer only if ALL of the following hold:
1. It is valid JSON with exactly the keys: verdict, confidence, key_signals, reasoning.
2. verdict is exactly one of "collusion", "legitimate", "inconclusive".
3. confidence is an integer between 0 and 100.
4. key_signals cites concrete details that actually appear in the supplied evidence
   or market context -- no fabricated or invented facts.
5. reasoning is economically sound: parallel or matching prices ALONE are NOT
   sufficient for a "collusion" verdict without an actual signal of coordination.
   Independently reasonable explanations must count against a "collusion" verdict.
6. If the evidence is too thin or ambiguous, "inconclusive" must be preferred
   over guessing.""",
)
```

See [`_run_verdict` in contracts/tribunal.py](contracts/tribunal.py) for the full prompt.

## Demo video

The demo leads with the verdict moment, not setup: file the *rigged* scenario's
complaint on camera, then cut straight to `resolve_dispute` executing --
validators independently reasoning over the same evidence and converging (or
disagreeing) on a verdict live on the Bradbury explorer. Setup/config is
covered in voiceover over B-roll, not shown step by step.

[Link to demo video -- ADD BEFORE SUBMISSION]

## Known limitations

- The marketplace is simulated (see table above) -- there is no live A2A
  message bus feeding real agent negotiation logs yet. `evidence_json` is
  exactly the shape a real integration would pass in.
- `context_url` (the live-data cross-check) is optional and off by default in
  the CLI demo; pass `--context-url` to `scripts/demo.py` to exercise it.
- Appeal economics are intentionally simple (fixed 1x bond escalation, a cap
  of two rounds) rather than GenLayer's full staking/rotation model, to keep
  the contract's decision logic auditable for this submission.
- Studio Next enforces a 30-requests-per-minute RPC limit; the dashboard
  polls contract state every 15 seconds (well under it). Filing/resolving
  faster than that in quick succession can still trip a transient 429 --
  retry after a few seconds.
