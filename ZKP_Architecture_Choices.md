# ZKP Architecture Choices — Selective Disclosure on Approval

**Constraints driving all options:**
- Owner never sees salt, commitment, or circuit files — everything is automatic
- Requester only sees the final claim result (e.g., `reputation > 85`)
- ZKP generation happens silently at approval time
- Non-technical users must be able to use it with zero understanding of ZKPs

---

## Option A — Groth16 + Circom with Auto-Managed Secrets (Extend Current Stack)

### Core Idea
Keep the Groth16/snarkjs/Circom stack you already have, but redesign the UX layer entirely.
Circuit files are pre-compiled and hosted on IPFS. Salt is derived deterministically from a
wallet signature so it never needs to be stored or shown. Commitments are set automatically
in the background, not as a separate user step.

### How the Hidden Parts Are Handled

**Salt:**
The user signs a fixed message with their wallet (e.g., `"zkp-salt-v1"`). The signature
is hashed (keccak256) to produce the salt. This means:
- Salt is always recoverable from the wallet — no storage needed
- User never sees it — it is computed behind the scenes on every proof
- It cannot be guessed without the private key

**Commitment:**
Set automatically the first time the user mints their token or when they first use the
approval flow. App computes `Poseidon(score, salt)` and submits the transaction silently
with a toast: "Setting up your privacy layer..." — no technical terms shown.

**Circuit Files (.wasm + .zkey):**
Pre-compiled and hosted at a known URL (e.g., on your IPFS node or a CDN).
App fetches them by claim type name when a proof is needed. User sees only a loading
spinner: "Preparing proof..." — files are never mentioned.

### Approval Flow (User Perspective)
```
Owner clicks "Approve" on a request
  → Modal opens: "What would you like to share?"
      [ ] Reputation above a threshold  →  enters: 85
      [ ] Has a verified degree
      [ ] Identity is verified
  → Clicks "Approve & Share"
  → Spinner: "Generating private proof..."  (fetches circuits, runs snarkjs silently)
  → Transaction sent
  → Requester sees: { "reputation > 85": ✓, "has degree": ✓ }
```

### Pros
- Lowest implementation risk — extends your existing code and contracts
- snarkjs is already loaded in your app
- Groth16 proofs are small and cheap to verify on-chain
- Well-documented ecosystem

### Cons
- Each new circuit type requires its own trusted setup ceremony (zkey generation)
- You need to host and maintain circuit files externally
- If IPFS fetch fails, proof generation fails — needs fallback hosting
- Circom DSL has a steep learning curve for adding new claim types later

### Thesis Novelty
The novelty is in the UX architecture: treating ZKP generation as a background service
integrated into the approval action, with deterministic salt derivation from wallet
signatures eliminating the commitment setup step as a separate user action.

---

## Option B — Noir + Barretenberg (No Per-Circuit Trusted Setup)

### Core Idea
Replace Circom/Groth16 with Noir (Aztec's ZK language) and the Barretenberg proving backend
(UltraHonk/PLONK). The critical difference: there is NO per-circuit trusted setup ceremony.
One universal setup covers all circuits. This means you can add new claim types without
organizing a new ceremony, and you only need one set of universal parameters — no zkey files
per circuit.

### How the Hidden Parts Are Handled

**Salt:**
Same deterministic wallet-signature approach as Option A. Noir circuits accept it as a
private input computed silently by the app.

**Commitment:**
Noir supports Pedersen and Poseidon natively. Commitment is computed and submitted
automatically on token setup, same as Option A — silent background transaction.

**Circuit Files:**
Noir compiles circuits to ACIR (Abstract Circuit Intermediate Representation), not
circuit-specific binary files. The Barretenberg WASM (~3MB, one file for everything)
is loaded once on app startup and reused for all proof types. There are no per-claim
.wasm or .zkey files to manage or fetch. The app bundles the compiled ACIR artifacts
directly (they are small JSON files, not binary blobs).

### Approval Flow (User Perspective)
Identical to Option A from the user's point of view — the difference is entirely internal.
The proving engine is different, but the modal, the spinner, and the final claim result
are the same.

### Pros
- No trusted setup per circuit — add new claim types freely without ceremony
- Single WASM file loaded once covers all circuits
- Noir is significantly easier to write than Circom (reads like Rust)
- Proof sizes and verification costs are comparable to Groth16
- More modern stack — strong thesis argument for choosing it over the status quo
- NoirJS library designed for browser use

### Cons
- Newer ecosystem — less StackOverflow coverage, more reliance on official docs
- Barretenberg WASM (~3MB) must load on app startup — adds initial load time
- On-chain Solidity verifier contract must be regenerated when circuit changes
  (same as Circom, but tooling is slightly less mature)
- You must rewrite existing reputation circuit from Circom to Noir

### Thesis Novelty
Stronger novelty than Option A: you are arguing that Noir's universal trusted setup
is the correct architecture for a selective disclosure system where claim types are
expected to grow over time. You are also demonstrating that ZKP usability barriers
(file management, salt exposure, commitment ceremonies) can be fully abstracted away
in a browser-native identity system.

---

## Option C — Server-Assisted Proving with SP1 (zkVM, No Circuit DSL)

### Core Idea
Abandon circuit languages entirely. Use SP1 (a zkVM by Succinct Labs) where you write
the claim logic in normal Rust code — no Circom, no Noir, no circuit constraints by hand.
A lightweight proving server (or a service like Succinct's Prover Network) runs the proof
generation off-device. The browser only submits the inputs and receives a verified proof
back. The on-chain verifier checks an SP1 proof, which is a universal STARK/SNARK.

### How the Hidden Parts Are Handled

**Salt:**
Generated server-side per proof request using `crypto.randomBytes`. Never transmitted
to the browser. The server holds it ephemerally only during proof generation, then discards it.
The commitment is what gets stored on-chain — the salt is gone after the proof is made.

**Commitment:**
Set by the proving server when the user first enrolls, not by the browser at all.
User sees only: "Setting up your account..." — one transaction, fully automatic.

**Circuit Files:**
There are none visible to the user. The proving server runs the Rust program and returns
a proof. The browser sends: `{ claimType: "reputation", threshold: 85, tokenId: 3 }`.
The server returns: `{ proof: "0x...", publicSignals: [...] }`. The browser just submits
this to the contract.

### Approval Flow (User Perspective)
```
Owner clicks "Approve" on a request
  → Modal: "What would you like to share?"  (same as other options)
  → Clicks "Approve & Share"
  → App sends claim request to proving server (HTTPS, < 1 second roundtrip for small claims)
  → Server generates proof, returns it
  → Browser submits approval + proof to contract in one transaction
  → Requester sees: { "reputation > 85": ✓ }
```

### Pros
- Zero ZKP complexity exposed to either owner or requester — most seamless UX
- Claim logic written in Rust — readable, testable, no DSL to learn
- No wasm files, no zkey files, no salt in the browser at all
- Easiest to extend: adding a new claim type = writing a new Rust function
- Proving can be parallelized on the server for speed

### Cons
- Requires running and maintaining a proving server (or paying for Succinct's network)
- Introduces a trusted component: the proving server sees the actual attribute values
  (score, credential details) to generate the proof — this is a trust assumption
  that the other two options do not have
- Higher infrastructure cost — not just a static frontend anymore
- SP1 proofs are larger than Groth16/PLONK proofs → higher on-chain gas cost
- More moving parts to demo in a thesis defense

### Thesis Novelty
The argument here is about decoupling proof generation from the client entirely,
treating ZKP as a microservice. The thesis contribution is the architecture pattern
itself: a privacy-preserving identity system where proof generation is a backend
concern, invisible to both owner and requester, with the blockchain serving only as
the verification and storage layer.

---

## Comparison Summary

| | Option A (Groth16+Circom) | Option B (Noir+Barretenberg) | Option C (SP1 zkVM) |
|---|---|---|---|
| User sees salt | Never | Never | Never |
| User sees wasm/zkey | Never | Never | Never |
| Trusted setup per circuit | Yes | No | No |
| Circuit language | Circom | Noir | Rust (no DSL) |
| File hosting needed | Yes (wasm+zkey per circuit) | No (one universal wasm) | No |
| Server required | No | No | Yes |
| Server sees raw data | No | No | Yes (trust assumption) |
| Proof size (gas cost) | Small | Small | Larger |
| Implementation risk | Low | Medium | High |
| Thesis novelty | Medium | High | High |
| Extend with new claims | Hard (new ceremony) | Easy | Easy |

---

## Recommendation for a Thesis

**Option B is the strongest choice** for a thesis that is specifically about ZKP design.

Reasons:
1. The universal trusted setup argument directly addresses a real limitation of your current
   Option-A-style architecture — this is a clear, defensible thesis contribution.
2. You stay fully decentralized — no server trust assumption like Option C.
3. Noir circuits are readable enough to include in a thesis chapter without losing the reader.
4. The UX abstraction (salt, commitment, circuit files — all hidden) is clean and complete.
5. You can frame Option A (current) as the baseline, Option B as your contribution,
   and Option C as a discussion of future trade-offs — a classic three-part thesis structure.

**If you want the lowest risk path to a working demo**, choose Option A.
**If you want the strongest academic argument with a working demo**, choose Option B.
**If your thesis is more about system architecture than ZKP theory**, consider Option C.
