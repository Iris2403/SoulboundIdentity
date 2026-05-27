# Chapter 7 — Conclusion and Future Work

This chapter closes the thesis. Section 7.1 summarises the contributions of the work. Section 7.2 presents the key findings derived from the implementation and evaluation. Section 7.3 revisits the limitations acknowledged in Chapter 6 with a view to production readiness. Section 7.4 proposes concrete directions for future development.

---

## 7.1 Summary of Contributions

This thesis set out to address a clearly defined research gap: no existing system combines soulbound non-transferable identity tokens, zero-knowledge proof selective disclosure, and granular per-credential-type access control in a single unified platform. SoulBound Identity fills that gap as a working proof-of-concept deployed on a permissioned EVM-compatible blockchain.

The primary contributions are:

**1. A fully deployed prototype.** SoulBound Identity is not a theoretical proposal. Four Solidity smart contracts — `SoulboundIdentity`, `CredentialsHub`, `SocialHub`, and `ReputationProofRegistry` — are deployed and operational on a QBFT Hyperledger Besu network (Chain ID 424242). A React 18 single-page application provides a complete user interface covering identity creation, credential management, access control, social reputation, and ZKP-based verification. All end-to-end user journeys were executed and verified as part of the evaluation in Chapter 6.

**2. A five-circuit ZKP subsystem.** Five Circom 2 arithmetic circuits — `reputation_threshold`, `gpa_threshold`, `work_experience_threshold`, `degree_category`, and `cert_domain` — are compiled, have undergone trusted setup, and have corresponding Groth16 verifier contracts deployed on-chain. All five circuits were verified end-to-end: proofs generated in-browser, submitted to on-chain verifiers, and confirmed valid. The total circuit artefact footprint is 249 KB across all five circuits combined, demonstrating that practical ZKP verification is achievable with a fraction of the resource overhead of prior assumptions.

**3. A bitmask access control architecture.** The `CredentialsHub` and `SocialHub` contracts implement a `uint8` bitmask scheme that encodes per-credential-type and per-social-section access grants in a single storage slot. This design achieves O(1) permission reads, reduces grant-update gas cost by approximately 80% compared to a per-grant mapping, and supports batch access operations that further amortise transaction costs. The access request state machine in `SoulboundIdentity` — with rate limiting, per-token cooldown, time-bounded approvals, and batch approve/deny — provides a complete access governance lifecycle.

**4. A user-transparent ZKP interface.** The frontend demonstrates that ZKP generation can be made entirely invisible to end users. The proof generation flow transitions through three status states (`generating`, `verifying`, `success`) behind a plain-language prompt; users are never exposed to circuit files, field elements, or proof objects. Pre-condition checks prevent failed proof attempts from being initiated, ensuring that the only user-visible failure mode is a clear, actionable message ("Score is NOT above threshold").

**5. An empirical gas cost baseline.** The evaluation in Chapter 6 provides a measured cost table for all major operations on an EVM-compatible chain, including the previously underspecified cost of Groth16 on-chain verification (~280,000 gas). This baseline serves as a reference for future system designers evaluating the economic viability of ZKP-based credential verification on EVM chains.

---

## 7.2 Key Findings

Three findings emerge from the implementation and evaluation that have broader implications beyond this specific system.

**Finding 1: ZKPs can be made invisible to end users at practical circuit scales.**

The concern that ZKP systems impose unacceptable UX complexity on non-technical users is not inherent — it is a consequence of poor abstraction. At the circuit scales demonstrated in this thesis (37 KB WASM, 21 KB proving key for inequality circuits; 35 KB WASM, 3.5 KB proving key for equality circuits), in-browser proof generation is fast enough that users experience only a brief loading state on modern hardware, indistinguishable from any other asynchronous operation. The critical design principle is to abstract every ZKP concept behind the single question the user actually cares about: "Do you want to share that your score is above 70?" Nothing else needs to be communicated.

**Finding 2: Groth16 on-chain verification is economically viable on EVM for high-value attestations.**

The ~280,000 gas cost of `verifyProof` is substantial relative to a simple token transfer (~21,000 gas) but modest relative to the value of the attestation it provides. A single verified reputation proof replaces an entire background check process that, in the traditional hiring market, costs between $30 and $300 per candidate and takes days to weeks to complete. At 20 Gwei and an ETH price of $3,000, a verified on-chain ZKP attestation costs approximately $0.017 — three to four orders of magnitude cheaper than its institutional equivalent. The EVM precompile support for BN128 (EIP-196 and EIP-197) is the technical enabler; without native pairing support, Groth16 verification would be economically impractical.

**Finding 3: The IPFS off-chain split is the right abstraction boundary for credential storage.**

Attempting to store rich credential metadata entirely on-chain is economically impractical: each additional 32-byte storage slot costs 20,000 gas, making even modest metadata (institution name, credential title, description) prohibitively expensive. Storing everything off-chain loses the tamper-evidence property. The correct boundary is to store on-chain exactly the fields that serve a cryptographic purpose — the structured inputs to ZKP circuits (GPA, category enum, duration) and the access-gated IPFS commitment hash — and to store everything else off-chain. This design is composable: the on-chain fields support ZKP proofs; the IPFS data supports full-disclosure access grants; and the two levels of disclosure are independently controlled by the token owner.

---

## 7.3 Limitations Revisited

Chapter 6 documented the prototype's limitations. Viewed through the lens of production readiness, they fall into three categories.

**Engineering limitations (addressable without research):** The mock IPFS integration (Section 6.5.1) and the single-node network deployment (Section 6.5.4) are straightforward to resolve: real IPFS pinning requires a Pinata API integration, and network resilience requires a multi-node Besu cluster or migration to a public L2. These are deployment engineering tasks, not research problems.

**Design limitations (addressable with additional implementation):** The absence of `tokenId` and data commitment binding in the prototype circuits (Section 6.4.5) means ZKP soundness is application-layer rather than circuit-layer. Addressing this requires extending the circuits with Poseidon commitments and `tokenId` public inputs — additional circuit constraints that would increase `.zkey` size but remain within practical bounds for browser-side generation.

**Architectural limitations (requiring design decisions):** Browser-only proof generation (Section 6.5.3) is a deliberate prototype choice that trades infrastructure simplicity for scalability. The single-party phase 2 trusted setup (Section 6.5.2) is a prototype expedient that trades ceremony overhead for time. Both require an architectural decision — server-side proof generation infrastructure, and a multi-party phase 2 ceremony — rather than code changes alone.

None of these limitations invalidates the core thesis findings. They define a clear implementation roadmap from prototype to production.

---

## 7.4 Future Work

### 7.4.1 Server-Side Proof Generation (Path 2)

The most impactful near-term improvement is migrating proof generation from the browser to a server-side Node.js process, as described in Section 3.7.2. Since all credential data used as ZKP circuit inputs is publicly available on-chain, server-side generation has no privacy cost: the server reads the same on-chain data that the browser reads, generates the proof using snarkjs in a native Node.js environment, and returns the proof to the frontend for on-chain submission.

The benefits are substantial: proof generation times would decrease from seconds to sub-second; the `.wasm` and `.zkey` files would be cached on the server and never downloaded by users; proof generation would work reliably on all mobile devices; and circuit updates would require only a server-side deployment rather than a frontend release. The API surface is minimal: a single `POST /prove` endpoint accepting the circuit name and public inputs, returning the proof object and public signals.

### 7.4.2 Production-Grade ZKP Circuits

The prototype circuits are minimal proof-of-concept implementations. A production ZKP subsystem would extend each circuit with:

- **Poseidon commitments** binding the proof to a specific snapshot of on-chain data, preventing proof replay across different data states.
- **TokenId binding** as a public input, preventing cross-token proof reuse.
- **Range checks** (via bit decomposition) on numeric inputs, ensuring private inputs are within the valid domain.
- **Merkle proof membership** for the equality circuits, replacing the simple `category == claimedCategory` check with a proof that the credential's category is committed in a Merkle tree whose root is stored on-chain — enabling revocation without requiring a new proof.

These extensions would increase circuit constraint counts significantly, likely requiring `.zkey` files of several megabytes. Combined with the server-side generation path (Section 7.4.1), this increased complexity remains transparent to end users.

### 7.4.3 Multi-Party Trusted Setup Ceremony

The single-contributor phase 2 trusted setup is the weakest security assumption in the current system. A production deployment should conduct a publicly verifiable multi-party computation (MPC) phase 2 ceremony for each circuit, using a verifiable random beacon (such as a Ethereum block hash at a committed future block number) as the final contribution. The snarkjs toolchain supports this via `snarkjs zkey beacon`. With even a small number of independent contributors (three to five), the probability of a colluding majority producing a compromised proving key becomes negligible.

### 7.4.4 Real IPFS Integration

Replacing the mock IPFS CID generation with real content-addressed storage requires integrating a pinning service API (e.g., Pinata, web3.storage, or Filebase). Each credential addition would be preceded by a `POST` to the pinning API with the metadata JSON; the returned CID would then be used as the on-chain commitment. This ensures that off-chain metadata remains retrievable by authorised parties indefinitely, regardless of the state of any single storage provider — a critical property for long-lived professional credentials.

A further enhancement would be **encrypted IPFS storage**: encrypting the credential metadata with a key held by the token owner before pinning, and sharing the decryption key (not the IPFS CID alone) with approved requesters. This would add a second layer of privacy protection — even a party who discovers the CID through on-chain observation would be unable to read the metadata without the decryption key.

### 7.4.5 Cross-Chain Identity Portability

The current deployment is tied to a single consortium network. Professional identity is inherently cross-organisational and cross-jurisdictional; a credentialing system that cannot cross chain boundaries has limited real-world applicability. Two paths towards portability exist.

The first is **DID-based resolution**: anchoring the SoulBound Identity token as a DID document (e.g., `did:ethr:0x424242:<tokenId>`) and publishing it to a universal DID registry. Any resolver supporting the `did:ethr` method could then resolve the identity independently of the specific Besu network.

The second is **cross-chain bridge integration**: deploying bridge contracts that lock an SBT on the source chain and mint a read-only shadow on a destination chain. Credential ZKP proofs generated on the source chain could be verified on any chain that supports BN128 pairing precompiles — which includes Ethereum mainnet and most major EVM-compatible L2s (Polygon, Arbitrum, Optimism, Base).

### 7.4.6 Towards ERC-5484 Extensions

The ERC-5484 standard as currently defined specifies non-transferability and burn authorisation but leaves credential semantics, access control, and ZKP integration entirely to implementors. SoulBound Identity demonstrates one concrete realisation of the design space that the standard opens. The patterns developed here — bitmask credential type access, time-bounded access grants, ZKP threshold proofs as a selective disclosure layer — could inform a proposed ERC extension that standardises these patterns at the interface level, enabling interoperability between different SBT-based identity systems.

Contributing such an extension to the Ethereum Improvement Proposal process would be a meaningful academic-to-standard pipeline outcome of this research.

---

## 7.5 Closing Remarks

SoulBound Identity demonstrates that the privacy paradox of blockchain-based identity — the tension between the tamper-evidence of on-chain storage and the sensitivity of credential data — is not a fundamental obstacle. It is an engineering problem with a principled solution: store on-chain what is cryptographically necessary, protect what is sensitive with access-controlled off-chain storage, and allow verifiers to confirm specific claims through zero-knowledge proofs that reveal nothing beyond the claim itself.

The system shows that this solution is practical today: the gas costs are bounded and economically viable; the ZKP toolchain is mature enough for browser-side deployment; the smart contract patterns are composable and auditable. The gap between the prototype described in this thesis and a production-ready system is a roadmap of solvable engineering problems, not a wall of fundamental research challenges.

The research questions posed in Chapter 1 have been answered affirmatively. Privacy and verifiability are not in conflict; they are complementary properties achievable within a single coherent architecture. The appropriate balance between on-chain transparency and selective disclosure is not a fixed point but a three-tier design space — always public, access-controlled, and ZKP-only — that the token owner navigates according to the sensitivity of each disclosure. And the ZKPs required to implement this balance are, at the scales relevant to professional credential verification, efficient enough to be invisible.

---

*End of Chapter 7*
