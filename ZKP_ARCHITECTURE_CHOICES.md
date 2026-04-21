# ZKP Architecture Choices for SoulboundIdentity

---

## Decided Implementation Scope (Locked)

**Circuit count:** 1 circuit only.

**Use case:** Prove that a user's reputation score is above a given threshold, without revealing the actual score.

**Form:** Simplified proof-of-concept — not a full production system.

### What will be built:
- A single Circom circuit: `reputation_threshold.circom`
- A Groth16 verifier contract generated from the circuit (`ReputationVerifier.sol`)
- In-browser proof generation via snarkjs (Path 1 — no VM required)
- A small fixed dataset of reputation scores for testing
- End-to-end flow: user taps → proof generated → submitted on-chain → verified

### What will NOT be built (but stays in the thesis as design/architecture):
- Circuits for credential ownership, selective disclosure, or multi-attribute proofs
- Full SocialHub logic inside a circuit
- Server-side proof generation (VM backend / Path 2)
- Batch proofs or recursive proofs
- Production-grade trusted setup

### Goal:
Demonstrate that the system works end-to-end:
1. A proof is generated
2. The proof is verified (on-chain or locally)
3. The flow is wired to the frontend

All other ZKP use-cases described below remain as **future extensions** in the thesis.

---

## The Requirement

Zero knowledge proofs must be completely invisible to the user.
- User sees only a plain-language question (e.g. "Share that your reputation score is above 7?")
- User picks yes or no
- Proof is generated and sent to the requester instantly
- No files, no steps, no technical language exposed

This is **Option B**: fully abstracted, single-click ZKP flow.

---

## What Actually Happens in a ZKP (Plain English)

A ZKP lets you prove a statement is true without revealing the underlying data.

| Term | What it means | Goes on-chain? |
|---|---|---|
| Private input (witness) | The raw data being proven (e.g. actual score = 8.5) | No |
| Public statement | What you're proving (e.g. "score is above 7") | Yes |
| Proof | Cryptographic blob confirming the statement | Yes |
| Commitment | A hash of the private input stored earlier | Yes |

The proof and public statement are always public on-chain. Only the raw private input is ever "secret".

---

## Key Insight for This App

SoulboundIdentity stores credentials, endorsements, and reputation data **on-chain openly**. This means the underlying data being proven is already publicly visible. The ZKP is doing trustless computation and convenient verification — not hiding anything that isn't already on-chain.

This changes the privacy calculus entirely. A server seeing your on-chain data before generating a proof exposes nothing extra.

The privacy argument for in-browser-only generation only holds when proving something about genuinely off-chain secret data (e.g. a private salary, a hidden score behind a cryptographic commitment). That is not this app's use case.

---

## Option B: Two Implementation Paths

### Path 1 — In-Browser ZKP (No VM)

All proof generation runs in the user's browser using snarkjs.

**How it works:**
1. `.wasm` and `.zkey` circuit files are served as static assets from the app
2. On user confirmation, snarkjs loads the circuit files in-browser
3. Proof is generated client-side (browser CPU/memory)
4. Frontend submits proof directly to the smart contract

**Pros:**
- No backend server required — fully static app
- Theoretically strongest privacy (raw inputs never leave device)
- No server infrastructure to maintain

**Cons:**
- `.wasm` + `.zkey` files are large (typically 1–10 MB per circuit)
- These files must be downloaded on first use — noticeable loading time
- Browser is single-threaded; proof generation is slow (2–10 seconds depending on circuit complexity)
- Files must be versioned and redeployed with the app on circuit changes
- Memory constraints on low-end mobile devices can cause failures
- User experience: unavoidable spinner on first proof generation

**Verdict:** Works, but has real UX friction on first use and couples circuit files to frontend deployments.

---

### Path 2 — VM Backend ZKP (Server-Side Generation)

Proof generation runs on a server. Frontend sends inputs, receives proof back, submits on-chain.

**How it works:**
1. User confirms the disclosure question in the UI
2. Frontend sends the relevant on-chain data (already public) to the VM via API call
3. VM runs snarkjs in Node.js, generates the Groth16 proof
4. VM returns the proof + public signals to the frontend
5. Frontend submits proof to the smart contract

**Pros:**
- No large files downloaded to the browser — instant UI, no spinner
- Proof generation is fast (server CPU, no browser constraints)
- Circuit files live on the server — updates don't require frontend redeployment
- Works reliably on all devices including low-end mobile
- Cleaner frontend code — no snarkjs dependency in the browser bundle
- API endpoint can be reused across multiple proof types

**Cons:**
- Requires a running server (VM, VPS, or serverless function)
- One additional network round-trip (frontend → VM → frontend → chain)
- Server becomes a dependency — if it's down, proofs can't be generated
- Slightly more infrastructure to set up and maintain

**Privacy note:** Since all data being proven is already on-chain, the VM sees nothing that isn't already publicly visible. There is no meaningful privacy tradeoff for this app.

**Verdict:** Better UX, better performance, easier to maintain. The right choice if you have or plan to have a VM.

---

## Side-by-Side Comparison

| Factor | In-Browser | VM Backend |
|---|---|---|
| User experience | Spinner on first use | Instant |
| Proof speed | 2–10 seconds (browser) | < 1 second (server) |
| Mobile reliability | Inconsistent | Consistent |
| File downloads | 1–10 MB per circuit | None |
| Frontend complexity | High (snarkjs in bundle) | Low (API call only) |
| Backend required | No | Yes |
| Circuit updates | Requires frontend redeploy | Server-only update |
| Privacy (this app) | Same — data already on-chain | Same — data already on-chain |
| Infrastructure cost | Free (static hosting) | VM/server cost |

---

## Recommendation

**If you have a VM: use Path 2 (VM backend).**

The user experience is strictly better — no loading, no large downloads, works on all devices. Since your credentials and reputation data are already on-chain, there is no privacy disadvantage. The VM simply does the computation faster and more reliably than the browser.

**If you do not have a VM: use Path 1 (in-browser).**

It works. The UX hit is a one-time loading spinner, and circuit files can be cached after first load. This is the fallback if you want to keep the app fully static with no backend.

---

## What the User Flow Looks Like Either Way

Regardless of which path is chosen, the user experience is identical:

1. Requester scans QR code or sends access request
2. User sees: *"Employer XYZ wants to verify your reputation score is above 7. Share this?"*
3. User taps **Yes**
4. *(Proof is generated invisibly — in browser or on server)*
5. Proof appears on-chain. Requester is notified.

The user never sees a file, a circuit, a proof object, or any technical step.
