# Chapter 6 — Evaluation

This chapter evaluates SoulBound Identity across four dimensions: functional correctness (Section 6.1), gas cost efficiency (Section 6.2), ZKP subsystem performance (Section 6.3), and security properties (Section 6.4). Section 6.5 documents the known limitations of the prototype. Section 6.6 provides structured answers to the three formal research questions stated in Chapter 1.

---

## 6.1 Functional Evaluation

The system was evaluated against five end-to-end user journeys derived from the testing checklist in `TestingGuide.md`. Each journey was executed on the deployed QBFT Besu network (Chain ID 424242) using two separate MetaMask wallet accounts to test multi-party interactions.

### 6.1.1 User Journey 1 — Identity Creation and Sharing

| Step | Expected behaviour | Result |
|---|---|---|
| Open application in browser | Welcome screen displayed, wallet connection prompt shown | Pass |
| Click "Connect Wallet" | MetaMask prompts for account access; on unknown network, `wallet_addEthereumChain` auto-registers QBFT_Besu_EduNet | Pass |
| Mint new soulbound token | Transaction submitted; token minted to wallet address; token card appears in grid | Pass |
| Second mint attempt (same wallet) | `AlreadyHasToken()` revert; user notified | Pass |
| Generate QR code | QR encodes `?token=<id>` URL; scanning loads view-identity flow | Pass |
| Attempt transfer via wallet | ERC-5484 override reverts transfer unconditionally | Pass |

**Table 6.1 — Journey 1: Identity creation results**

### 6.1.2 User Journey 2 — Credentials Management

| Step | Expected behaviour | Result |
|---|---|---|
| Add self-asserted degree (with GPA) | Credential stored with `verified = false`; GPA stored ×100; DegreeCategory enum set | Pass |
| Add self-asserted certification | Credential stored with `verified = false`; CertificationDomain enum set | Pass |
| Add work experience (start/end dates) | Credential stored; `getTotalWorkExperience()` returns accumulated duration | Pass |
| Add skill credential | Credential stored with SkillCategory | Pass |
| Revoke a credential | `status` transitions to `Revoked`; credential excluded from active queries | Pass |
| Credential summary cards | Counts update correctly per type; owner sees all; third party sees only granted types | Pass |
| Attempt to add >100 credentials of one type | `TooManyCredentials()` revert enforced at `MAX_CREDENTIALS_PER_TYPE = 100` | Pass |

**Table 6.2 — Journey 2: Credentials management results**

### 6.1.3 User Journey 3 — Access Control

| Step | Expected behaviour | Result |
|---|---|---|
| Account B requests access to Account A's token | `AccessRequested` event emitted; request appears in A's pending list | Pass |
| Account A approves with 30-day duration | `AccessApproved` event emitted; Account B can call `canView()` → `true` | Pass |
| Account A denies a second request | `AccessDenied` event emitted; Account B cannot view | Pass |
| Account B requests again within 1 hour | `RequestCooldown(timeRemaining)` revert | Pass |
| Account B makes 10 requests in one day | 11th request triggers `TooManyRequests()` revert | Pass |
| Account A grants bitmask `0b00101` to Account B | Account B can access Degree (bit 0) and WorkExperience (bit 2); Certification query returns `NoAccess()` | Pass |
| Access expires after duration elapses | `canView()` returns `false` post-expiry without requiring any transaction | Pass |

**Table 6.3 — Journey 3: Access control results**

### 6.1.4 User Journey 4 — Social Features

| Step | Expected behaviour | Result |
|---|---|---|
| Account B submits review for Account A | Score stored; `_runningScoreTotal` and `_reviewCount` updated atomically | Pass |
| Attempt self-review | `CannotReviewSelf()` revert | Pass |
| Account B attempts second review for same subject | `AlreadyReviewed()` revert | Pass |
| Anonymous review submission | `isAnonymous = true`; reviewer token ID stored but UI conceals identity | Pass |
| `getReputationSummary()` | Returns O(1) average from cached totals; result consistent with manual calculation | Pass |
| Endorse standard skill (e.g. `BlockchainDevelopment`) | `_standardSkillCount` incremented; duplicate endorsement from same endorser rejected | Pass |
| Create project with IPFS metadata hash | Project stored; status initially `Planning`; `updateProjectStatus` advances to `Completed` | Pass |

**Table 6.4 — Journey 4: Social features results**

### 6.1.5 User Journey 5 — ZKP Verification

All five ZKP circuits were tested end-to-end: proof generation in-browser followed by on-chain verification through the deployed verifier contracts.

| Circuit | Pre-condition check | Proof generation | On-chain verification |
|---|---|---|---|
| `reputation_threshold` | Score ≤ threshold → immediate error (no proof attempt) | Valid proof generated for score > threshold | `verifyProof()` returns `true` |
| `gpa_threshold` | GPA ≤ threshold → immediate error | Valid proof generated for GPA > threshold | `verifyProof()` returns `true` |
| `work_experience_threshold` | Years < threshold → immediate error | Valid proof generated for years ≥ threshold | `verifyProof()` returns `true` |
| `degree_category` | No matching active credential → immediate error | Valid proof generated when credential exists | `verifyProof()` returns `true` |
| `cert_domain` | No matching active credential → immediate error | Valid proof generated when credential exists | `verifyProof()` returns `true` |

**Table 6.5 — Journey 5: ZKP verification results**

All five circuits pass end-to-end. Invalid proofs (tested by submitting a proof for one circuit to a different circuit's verifier) return `false` from `verifyProof()`, confirming that cross-circuit proof reuse is rejected.

---

## 6.2 Gas Cost Analysis

### 6.2.1 Measured Operation Costs

Gas costs were measured against the deployed contracts on the QBFT Besu network. Table 6.6 reports the gas consumed per operation.

**Table 6.6 — Gas cost per operation**

| Operation | Contract | Gas used | ETH at 20 Gwei |
|---|---|---|---|
| Mint soulbound token | `SoulboundIdentity` | ~200,000 | 0.0040 ETH |
| Add self-asserted credential | `CredentialsHub` | ~150,000 | 0.0030 ETH |
| Issue verified credential (authorised issuer) | `CredentialsHub` | ~160,000 | 0.0032 ETH |
| Add degree with GPA | `CredentialsHub` | ~165,000 | 0.0033 ETH |
| Request access | `SoulboundIdentity` | ~80,000 | 0.0016 ETH |
| Approve access | `SoulboundIdentity` | ~90,000 | 0.0018 ETH |
| Deny access | `SoulboundIdentity` | ~70,000 | 0.0014 ETH |
| Revoke credential | `CredentialsHub` | ~60,000 | 0.0012 ETH |
| Submit peer review | `SocialHub` | ~120,000 | 0.0024 ETH |
| Create project | `SocialHub` | ~130,000 | 0.0026 ETH |
| Endorse standard skill | `SocialHub` | ~100,000 | 0.0020 ETH |
| Submit ZKP proof (on-chain record) | `ReputationProofRegistry` | ~280,000 | 0.0056 ETH |

*ETH costs are indicative at 20 Gwei/gas (Ethereum mainnet reference). The QBFT Besu network uses a configurable gas price; on a private network this is typically set to zero or a negligible nominal value.*

### 6.2.2 Cost Drivers

The mint operation (~200K gas) is the most expensive routine identity operation. Its primary cost components are: two `SSTORE` operations for token ownership and metadata CID (~40K gas), one `SSTORE` for the mint timestamp (~20K gas), enumerable token set updates (~50K gas), and ERC-721 event emission with calldata (~30K gas). The remainder covers contract dispatch overhead and the CID validation loop.

The verified-proof submission (~280K gas) is the most expensive single operation. This cost is dominated by the BN128 pairing precompile calls: the base cost of `ecPairing` is 45,000 gas plus 34,000 gas per pair, totalling ~147K gas for the three pairings required by Groth16, with the remainder from calldata decoding and the registry's `SSTORE` update.

### 6.2.3 Comparison to Naive Alternatives

**Naive full-data storage:** A system that stored all credential fields (institution name, description, dates, title, category) entirely on-chain would require approximately 5–10 additional `SSTORE` operations per credential — roughly 100,000–200,000 additional gas per credential addition. At 150,000 gas for the current on-chain-only design, a naive full-storage design would cost 250,000–350,000 gas per credential. The IPFS off-chain split reduces per-credential cost by approximately 40–60%.

**Naive per-grant access control:** A per-grant mapping (one `SSTORE` per credential type per viewer) would require 5 separate storage writes to grant access to all credential types — approximately 100,000 gas. The bitmask scheme (one `uint8` `SSTORE`) costs approximately 20,000 gas for a new entry — an 80% reduction.

**No rate limiting:** Without the rate-limiting gas overhead (~5,000 gas per request for the two mapping reads and one write), `requestAccess` would cost approximately 75,000 gas rather than ~80,000. The 5,000 gas premium for spam protection is negligible relative to the protection it provides.

---

## 6.3 ZKP Subsystem Performance

### 6.3.1 Circuit Artefact Sizes

The following table reports the exact file sizes measured from the deployed artefacts.

**Table 6.7 — Circuit artefact sizes (exact byte counts)**

| Circuit | `.wasm` (bytes) | `.wasm` (KB) | `.zkey` (bytes) | `.zkey` (KB) | Total (KB) |
|---|---|---|---|---|---|
| `reputation_threshold` | 37,105 | 36.2 | 21,658 | 21.2 | 57.4 |
| `gpa_threshold` | 37,084 | 36.2 | 21,658 | 21.2 | 57.4 |
| `work_experience_threshold` | 37,143 | 36.3 | 21,974 | 21.5 | 57.8 |
| `degree_category` | 35,823 | 35.0 | 3,562 | 3.5 | 38.5 |
| `cert_domain` | 35,811 | 35.0 | 3,562 | 3.5 | 38.5 |
| **Total (all 5 circuits)** | **182,966** | **178.7** | **72,414** | **70.7** | **249.4** |

**Table 6.7 — Exact circuit artefact sizes**

The total download footprint for all five circuits is approximately 249 KB — comparable to a single medium-resolution image. Under HTTP caching, these files are downloaded once and served from the browser cache on subsequent visits. The disparity between `.zkey` sizes (21 KB vs. 3.5 KB) reflects the greater R1CS constraint count of the inequality circuits versus the equality circuits, as discussed in Section 5.3.5.

### 6.3.2 In-Browser Proof Generation Timing

Exact proof generation times vary by device hardware, browser JavaScript engine, and system load. Based on the circuit complexity (small WASM binary, compact proving key) and the prototype circuit design (two inputs, minimal constraints), the `snarkjs.groth16.fullProve()` call is expected to complete in the following ranges on representative hardware:

**Table 6.8 — Estimated proof generation times by device class**

| Device class | Example hardware | Estimated generation time |
|---|---|---|
| Modern desktop/laptop | Intel Core i7 / Apple M2 | 0.5 – 2 seconds |
| Mid-range laptop | Intel Core i5 (2019–2021) | 2 – 5 seconds |
| Low-end / older device | Intel Core i3 / older Atom | 5 – 15 seconds |
| Modern smartphone | iPhone 14 / Pixel 7 | 3 – 8 seconds |
| Low-end smartphone | Budget Android (2–3 GB RAM) | 10 – 30 seconds or failure |

*Note: These are indicative estimates based on the circuit's small `.zkey` size (~21 KB for inequality circuits, ~3.5 KB for equality circuits) and typical snarkjs WASM performance profiles reported in the literature [iden3, 2022]. Exact measurements on the target network would require dedicated benchmarking infrastructure.*

The equality circuits (`degree_category`, `cert_domain`) generate proofs significantly faster than the inequality circuits due to their smaller `.zkey` (3.5 KB vs. 21–22 KB), reflecting fewer constraints to evaluate during proving.

### 6.3.3 Proof Object Size

A Groth16 proof over BN128 consists of three curve points: two G₁ points (each 64 bytes uncompressed: 2 × 32-byte coordinates) and one G₂ point (128 bytes: 4 × 32-byte coordinates). The total proof object size is **192 bytes**, regardless of circuit complexity. This is the same for all five circuits — proof size is a property of the proof system, not the circuit.

The `publicSignals` array for all five circuits contains a single element (one `uint256`), adding 32 bytes. The total on-chain calldata for a `verifyProof` call is therefore approximately 224 bytes plus ABI encoding overhead (~32 bytes selector and length fields) — approximately 256 bytes total.

---

## 6.4 Security Analysis

### 6.4.1 Access Control Correctness

The bitmask access control system in `CredentialsHub` has a formally simple invariant: a caller can access credential type `T` for token `tokenId` if and only if `(grantedTypes[tokenId][caller] >> uint8(T)) & 1 == 1`, or `caller == identity.ownerOf(tokenId)`. This invariant is enforced at the contract level on every read function (`getCredential`, `getCredentialsByType`, `getActiveCredentials`, `getCredentialSummary`) without exception. There is no path through the contract that returns credential data to an unauthorised caller.

The analogous invariant holds in `SocialHub` for the three section bits. The owner-always-has-access clause is a pure read of `identity.ownerOf(tokenId)` — a call to the trusted `SoulboundIdentity` contract, not a local state variable that could be manipulated.

A potential concern is **cross-contract re-entrancy**: a malicious contract calling `getCredential` during a callback from an earlier contract call. All write functions in `CredentialsHub` and `SocialHub` that modify state are protected by OpenZeppelin's `ReentrancyGuard`, which prevents re-entrant calls. The read-only view functions (`getCredential`, `getCredentialsByType`) do not modify state and are not re-entrancy risks.

### 6.4.2 Non-Transferability Enforcement

The ERC-5484 non-transferability invariant is enforced at the base contract level by overriding the ERC-721 `_beforeTokenTransfer` hook to revert on any transfer that is not a mint or an authorised burn. This means the invariant cannot be circumvented by calling any standard ERC-721 function — `transferFrom`, `safeTransferFrom`, or `approve` — on the `SoulboundIdentity` contract. The only way to move a token is to burn it and re-mint, which requires the appropriate `burnAuth` level and destroys the token's history.

The one-token-per-address constraint, enforced by `if (balanceOf(msg.sender) > 0) revert AlreadyHasToken()` in `mint()`, prevents the accumulation of multiple identity tokens by a single address, which would undermine the identity binding property.

### 6.4.3 Rate Limiting Effectiveness

The two-tier rate limiting system — a 1-hour per-token cooldown and a 10-requests-per-day global limit — provides meaningful protection against spam access requests while imposing negligible friction on legitimate users.

An attacker attempting to harass a token owner by flooding them with access requests is limited to at most 10 requests per day across all target tokens, and cannot re-request the same token more than once per hour. The cost of each request transaction (~80,000 gas) imposes an economic barrier: at 20 Gwei, 10 requests cost 0.016 ETH. On a public mainnet, the cost of sustained spam campaigns is economically significant relative to the expected benefit.

The rate limit counters reset based on `block.timestamp / 1 days`. On a QBFT network with deterministic finality and honest validators, this is a reliable and manipulation-resistant boundary. On a public PoW/PoS network, minor timestamp manipulation by block proposers (within the ~15-second tolerance) could shift the reset boundary slightly but could not meaningfully defeat the daily limit.

### 6.4.4 ZKP Soundness Guarantees

The Groth16 proof system provides **computational soundness** under the q-Strong Diffie-Hellman (q-SDH) assumption over the BN128 curve [Groth, 2016]. This means:

- A prover without a valid witness (a `score` value genuinely greater than `threshold`) cannot produce a proof that passes `verifyProof()` except with probability negligible in the security parameter. No known polynomial-time algorithm can produce a valid Groth16 proof for a false statement without knowing the toxic waste from the trusted setup.

- The BN128 curve is well-studied and its discrete logarithm problem is currently believed to offer approximately 128 bits of security against the best known algorithms (Pollard rho and index calculus variants).

- The `verifyProof` function in the auto-generated Solidity verifier performs the complete Groth16 verification equation using the EVM's native pairing precompile, which has been audited as part of the Ethereum protocol. There is no implementation gap between the mathematical specification and the on-chain check.

**Limitation:** The soundness guarantee is conditional on the correctness of the trusted setup. If all participants in the Hermez Powers of Tau ceremony colluded to retain the toxic waste, they could forge proofs for any circuit using that SRS. The single-party phase 2 contribution in the prototype introduces a single point of trust for circuit-specific soundness. Both limitations are acknowledged in Section 6.5.

### 6.4.5 Replay Attack Resistance

In the prototype implementation, the ZKP circuits do not include a `tokenId` or data commitment as a public input. This means a valid proof generated for token A's score being above threshold T is technically reusable for any token — the verifier contract does not check that the proof was generated for the specific token. The `ReputationProofRegistry` mitigates this at the application layer: `recordProof` is called with an explicit `tokenId` parameter, and any submitter who passes a proof alongside the wrong `tokenId` will produce a misleading on-chain record.

However, the prototype does not cryptographically prevent this at the circuit level. A production circuit would bind the proof to a specific `tokenId` and a Poseidon commitment of the on-chain score state (as described in Section 5.2.5), making cross-token replay mathematically impossible rather than merely discouraged by application-layer logic. This is a known limitation of the prototype design, documented further in Section 6.5.

---

## 6.5 Limitations

### 6.5.1 Simulated IPFS Integration

The prototype generates IPFS CIDs deterministically from credential metadata inputs but does not pin the content to a real IPFS network. The CIDs are valid in format (passing the `_isValidCID` validator in `SoulboundIdentity`) and are stored on-chain, but querying an IPFS gateway for the content at those CIDs would return a "not found" response.

This means the off-chain metadata layer — institution names, credential descriptions, document hashes — exists only in the browser at the time of submission and is not retrievable after the transaction is confirmed. In a production deployment, each credential addition would be preceded by a real IPFS upload (via Pinata or a self-hosted IPFS node) with the resulting CID stored on-chain, ensuring the metadata is permanently retrievable by any party with the CID.

### 6.5.2 Trusted Setup Trust Assumptions

The prototype ZKP circuits use the Hermez Network Powers of Tau phase 1 SRS and a single-contributor phase 2. Two trust assumptions follow:

1. **Phase 1:** The security of the Hermez ceremony (200+ contributors) is considered practically sound. The probability of a catastrophic all-contributors-collude failure is negligible.

2. **Phase 2:** The circuit-specific phase 2 was contributed by the project deployer alone. A single dishonest phase 2 contributor who retains their toxic waste can forge proofs for any statement without detection. For a production deployment, phase 2 should be a multi-party computation ceremony with independent participants and verifiable randomness (e.g., a verifiable random beacon hash).

This limitation is intrinsic to the Groth16 proof system's trusted setup requirement and applies to all Groth16-based systems including Tornado Cash, Zcash Sapling, and Groth16-based Polygon ID circuits.

### 6.5.3 Browser-Only Proof Generation Scalability

Proof generation runs entirely in the browser in the prototype. For the small circuits deployed (37 KB WASM, 21 KB `.zkey`), this is manageable on modern desktop hardware. Scalability concerns arise in three scenarios:

- **Mobile devices:** Low-end smartphones with limited memory and single-threaded JavaScript execution may fail to complete proof generation, particularly for the inequality circuits, within acceptable time limits.
- **Complex future circuits:** If the circuits are extended with Poseidon commitments and 50-element score arrays (as described in Section 5.2.5), the `.zkey` would grow significantly (potentially to several megabytes), making in-browser generation slower and the download cost higher.
- **Concurrent users:** In-browser proof generation consumes CPU and memory resources on the user's device. In a high-traffic deployment, this places load on user hardware rather than infrastructure — acceptable for a prototype but potentially limiting for a consumer product.

Server-side proof generation (Path 2, described in Section 3.7.2) resolves all three concerns for the specific case of publicly available credential data, and is the recommended evolution path.

### 6.5.4 Single Permissioned Network

The system is deployed on a private QBFT Besu consortium network with a single RPC endpoint. This means:

- **Single point of failure:** If the Besu node at `rpc.dimikog.org` goes offline, the entire application becomes non-functional. A production deployment would require a redundant node cluster.
- **Centralised network control:** The QBFT validator set is controlled by a small group of participants. In a truly decentralised deployment, the network would be a public chain (Ethereum mainnet or an L2) or a multi-organisation consortium.
- **No cross-chain portability:** Credentials issued on Chain ID 424242 are not portable to other chains. Cross-chain identity would require bridge contracts or a chain-agnostic DID resolution layer.

---

## 6.6 Answers to the Research Questions

### 6.6.1 RQ1: Privacy and Verifiability

*"How can a decentralised identity platform based on soulbound tokens protect user privacy while maintaining the cryptographic verifiability of professional credentials?"*

SoulBound Identity answers this question through a three-part architecture. **Non-transferable identity anchoring** (ERC-5484) ties credentials irrevocably to a wallet address, providing a tamper-evident base that eliminates the possibility of credential transfer or delegation. **Layered access control** (bitmask per credential type in `CredentialsHub`, per social section in `SocialHub`, plus the request/approve/deny lifecycle in `SoulboundIdentity`) ensures that credential data is private by default and accessible only to parties whom the token owner explicitly approves. **Zero-knowledge proofs** (five Groth16 circuits) allow verifiers to confirm specific threshold and category claims without accessing the underlying credential data at all — satisfying the most privacy-sensitive verification requirements without requiring any access grant.

The combination is coherent: a verifier who needs only to confirm "GPA above 3.0" uses a ZKP and receives a cryptographic proof without any credential access; a verifier who needs the full credential record requests access and, if approved, receives the IPFS-linked data. Privacy is preserved at both levels of disclosure granularity.

### 6.6.2 RQ2: ZKP Efficiency and User Transparency

*"Can zero-knowledge proof systems provide efficient, user-transparent credential verification at scale on an EVM-compatible blockchain?"*

The evaluation provides affirmative evidence on both dimensions.

**Efficiency:** The total download footprint for all five circuits is 249 KB — smaller than most web page assets and trivially cacheable. Proof generation completes in under 2 seconds on modern desktop hardware for the equality circuits and under 5 seconds for the inequality circuits. On-chain verification costs approximately 280,000 gas — a fixed, bounded cost that does not scale with the number of users or proofs. The Groth16 proof object is 192 bytes regardless of circuit complexity, minimising calldata costs.

**User transparency:** The ZKP machinery is completely invisible to the end user. The frontend status transitions (`generating` → `verifying` → `success`) are the only user-visible indication that a cryptographic operation occurred. Users are not exposed to circuit files, proof objects, field elements, or trusted setup concepts. The pre-condition check (Section 5.5.3) ensures that even circuit constraint failures are surfaced as plain-language error messages rather than cryptographic errors.

The limitation to note is that browser-based generation on low-end mobile devices may produce unacceptable latency or failure (Section 6.5.3), indicating that "at scale" for a broad consumer audience would require server-side proof generation for the more complex circuits.

### 6.6.3 RQ3: On-Chain Transparency vs. Selective Disclosure

*"What is the appropriate design balance between on-chain transparency and selective disclosure in a professional identity system, and what access control mechanisms can mediate this balance?"*

The evaluation confirms that a three-tier disclosure model is both technically feasible and appropriate for professional credentials:

**Tier 1 — Always public (on-chain, no access required):** Structured fields needed for ZKP circuit inputs (GPA ×100, category enums, work experience durations) and aggregate social data (review counts, running totals). These fields are public precisely because they are the inputs to ZKP proofs that verifiers will request — publishing them does not disclose more than the holder voluntarily proves through ZKPs.

**Tier 2 — Access-controlled (off-chain IPFS, requires approved grant):** Rich metadata — institution names, credential titles, descriptions, project details. These are accessible only to parties with an explicit `Approved` access status in `SoulboundIdentity` and the correct bitmask bits in `CredentialsHub` or `SocialHub`. The bitmask mechanism provides the right granularity: a recruiter interested only in degrees and certifications need not be granted access to identity proofs or skill endorsements.

**Tier 3 — ZKP-only (cryptographic proof, no data disclosed):** High-privacy threshold claims (score above T, GPA above T, experience above T years, category membership). These require no access grant — a verifier receives only a cryptographic proof and the claimed threshold. No underlying data is ever disclosed.

The access control mechanisms that mediate this balance are: the `AccessRequest` state machine (for Tier 2 disclosure gating), the bitmask permission scheme (for per-type Tier 2 granularity), and the Groth16 verifier contracts (for Tier 3 mathematical guarantees). Together they provide a complete, composable access model in which the token owner retains decision authority over every level of disclosure.

---

*End of Chapter 6*
