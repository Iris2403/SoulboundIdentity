# Chapter 5 — Zero-Knowledge Proof Integration

This chapter describes the ZKP subsystem in detail. Section 5.1 explains how real-world credential claims are mapped to arithmetic circuits. Section 5.2 provides a deep dive into the `reputation_threshold` circuit — the primary circuit and the first implemented. Section 5.3 covers the four remaining circuits and their design patterns. Section 5.4 describes the trusted setup and proving key generation process. Section 5.5 explains the in-browser proof generation flow and how ZKP complexity is made invisible to users. Section 5.6 covers on-chain verification and what happens after a proof is submitted.

---

## 5.1 Circuit Design Overview

### 5.1.1 From Real-World Claim to Arithmetic Circuit

Zero-knowledge proofs operate over arithmetic circuits — directed acyclic graphs of field addition and multiplication gates. A circuit takes an **input assignment** (the witness) and checks whether it satisfies a system of polynomial equations over a prime field Fₚ. To use a ZKP, every claim to be proved must be expressed as such a system.

This translation from natural-language claim to circuit constraint is the central design challenge of ZKP engineering. The claim "my reputation score is above 70" must be re-expressed as a set of field equations that are satisfiable if and only if the claim is true. Table 5.1 shows how each of the five circuits maps a professional credential claim to its circuit constraint.

**Table 5.1 — Claim-to-constraint mapping for all five circuits**

| Circuit | Natural-language claim | Core constraint | Private input | Public input |
|---|---|---|---|---|
| `reputation_threshold` | Reputation score ≥ T | `score > threshold` | `score` | `threshold` |
| `gpa_threshold` | GPA ≥ T (×100 scaled) | `gpa > threshold` | `gpa` | `threshold` |
| `work_experience_threshold` | Total experience ≥ T years | `totalYears >= threshold` | `totalYears` | `threshold` |
| `degree_category` | Degree is in category C | `category == claimedCategory` | `category` | `claimedCategory` |
| `cert_domain` | Certification is in domain D | `domain == claimedDomain` | `domain` | `claimedDomain` |

### 5.1.2 Private vs. Public Inputs

Every circuit in this system draws a clear boundary between private and public inputs.

**Private inputs** (the witness) are known only to the prover. They carry the sensitive credential value — the exact score, GPA, experience duration, or category enum — that the user does not wish to reveal. The Groth16 proving process uses the private inputs to compute the proof object, but the proof object itself mathematically guarantees that no information about the private inputs can be extracted by the verifier.

**Public inputs** are known to both the prover and verifier. They define the claim being proven — the threshold value, or the category being asserted — and are embedded in the proof's public signals. The on-chain verifier checks the proof against these public signals; they appear in the emitted events and are visible to anyone querying the blockchain.

The result is that a verifier learns exactly what they requested — "this credential is above threshold T" or "this degree is in category C" — and nothing more.

### 5.1.3 Prototype Scope

The circuits implemented in this thesis are deliberately minimal proof-of-concept circuits. Each proves a single claim with the minimum number of constraints necessary to demonstrate the end-to-end ZKP flow: proof generation, on-chain verification, and user-transparent UX. This scope was chosen in alignment with the project's stated goal (from `ZKP_ARCHITECTURE_CHOICES.md`): to demonstrate that the system works end-to-end — proof is generated, verified on-chain, and the flow is wired to the frontend — rather than to implement production-grade circuits with full data binding.

Section 5.2 describes what a production circuit for reputation threshold would additionally require, and why the prototype chose the simpler formulation.

---

## 5.2 The `reputation_threshold` Circuit — Deep Dive

### 5.2.1 What the Circuit Proves

The `reputation_threshold` circuit proves the claim: *"The reputation score associated with this identity is strictly greater than the threshold T."*

The circuit takes two inputs:

- **Private:** `score` — the actual reputation score of the token holder, computed from the cached `_runningScoreTotal / _reviewCount` in `SocialHub`.
- **Public:** `threshold` — the minimum score the verifier requires, set at proof-generation time.

The single constraint enforced by the circuit is:

```
score > threshold
```

If this constraint is satisfied — i.e., the supplied `score` is strictly greater than the supplied `threshold` — the prover can produce a valid Groth16 proof. The verifier, seeing only the proof and the public `threshold` value, is convinced that the prover knows a `score` greater than `threshold`, without learning the actual `score`.

### 5.2.2 Circuit File Artefacts

The Circom 2 compilation produces two artefacts used at proving time:

- **`reputation_threshold.wasm`** (37 KB) — the WebAssembly witness generator. Given the circuit inputs as a JSON object, the WASM module computes the full witness: all intermediate signal values required to satisfy the R1CS. This runs entirely in the browser.

- **`reputation_threshold_final.zkey`** (22 KB) — the proving key produced by the circuit-specific phase 2 of the trusted setup. This encodes the structured reference string required for Groth16 proving. It is loaded into the browser alongside the WASM file at proof-generation time.

The relatively small file sizes (37 KB and 22 KB) reflect the simplicity of the circuit: a small number of R1CS constraints leads to a small SRS and a compact WASM binary. These files are served as static assets and are cacheable after first load.

### 5.2.3 Proof Generation Call

The proof is generated by a single `snarkjs` call in the frontend:

```javascript
const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
    { score: score.toString(), threshold: threshold.toString() },
    'circuits/reputation_threshold.wasm',
    'circuits/reputation_threshold_final.zkey'
);
```

`groth16.fullProve()` performs two steps internally: it runs the WASM witness generator to compute the full witness from the inputs, then runs the Groth16 prover with the witness and the proving key to produce the proof. The returned `proof` object contains three BN128 elliptic curve points (`pi_a`, `pi_b`, `pi_c`); `publicSignals` contains the public output values of the circuit.

### 5.2.4 Proof Format and the pB Coordinate Swap

The Groth16 proof consists of three curve points over the BN128 pairing-friendly elliptic curve:

- `pi_a` — a point on G₁, represented as two 32-byte field elements `[x, y]`
- `pi_b` — a point on G₂, represented as two pairs of 32-byte field elements `[[x₀, x₁], [y₀, y₁]]`
- `pi_c` — a point on G₁, represented as two 32-byte field elements `[x, y]`

The Solidity verifier contract, auto-generated by snarkjs, expects the G₂ point in the opposite coordinate order from what snarkjs returns. This coordinate swap must be applied before submitting the proof on-chain:

```javascript
const pA = [proof.pi_a[0], proof.pi_a[1]];
// G₂ coordinates are swapped: [1][0] before [0][0], [1][1] before [0][1]
const pB = [
    [proof.pi_b[0][1], proof.pi_b[0][0]],
    [proof.pi_b[1][1], proof.pi_b[1][0]]
];
const pC = [proof.pi_c[0], proof.pi_c[1]];
```

This swap is a known requirement of the snarkjs/Solidity verifier interface, arising from the difference between the affine coordinate convention used in snarkjs's output and the convention expected by the EVM precompile for G₂ point encoding.

### 5.2.5 What a Production Circuit Would Add

The prototype circuit proves the claim against a score value supplied directly by the frontend. A production circuit for the same claim would additionally need to:

1. **Bind the proof to on-chain data.** The frontend currently reads the cached average score from `SocialHub` and passes it as the private input. A malicious prover could supply any value, not the actual on-chain score. A production circuit would include the individual review scores as private inputs, recompute the average inside the circuit, and include a **Poseidon commitment** to the score array as a public input — allowing the verifier contract to confirm that the proof was generated from the actual on-chain score state.

2. **Range-check the score.** The prototype does not verify that `score` is within the valid range [0, 100]. A production circuit would add range constraints (via a bit decomposition gadget) to prevent a prover from supplying an out-of-range value that satisfies the threshold constraint trivially.

3. **Include a tokenId binding.** The prototype proof does not reference the token it is being generated for. A production circuit would include `tokenId` as a public input, so the on-chain verifier can confirm the proof was generated for the correct token identity.

These extensions represent a natural evolution path from prototype to production, as described further in Chapter 7.

---

## 5.3 The Remaining Four Circuits

### 5.3.1 `gpa_threshold`

**Claim proved:** *"This token's GPA is strictly greater than threshold T (scaled ×100)."*

**Inputs:**
- Private: `gpa` — the GPA value stored in `CredentialsHub.degreeGPA[credentialId]`, encoded as an integer ×100 (e.g., `350` represents 3.50).
- Public: `threshold` — the minimum GPA threshold required, also ×100 (e.g., `300` = GPA 3.00).

**Core constraint:** `gpa > threshold`

**Design note:** GPA is stored ×100 on-chain to preserve two decimal places of precision without floating-point arithmetic, which does not exist in Solidity or arithmetic circuits. Both the private and public inputs use the same ×100 scaling, so the comparison is exact integer arithmetic.

**Circuit artefacts:** `gpa_threshold.wasm` (37 KB), `gpa_threshold_final.zkey` (22 KB) — matching the `reputation_threshold` file sizes, reflecting a structurally identical circuit with different semantic input names.

**Frontend call:**
```javascript
await window.snarkjs.groth16.fullProve(
    { gpa: maxGpa.toString(), threshold: threshold.toString() },
    'circuits/gpa_threshold.wasm',
    'circuits/gpa_threshold_final.zkey'
);
```

---

### 5.3.2 `work_experience_threshold`

**Claim proved:** *"The total accumulated work experience is at least T years."*

**Inputs:**
- Private: `totalYears` — the number of complete years of work experience, computed by `CredentialsHub.getTotalWorkExperience()`.
- Public: `threshold` — the minimum years required.

**Core constraint:** `totalYears >= threshold`

**Design note:** This circuit uses a non-strict inequality (`>=`) rather than a strict one (`>`), reflecting how work experience thresholds are conventionally expressed: "at least 3 years" rather than "more than 3 years". The underlying constraint formulation is `totalYears - threshold >= 0`.

The on-chain work experience total is computed by `getTotalWorkExperience()`, which sums the duration of all non-revoked `WorkExperience` credentials (using `issueDate` as start and `expiryDate` as end, with `block.timestamp` for currently active positions) and returns whole years and remaining months. The circuit uses only the whole-year total.

**Circuit artefacts:** `work_experience_threshold.wasm` (37 KB), `work_experience_threshold_final.zkey` (22 KB).

---

### 5.3.3 `degree_category`

**Claim proved:** *"This token holds an active degree in category C."*

**Inputs:**
- Private: `category` — the `DegreeCategory` enum value of an active degree credential (0–5).
- Public: `claimedCategory` — the category the prover claims membership in (0–5).

**Core constraint:** `category == claimedCategory`

**Design note:** This circuit is categorically different from the threshold circuits: it proves **equality** rather than an inequality. The claim is not "my category value is above some threshold" but "my credential belongs to exactly this category". The constraint `category == claimedCategory` is enforced as `category - claimedCategory == 0`.

The circuit is also simpler in terms of constraint count, which is reflected in its significantly smaller file sizes: `degree_category.wasm` (35 KB), `degree_category_final.zkey` (3.5 KB). The `.zkey` is approximately six times smaller than the threshold circuits, indicating fewer R1CS constraints and a correspondingly smaller structured reference string.

The frontend first checks that an active degree credential with the claimed category exists in the viewed token's credential set before invoking the prover — preventing the proof attempt from failing mid-generation if no matching credential exists.

---

### 5.3.4 `cert_domain`

**Claim proved:** *"This token holds an active certification in domain D."*

**Inputs:**
- Private: `domain` — the `CertificationDomain` enum value of an active certification credential (0–4).
- Public: `claimedDomain` — the domain being asserted.

**Core constraint:** `domain == claimedDomain`

**Design note:** Structurally identical to `degree_category` but operating over the `CertificationDomain` enum (5 values: ITSoftwareDevelopment, BusinessManagement, HealthMedicine, DataAIAnalytics, CommunicationMarketing) rather than `DegreeCategory` (6 values).

**Circuit artefacts:** `cert_domain.wasm` (35 KB), `cert_domain_final.zkey` (3.5 KB) — matching `degree_category`, confirming that the circuit structure and constraint count are equivalent.

---

### 5.3.5 Circuit Comparison Summary

**Table 5.2 — Circuit artefact sizes and complexity indicators**

| Circuit | `.wasm` size | `.zkey` size | Constraint type | Inputs |
|---|---|---|---|---|
| `reputation_threshold` | 37 KB | 22 KB | Strict inequality | `score`, `threshold` |
| `gpa_threshold` | 37 KB | 22 KB | Strict inequality | `gpa`, `threshold` |
| `work_experience_threshold` | 37 KB | 22 KB | Non-strict inequality | `totalYears`, `threshold` |
| `degree_category` | 35 KB | 3.5 KB | Equality | `category`, `claimedCategory` |
| `cert_domain` | 35 KB | 3.5 KB | Equality | `domain`, `claimedDomain` |

The `.zkey` size difference is the most informative metric. The 22 KB proving keys for the three inequality circuits reflect a larger R1CS than the 3.5 KB keys for the two equality circuits. Inequality constraints in arithmetic circuits require range checks — decomposing the difference value into bits to verify it is non-negative — which add significantly more constraints than a simple equality check. This is consistent with the expected constraint counts.

---

## 5.4 Trusted Setup and Proving Key Generation

### 5.4.1 The Two-Phase Trusted Setup

Groth16 requires a **trusted setup** — a one-time ceremony that produces the structured reference string (SRS) from which the proving and verification keys are derived. The setup has two phases.

**Phase 1: Powers of Tau.** The first phase generates a universal SRS that is circuit-independent. It is called "Powers of Tau" because the SRS consists of powers of a secret scalar τ evaluated on the BN128 elliptic curve: {τG, τ²G, ..., τⁿG}. Anyone who knows τ can forge proofs for any circuit — so τ must be provably discarded. This is achieved by having multiple participants each contribute random randomness and prove they destroyed their contribution; if any single participant acted honestly and deleted their secret, the SRS is secure.

For this project, the publicly available **Hermez Network Powers of Tau** ceremony file is used (`powersOfTau28_hez_final_12.ptau`), which supports circuits with up to 2¹² = 4,096 R1CS constraints. This ceremony involved over 200 participants, making collusion to forge τ computationally implausible.

**Phase 2: Circuit-specific contribution.** The second phase takes the phase 1 SRS and specialises it to a specific circuit's R1CS structure. This produces the proving key (`.zkey`) and verification key (embedded in the Solidity verifier contract). Phase 2 also requires a secret contribution (similarly discarded), but it is circuit-specific and can be performed by the system deployer alone. For a prototype, a single-participant phase 2 contribution is acceptable; a production deployment would require a multi-party ceremony for phase 2 as well.

### 5.4.2 Key Generation Sequence

The key generation sequence for each circuit follows these snarkjs commands:

```bash
# 1. Compile the Circom circuit to R1CS and WASM
circom circuit.circom --r1cs --wasm --sym

# 2. Phase 2 setup — specialise the SRS to this circuit
snarkjs groth16 setup circuit.r1cs powersOfTau28_hez_final_12.ptau circuit_0000.zkey

# 3. Contribute randomness to phase 2 (discarded after)
snarkjs zkey contribute circuit_0000.zkey circuit_final.zkey --name="contributor"

# 4. Export the Solidity verifier contract
snarkjs zkey export solidityverifier circuit_final.zkey Verifier.sol

# 5. Export the verification key (for local verification)
snarkjs zkey export verificationkey circuit_final.zkey verification_key.json
```

The resulting `circuit_final.zkey` file is the proving key served to the browser. The `Verifier.sol` is deployed to the blockchain. The `verification_key.json` enables optional local verification without an on-chain call.

### 5.4.3 Trusted Setup Security Assumptions

The security of the system rests on the assumption that at least one participant in the Hermez Powers of Tau ceremony honestly deleted their contribution secret. This assumption is widely regarded as practically satisfied given the scale of the ceremony. The circuit-specific phase 2 contribution, performed by the project deployer, introduces a weaker single-party assumption for the prototype. In a production deployment, the phase 2 contribution would be performed in a multi-party ceremony (e.g., using the `snarkjs zkey beacon` command with a verifiable random beacon) to eliminate the single-party trust requirement.

---

## 5.5 In-Browser Proof Generation

### 5.5.1 The Full Proof Generation Flow

When a user initiates a ZKP attestation from the Access Control tab, the following sequence executes entirely in the browser:

```
User clicks "Verify"
        │
        ▼
Frontend reads on-chain data
(score from SocialHub / GPA from CredentialsHub / etc.)
        │
        ▼
Frontend checks pre-condition
(score > threshold? matching credential exists?)
        │ Yes
        ▼
snarkjs.groth16.fullProve(inputs, .wasm path, .zkey path)
        │
        ├── WASM witness generator runs
        │   (computes all intermediate signals from inputs)
        │
        └── Groth16 prover runs
            (produces proof: pi_a, pi_b, pi_c + publicSignals)
        │
        ▼
Frontend applies pB coordinate swap
        │
        ▼
verifier.verifyProof(pA, pB, pC, publicSignals)
(call to on-chain verifier — read-only, no gas)
        │
        ▼
Display result to user ("Verified on-chain ✓")
```

**Figure 5.1 — In-browser proof generation and verification flow**

The entire sequence from user click to on-chain verification result is invisible to the user except for a status message that transitions through three states: `generating` ("Generating proof…"), `verifying` ("Verifying on-chain…"), and either `success` or `error`.

### 5.5.2 Status Machine in the Frontend

Each of the five circuits has a dedicated React state pair in `AccessControlTab`: a `*ZkpStatus` string (`'idle' | 'generating' | 'verifying' | 'success' | 'error'`) and a `*ZkpMessage` string. These are updated synchronously as the proof flow progresses:

```javascript
setRepZkpStatus('generating');
setRepZkpMessage('Generating proof...');
// ... await snarkjs call ...
setRepZkpStatus('verifying');
setRepZkpMessage('Verifying on-chain...');
// ... await verifier call ...
setRepZkpStatus('success');
setRepZkpMessage(`Reputation ≥ ${threshold} — verified on-chain.`);
```

If snarkjs throws (e.g., if the inputs are invalid or the circuit constraint is not satisfied), the catch block sets the status to `'error'` with the error message. If the on-chain verifier returns `false` (a valid proof format but incorrect for the verification key), the error state is set explicitly. In all cases, the user receives a plain-language message without any exposure to the underlying cryptographic error.

### 5.5.3 Pre-Condition Checking

Before invoking `fullProve`, the frontend performs a pre-condition check: if the private input already fails the claim (e.g., the score is not greater than the threshold), the proof attempt is short-circuited and an error state is set immediately. This avoids wasting time on proof generation that would produce an invalid proof:

```javascript
if (score <= threshold) {
    setRepZkpStatus('error');
    setRepZkpMessage(`Score is NOT above ${threshold}.`);
    return;
}
```

This check is not a security measure — the circuit constraint itself would reject an invalid witness during proving. It is a UX measure: proof generation takes time, and failing immediately with a clear message is better than spending several seconds generating a proof that will fail verification.

### 5.5.4 snarkjs as a Browser Dependency

snarkjs is loaded into the browser via a `<script>` tag that exposes `window.snarkjs`. The handler functions check for its presence before attempting any proof operation:

```javascript
if (!window.snarkjs) {
    showNotification('snarkjs not loaded', 'error');
    return;
}
```

This guard prevents silent failures if the script fails to load (e.g., due to network issues) and provides a clear error message to the user.

---

## 5.6 On-Chain Verification

### 5.6.1 The Auto-Generated Groth16 Verifier

Each circuit has its own Solidity verifier contract exported by snarkjs. All five verifiers expose the same interface:

```solidity
function verifyProof(
    uint[2] calldata _pA,
    uint[2][2] calldata _pB,
    uint[2] calldata _pC,
    uint[1] calldata _pubSignals
) public view returns (bool)
```

The verifier implementation performs the Groth16 verification equation: a series of BN128 pairing operations using the EVM's `ecAdd`, `ecMul`, and `ecPairing` precompiles (EIP-196 and EIP-197). The verification equation checks that the proof is consistent with the public signals under the verification key embedded in the contract bytecode. The function is a `view` — it reads no state and costs approximately 280,000 gas when called as part of a transaction (e.g., when `recordProof` submits a proof to `ReputationProofRegistry`), or zero gas when called as a static call (read-only query against a local node).

### 5.6.2 Deployed Verifier Contracts

Each circuit has a separately deployed verifier contract on Chain ID 424242. The contracts are accessed from the frontend via dedicated ABI entries in `contracts.js`:

| Circuit | ABI constant | Config key |
|---|---|---|
| `reputation_threshold` | `GROTH16_VERIFIER_ABI` | `CONTRACTS.REPUTATION_VERIFIER` |
| `gpa_threshold` | `GPA_VERIFIER_ABI` | `CONTRACTS.GPA_VERIFIER` |
| `degree_category` | `DEGREE_CATEGORY_VERIFIER_ABI` | `CONTRACTS.DEGREE_CATEGORY_VERIFIER` |
| `cert_domain` | `CERT_DOMAIN_VERIFIER_ABI` | `CONTRACTS.CERT_DOMAIN_VERIFIER` |
| `work_experience_threshold` | `WORK_EXPERIENCE_VERIFIER_ABI` | `CONTRACTS.WORK_EXPERIENCE_VERIFIER` |

**Table 5.3 — Verifier contract ABI and config references**

All five verifiers share the same ABI signature (a `verifyProof` function taking three curve points and one public signal array), as generated by snarkjs for single-public-signal Groth16 circuits.

### 5.6.3 The Verification Call

The frontend does not submit a blockchain transaction for verification — it makes a static call to the verifier contract. In ethers.js v5, `contract.verifyProof(...)` on a `view` function executes locally on the connected node without broadcasting a transaction:

```javascript
const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
const verifier = new ethers.Contract(
    CONFIG.CONTRACTS.REPUTATION_VERIFIER,
    GROTH16_VERIFIER_ABI,
    provider  // provider (not signer) — read-only call
);
const isValid = await verifier.verifyProof(pA, pB, pC, publicSignals);
```

The provider (not the signer) is passed to the contract constructor, ensuring no transaction is sent and no gas is consumed for the verification call. This design allows anyone to verify a proof without holding ETH.

`ReputationProofRegistry.recordProof()` is a separate write transaction that stores the verified threshold on-chain. This distinction — between the lightweight read-only verification call and the gas-consuming on-chain storage call — is intentional: verification is free; storage is a deliberate, gas-paying commitment by the token owner to record their proven reputation threshold permanently.

### 5.6.4 Gas Cost of On-Chain Verification

The EVM precompile operations invoked by the Groth16 verifier have fixed gas costs defined in EIP-196 and EIP-197:

| Operation | Gas cost |
|---|---|
| `ecAdd` (G₁ point addition) | 150 gas |
| `ecMul` (G₁ scalar multiplication) | 6,000 gas |
| `ecPairing` (base cost) | 45,000 gas |
| `ecPairing` (per pairing) | 34,000 gas |

A Groth16 verifier requires 3 pairing operations (each consuming one G₂ and one G₁ point). The total precompile cost is approximately 45,000 + (3 × 34,000) = 147,000 gas for the pairings, plus approximately 130,000 gas for calldata decoding, memory operations, and the surrounding EVM execution — totalling approximately 280,000 gas for a full `verifyProof` transaction.

At the gas price of the QBFT Besu network (configurable, typically 0 for permissioned networks or a low nominal fee), this cost is economically negligible. On a public Ethereum mainnet deployment at 20 gwei per gas, the verification cost would be approximately 0.0056 ETH per proof — a feasible cost for a high-value professional attestation that replaces an entire background check process.

---

*End of Chapter 5*
