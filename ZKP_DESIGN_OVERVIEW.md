# ZKP Design Overview — SoulboundIdentity

## 1. Architecture Diagram — What Has Been Built

```
╔══════════════════════════════════════════════════════════════════╗
║                    SOULBOUND IDENTITY SYSTEM                     ║
╚══════════════════════════════════════════════════════════════════╝

  ┌─────────────────────────────────────────────────────────────┐
  │                     USER (Browser)                          │
  │                                                             │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
  │  │ Identity │  │Credential│  │  Social  │  │ Access   │   │
  │  │   Tab    │  │   Tab    │  │   Tab    │  │ Control  │   │
  │  │          │  │          │  │          │  │   Tab    │   │
  │  │  Mint    │  │ Degrees  │  │ Repute   │  │ Approve/ │   │
  │  │  Token   │  │ Certs    │  │ Projects │  │  Deny    │   │
  │  │  QR Code │  │ Skills   │  │ Endorse  │  │ Requests │   │
  │  │  View    │  │ WorkExp  │  │          │  │          │   │
  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
  │       │             │             │              │          │
  │       └─────────────┴─────────────┴──────────────┘          │
  │                           │                                  │
  │                    ethers.js v5.7.2                          │
  │                           │                                  │
  │                      MetaMask Wallet                         │
  └───────────────────────────┬─────────────────────────────────┘
                              │
                  JSON-RPC (https://rpc.dimikog.org)
                              │
  ┌───────────────────────────▼─────────────────────────────────┐
  │               QBFT Besu Blockchain (Chain 424242)            │
  │                                                             │
  │  ┌──────────────────────┐   ┌──────────────────────────┐   │
  │  │  SoulboundIdentity   │   │      CredentialsHub       │   │
  │  │  .sol (ERC-5484)     │   │      .sol                 │   │
  │  │                      │   │                           │   │
  │  │  • Mint soulbound    │   │  • Degrees (6 categories) │   │
  │  │    token (1 per addr)│   │  • Certifications (5)     │   │
  │  │  • IPFS CID metadata │   │  • Work Experience        │   │
  │  │  • Request/Approve/  │   │  • Identity Proofs        │   │
  │  │    Deny access flow  │   │  • Skills (6 categories)  │   │
  │  │  • Rate limiting     │   │  • Verified vs self-report│   │
  │  │  • Burn auth levels  │   │  • Bitmask access control │   │
  │  │  • Batch operations  │   │  • Batch operations       │   │
  │  │                      │   │                           │   │
  │  │  0xf1FB393025ef...   │   │  0x25154346a752...        │   │
  │  └──────────────────────┘   └──────────────────────────┘   │
  │                                                             │
  │  ┌──────────────────────────────────────────────────────┐   │
  │  │                    SocialHub.sol                      │   │
  │  │                                                       │   │
  │  │  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐  │   │
  │  │  │  Reputation  │ │   Projects   │ │ Endorsements│  │   │
  │  │  │              │ │              │ │             │  │   │
  │  │  │ Peer reviews │ │ Portfolio    │ │ 16 standard │  │   │
  │  │  │ 0-100 score  │ │ IPFS meta    │ │ skills      │  │   │
  │  │  │ Cached avg   │ │ Collaborators│ │ Custom hash │  │   │
  │  │  │ 1 per pair   │ │ Status track │ │ skills      │  │   │
  │  │  └──────────────┘ └──────────────┘ └─────────────┘  │   │
  │  │                                                       │   │
  │  │  0xbe78D2f3c24A...                                    │   │
  │  └──────────────────────────────────────────────────────┘   │
  └─────────────────────────────────────────────────────────────┘
                              │
                        IPFS (off-chain)
                    Credential metadata CIDs
                    Project metadata CIDs

  ┌─────────────────────────────────────────────────────────────┐
  │                 ZKP LAYER (NOT YET BUILT)                    │
  │                                                             │
  │    Browser / VM ──► Circuit ──► Proof ──► Verifier.sol      │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

---

## 2. ZKP Use Case — Reputation Score Threshold

**The core claim to prove:** *"My reputation score is at or above threshold T, without revealing my exact score."*

### Why reputation first?

It is the simplest and highest-value ZKP in this system. Reputation is already fully on-chain in `SocialHub.sol` (reviews, sum, count), so there is no secret data — the ZKP is doing **trustless computation and verifiable attestation**, not hiding anything. This makes it the perfect first circuit: easy to reason about, easy to test, and directly useful (employers check "above 70 score" not the exact number).

### The on-chain data available

`SocialHub.sol` stores per token:
- `reviewCount[tokenId]` — number of reviews received
- `reputationTotal[tokenId]` — cached sum of all scores (0–100 each)
- Individual reviews: reviewer address, score, isVerified flag, timestamp

Average = `reputationTotal / reviewCount` (integer, 0–100)

### What the user experiences

> "Employer XYZ wants to verify your reputation score is above 70. Share this?"
> → User taps **Yes** → proof generated invisibly → verifier contract confirms on-chain.

The requester learns only: `score >= 70 ✓`. They learn nothing about the actual score (e.g. 84).

### Architecture path chosen

**Path 2 — VM backend** (as recommended in `ZKP_ARCHITECTURE_CHOICES.md`).

All data is already publicly on-chain, so server-side proof generation has zero privacy cost and delivers strictly better UX: no large file downloads, no browser spinner, works on all devices including mobile. The VM reads the on-chain scores, runs snarkjs in Node.js, and returns the Groth16 proof to the frontend, which submits it to the verifier contract.

---

## 3. Conceptual Circuit Design — `ReputationThreshold`

```
╔══════════════════════════════════════════════════════════════╗
║           CIRCUIT: ReputationThreshold (Groth16)             ║
╚══════════════════════════════════════════════════════════════╝

  ┌──────────────────────┐     ┌──────────────────────────────┐
  │   PRIVATE INPUTS     │     │       PUBLIC INPUTS          │
  │   (witness — never   │     │   (on-chain, visible to all) │
  │    leaves prover)    │     │                              │
  │                      │     │  threshold    : field        │
  │  scores[n] : field[] │     │  tokenId      : field        │
  │  reviewCount : field │     │  scoresCommit : field (hash) │
  └──────────┬───────────┘     └──────────────┬───────────────┘
             │                                │
             ▼                                ▼
  ┌──────────────────────────────────────────────────────────┐
  │                    CIRCUIT CONSTRAINTS                    │
  │                                                          │
  │  CONSTRAINT 1 — Range check on each score:               │
  │    for i in 0..n:                                        │
  │      assert  0 <= scores[i] <= 100                       │
  │      (via 7-bit range proof per score)                   │
  │                                                          │
  │  CONSTRAINT 2 — Sum accumulation:                        │
  │    sum = scores[0] + scores[1] + ... + scores[n-1]       │
  │                                                          │
  │  CONSTRAINT 3 — Count consistency:                       │
  │    assert reviewCount == n  (count matches array length) │
  │                                                          │
  │  CONSTRAINT 4 — Average computation (scaled ×100):       │
  │    avgScaled = sum * 100                                 │
  │    assert avgScaled >= threshold * reviewCount           │
  │    (avoids division — uses cross-multiplication instead) │
  │                                                          │
  │  CONSTRAINT 5 — Commitment integrity:                    │
  │    assert Poseidon(scores[], reviewCount) == scoresCommit│
  │    (ties the proof to the specific on-chain data state)  │
  │                                                          │
  │  OUTPUT — Public signals:                                │
  │    result        = 1  (threshold satisfied)              │
  │    threshold     (re-exported as public signal)          │
  │    tokenId       (which identity this proof is for)      │
  │    scoresCommit  (binds proof to on-chain snapshot)      │
  └──────────────────────────────────────────────────────────┘
             │
             ▼
  ┌──────────────────────────────────────────────────────────┐
  │              GROTH16 PROOF OBJECT (on-chain)              │
  │                                                          │
  │  {                                                       │
  │    proof: { pi_a, pi_b, pi_c }   ← elliptic curve points│
  │    publicSignals: [               ← verified on-chain    │
  │      threshold,                                          │
  │      tokenId,                                            │
  │      scoresCommit,                                       │
  │      result (= 1)                                        │
  │    ]                                                     │
  │  }                                                       │
  └──────────────────────────────────────────────────────────┘
             │
             ▼
  ┌──────────────────────────────────────────────────────────┐
  │           ReputationVerifier.sol  (auto-generated)        │
  │                                                          │
  │   verifyProof(pi_a, pi_b, pi_c, publicSignals)           │
  │     → bool  (true if proof is valid)                     │
  │                                                          │
  │   After verification the contract can:                   │
  │    • Emit ReputationVerified(tokenId, threshold, ts)     │
  │    • Store attestation on-chain for requesters to query  │
  └──────────────────────────────────────────────────────────┘
```

### Key design decisions

| Decision | Choice | Reason |
|---|---|---|
| Proof system | Groth16 | Smallest on-chain proof size (3 points), cheapest `verifyProof` gas cost |
| Circuit language | Circom 2 | Industry standard, compiles to snarkjs-compatible wasm + zkey |
| Division avoidance | Cross-multiply (`sum * 100 >= threshold * count`) | No field division needed in circuits |
| Hash function | Poseidon | ZK-native hash, far fewer constraints than SHA256 or keccak |
| Score array size | Fixed at `MAX_REVIEWS = 50` (pad unused slots with 0) | Circom requires fixed-size arrays; 50 matches SocialHub contract max |
| Scalar field | BN128 (alt_bn128) | Supported natively by EVM precompile EIP-197, cheap on-chain verification |

### Full data flow (VM backend path)

```
  User taps "Yes"
       │
       ▼
  Frontend reads on-chain data
  (reviewCount, reputationTotal, individual scores from SocialHub.sol)
       │
       ▼
  Frontend calls VM API:
  POST /prove  { scores[], reviewCount, threshold, tokenId }
       │
       ▼
  VM (Node.js + snarkjs):
    1. Compute Poseidon(scores[], reviewCount) → scoresCommit
    2. Run Groth16 prover with circuit wasm + zkey
    3. Return { proof, publicSignals }
       │
       ▼
  Frontend calls ReputationVerifier.sol:
  verifyAndStore(proof, publicSignals)
       │
       ▼
  On-chain: emit ReputationVerified(tokenId, threshold, timestamp)
  Requester queries event → learns score >= threshold ✓
```
