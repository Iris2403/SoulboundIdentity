# Chapter 3 — System Architecture and Design

This chapter presents the architecture and design of SoulBound Identity. Unlike Chapter 4, which describes the implementation, this chapter is concerned entirely with *why* the system is structured as it is: the threat model that shaped the design, the responsibilities and boundaries of each component, the data models and access control schemes, and the key trade-offs that were explicitly decided during the design process. No implementation code appears in this chapter; architecture diagrams and design rationale are the primary vehicles of explanation.

---

## 3.1 Architecture Overview

SoulBound Identity is structured as a three-layer system: a **Blockchain Layer** that provides tamper-evident storage, smart-contract logic, and on-chain ZKP verification; a **ZKP Layer** that handles circuit proving and the generation of cryptographic attestations; and an **Application Layer** that provides the user interface and mediates all interactions between the user and the two lower layers.

```
┌─────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                   │
│                                                     │
│   React 18 SPA  •  ethers.js v5.7.2  •  MetaMask    │
│   Identity Tab  •  Credentials Tab  •  Social Tab   │
│   Access Control Tab  •  ZKP proof UI                │
└──────────────────────────┬──────────────────────────┘
                           │  JSON-RPC / snarkjs
           ┌───────────────┴──────────────┐
           │                              │
           ▼                              ▼
┌──────────────────────┐    ┌─────────────────────────┐
│    BLOCKCHAIN LAYER  │    │        ZKP LAYER         │
│                      │    │                          │
│  SoulboundIdentity   │    │  Circom 2 circuits (.wasm│
│  CredentialsHub      │    │  + .zkey files)          │
│  SocialHub           │    │  snarkjs Groth16 prover  │
│  ReputationProof     │    │  In-browser WASM witness │
│  Registry            │    │  generation              │
│                      │    │                          │
│  QBFT Besu           │    │  5 circuits:             │
│  Chain ID 424242     │    │  • reputation_threshold  │
│                      │    │  • gpa_threshold         │
└──────────────────────┘    │  • work_experience_      │
                            │    threshold             │
                            │  • degree_category       │
                            │  • cert_domain           │
                            └─────────────────────────┘
```

**Figure 3.1 — Three-layer system architecture**

The separation of the ZKP layer from the blockchain layer is an intentional design decision. ZKP proof generation is a computationally intensive, stateless operation that produces a fixed-size output (the Groth16 proof object). By treating it as a distinct layer — called from the application layer and submitting its output to the blockchain layer — the design allows the proof generation substrate to evolve independently (from browser-side WASM to server-side Node.js, for example) without any changes to the smart contracts or frontend component structure.

The three layers communicate via two interfaces. The application layer communicates with the blockchain layer through the JSON-RPC API exposed by the Besu node (via ethers.js and MetaMask). The application layer communicates with the ZKP layer by loading `.wasm` and `.zkey` files and invoking snarkjs's `groth16.fullProve()` function directly in the browser. The proof output is then passed to the blockchain layer through a standard contract call.

---

## 3.2 Design Goals and Threat Model

### 3.2.1 Design Goals

The design of SoulBound Identity is governed by five principal goals, listed in priority order.

**G1 — Privacy by default.** All credential data stored in the system must be private by default. No party other than the token owner may read any credential or social data without an explicit, token-owner-initiated access grant. ZKP proofs must allow verifiers to confirm specific claims without receiving any underlying data.

**G2 — Cryptographic verifiability.** Every credential-related claim that can be externally verified must have a cryptographic proof path: either an on-chain record from an authorised issuer, or a ZKP submitted to an on-chain verifier. Self-asserted credentials are explicitly marked as unverified; issuers must be authorised at the contract level before their attestations are accepted as verified.

**G3 — Non-transferability.** Identity tokens must be permanently bound to a single wallet address. The ability to transfer or delegate an identity token would allow identity fraud (selling a high-reputation identity, renting credentials) that would undermine the system's trust model.

**G4 — User control.** All access grants, access revocations, and credential additions (for self-asserted credentials) must be initiated exclusively by the token owner. No party — not the contract owner, not an issuer, not the platform operator — may read, modify, or grant access to a user's credential data without the owner's on-chain signature.

**G5 — Usability transparency.** Cryptographic complexity must be invisible to end users. ZKP generation, IPFS CID management, bitmask encoding, and contract interaction must all be abstracted by the frontend. A user should be able to use the system with no knowledge of the underlying cryptography.

### 3.2.2 Threat Model

The threat model identifies the principal attacker categories and their capabilities.

**Credential forger.** An attacker who attempts to claim credentials they do not legitimately hold. Against this attacker, the system's defence is the issuer authorisation system in `CredentialsHub`: only wallet addresses explicitly authorised by the contract owner can issue verified credentials. Self-asserted credentials are immutably flagged as `verified = false`. A credential forger who self-asserts a false credential produces an on-chain record that is provably unverified — a verifier querying the credential will see the `verified` flag and draw the appropriate conclusion.

**Snooping verifier.** An attacker who has been granted access to one credential type and attempts to read credential types for which they have no grant, or who attempts to read another user's data entirely. The bitmask access control system in `CredentialsHub` and `SocialHub` enforces per-type access at the contract level; view functions revert with `NoAccess()` if the caller's bitmask does not include the queried type.

**Replay attacker.** An attacker who captures a valid ZKP proof and attempts to resubmit it to claim a reputation attestation for a different token, or to claim a threshold attestation that is no longer valid (because the subject's scores have decreased). The `scoresCommit` public input of the `reputation_threshold` circuit — a Poseidon hash of the exact score array — binds the proof to a specific snapshot of on-chain data. A proof generated from an old score array will fail verification if the current on-chain state differs, because the verifier checks the public commitment against the current state.

**Spam requester.** An attacker who submits a high volume of access requests to harass a token owner or exhaust on-chain storage. The rate-limiting system in `SoulboundIdentity` enforces a maximum of 10 access requests per address per day and a 1-hour per-token cooldown between requests from the same address. Requests that exceed these limits revert at the contract level, incurring gas cost for the attacker without creating any on-chain state.

**Malicious issuer.** An authorised issuer who attempts to issue false credentials to arbitrary tokens. The `issueCredential` function requires the caller to be in the `authorizedIssuers` mapping for the relevant credential type. Authorisation is managed by the contract owner via `setIssuerAuthorization`. An issuer can be de-authorised at any time; credentials already issued by a de-authorised issuer remain on-chain (immutable records) but the issuer's revocation authority is still valid, allowing bad credentials to be revoked.

**Outside the threat model.** This system does not claim to protect against a compromised token owner (a user who has lost their private key or is deliberately misbehaving). Wallet security is the user's responsibility and is out of scope for a smart-contract-level identity system. The system also does not protect against a malicious contract owner (the deployer of the contracts), who has administrative privileges including pausing the system and managing the issuer list — a known limitation for a prototype system that would require a governance mechanism in production.

---

## 3.3 Smart Contract Architecture

The system is composed of four smart contracts. Each contract has a single, well-scoped responsibility; contracts interact through narrow, explicitly defined interfaces.

### 3.3.1 Contract Responsibilities

**`SoulboundIdentity`** is the identity root. It implements ERC-5484 to issue non-transferable tokens (one per wallet address), stores IPFS CIDs for off-chain metadata, and manages the access request lifecycle (request → approve/deny → expiry/revocation). It is the source of ground truth for token ownership: all other contracts resolve ownership by calling `SoulboundIdentity.ownerOf(tokenId)`. It also implements the rate-limiting logic for access requests.

**`CredentialsHub`** is the professional credential registry. It stores five types of credentials — Degree, Certification, WorkExperience, IdentityProof, and Skill — in a unified data structure that distinguishes issuer-verified credentials from self-asserted ones. It maintains the bitmask access control scheme for credential type access and the authorised issuer registry. GPA values for degree credentials and domain/category enums for all credential types are stored on-chain; rich metadata (institution names, descriptions, documents) is stored off-chain on IPFS with on-chain `bytes32` hash commitments.

**`SocialHub`** is the social attestation layer. It stores three categories of social data: peer reputation reviews (0–100 numeric scores with cached running totals), project portfolio entries (IPFS-linked metadata with collaborator lists and status tracking), and skill endorsements (both custom-hash skills and 16 predefined standardised skills with per-endorser duplicate prevention). A separate bitmask scheme controls access to each of the three sections independently.

**`ReputationProofRegistry`** is the ZKP attestation store. It is intentionally minimal: it holds a single mapping from `tokenId` to the highest reputation threshold that has been cryptographically proven for that token, and a `recordProof` function that accepts a Groth16 proof, verifies it through an `IGroth16Verifier` interface, and updates the stored threshold if the new proof asserts a higher threshold than previously recorded. This design means the registry is append-only from the perspective of reputation strength — the proven threshold for a token only ever increases.

### 3.3.2 Contract Interaction Diagram

```
                    ┌────────────────────────────┐
                    │      SoulboundIdentity       │
                    │  (ERC-5484, access control)  │
                    └─────────────┬──────┬─────────┘
                                  │      │
                    ownerOf()     │      │  ownerOf()
                    interface     │      │  interface
                                  │      │
              ┌───────────────────┘      └──────────────────┐
              ▼                                              ▼
┌─────────────────────────┐                  ┌──────────────────────────┐
│      CredentialsHub      │                  │         SocialHub         │
│  (5 credential types,    │                  │  (reviews, projects,      │
│   bitmask access,        │                  │   endorsements,           │
│   issuer registry)       │                  │   bitmask access)         │
└─────────────────────────┘                  └──────────────────────────┘

                    ┌────────────────────────────┐
                    │  ReputationProofRegistry    │
                    │  (ZKP attestations,         │
                    │   IGroth16Verifier)         │
                    └────────────────────────────┘
```

**Figure 3.2 — Contract interaction topology**

The dependency graph is deliberately acyclic and shallow. `SoulboundIdentity` has no dependencies on other system contracts — it is the root. `CredentialsHub` and `SocialHub` each hold an immutable reference to `SoulboundIdentity` to resolve ownership but have no dependency on each other. `ReputationProofRegistry` holds an immutable reference to the auto-generated Groth16 verifier contract but has no dependency on any other system contract. This flat dependency structure minimises the attack surface for cross-contract re-entrancy and simplifies upgradeability analysis.

### 3.3.3 The ISoulboundIdentity Interface

The two satellite contracts (`CredentialsHub`, `SocialHub`) interact with the identity root through a minimal interface:

```
interface ISoulboundIdentity {
    function ownerOf(uint256 tokenId) external view returns (address);
}
```

This deliberate minimalism means that `CredentialsHub` and `SocialHub` could be used with any ERC-721-compatible identity contract, not just this specific `SoulboundIdentity` implementation. It also means the interface cannot be exploited by a malicious call — `ownerOf` is a pure read operation with no side effects.

---

## 3.4 Credential Data Model

### 3.4.1 The Unified Credential Structure

All five credential types share a single on-chain data structure:

| Field | Type | Description |
|---|---|---|
| `credentialId` | `uint256` | Globally unique ID (auto-incremented) |
| `credType` | `CredentialType` | Enum: Degree / Certification / WorkExperience / IdentityProof / Skill |
| `metadataHash` | `bytes32` | Keccak256 hash of the IPFS CID containing rich metadata |
| `issuer` | `address` | Issuing wallet address (token owner for self-asserted, authorised issuer otherwise) |
| `issueDate` | `uint64` | Unix timestamp of issuance |
| `expiryDate` | `uint64` | Unix timestamp of expiry (0 = non-expiring) |
| `status` | `CredentialStatus` | Active / Revoked / Expired |
| `category` | `uint8` | Multipurpose: `SkillCategory` for skills; `DegreeCategory` / `CertificationDomain` for others |
| `verified` | `bool` | True if issued by an authorised issuer; false if self-asserted |

**Table 3.1 — On-chain Credential struct fields**

The `verified` flag is the single most important field for a credential verifier. A credential with `verified = false` is a self-assertion: the holder claims to have the credential but no authorised third party has attested to it. A credential with `verified = true` means an address in the `authorizedIssuers` mapping for that credential type has signed an Ethereum transaction attesting to the credential — a cryptographic guarantee that the issuer participated in the on-chain record creation.

### 3.4.2 Type-Specific On-Chain Fields

Certain credential types carry additional structured on-chain data beyond the universal struct:

- **Degree credentials** store GPA as a `uint16` scaled by 100 (e.g. `350` = GPA 3.50) and a `DegreeCategory` enum (ArtsAndHumanities, BusinessAndEconomics, LawAndSocialSciences, EducationAndDevelopment, HealthAndLifeSciences, ScienceAndTechnology). Storing GPA on-chain in a structured form — rather than solely in IPFS metadata — is necessary to allow the `gpa_threshold` ZKP circuit to prove a threshold claim against verifiable on-chain data.

- **Certification credentials** store a `CertificationDomain` enum (ITSoftwareDevelopment, BusinessManagement, HealthMedicine, DataAIAnalytics, CommunicationMarketing) on-chain, enabling the `cert_domain` ZKP circuit to prove membership in a certification category without revealing the full credential.

- **Work Experience credentials** use `issueDate` as the job start date and `expiryDate` as the job end date (0 = currently employed). The `getTotalWorkExperience()` view function accumulates duration across all active work credentials, providing the on-chain input for the `work_experience_threshold` circuit.

### 3.4.3 On-Chain vs. IPFS Off-Chain Split

The design distinguishes between data that must be on-chain for verifiability and data that only needs to be accessible to authorised parties.

**On-chain:** structured fields needed for ZKP circuit inputs (GPA, category enums, start/end dates), credential status (`Active`/`Revoked`/`Expired`), issuer address, timestamps, and the `verified` flag. These fields are the minimum necessary for cryptographic verifiability and access-controlled queries.

**Off-chain (IPFS):** institution names, credential titles, descriptions, document hashes, URLs, endorsement details, and any other human-readable or rich-media content. These fields are stored as a JSON document at an IPFS CID. The `metadataHash` field on-chain is the `keccak256` hash of the CID string, providing a tamper-evident commitment to the off-chain content without storing it on-chain.

This split is motivated by two constraints. First, Ethereum storage is expensive — storing kilobytes of rich metadata on-chain would make the system economically impractical for users. Second, privacy: off-chain IPFS data is only accessible to parties who know the CID, and the CID is only exposed to parties with an approved access grant. A party without access cannot read the IPFS metadata even if they can observe on-chain events, because the `metadataHash` is a one-way commitment.

The limitation of this design in the prototype is that IPFS pinning is simulated (CIDs are generated deterministically from the metadata but are not pinned to a real IPFS network). In a production deployment, real IPFS pinning through a service such as Pinata or a self-hosted node would be required to guarantee data availability.

---

## 3.5 Access Control Design

### 3.5.1 The Bitmask Permission Scheme

Access control in SoulBound Identity is enforced through two complementary bitmask systems: one in `SoulboundIdentity` (governing access to IPFS metadata) and one in `CredentialsHub` and `SocialHub` (governing access to specific credential and social data categories).

In `CredentialsHub`, the `grantedTypes` mapping stores a `uint8` bitmask per (tokenId, viewer) pair. Each bit corresponds to a credential type:

| Bit | Value | Credential Type |
|---|---|---|
| 0 | 1 | Degree |
| 1 | 2 | Certification |
| 2 | 4 | WorkExperience |
| 3 | 8 | IdentityProof |
| 4 | 16 | Skill |

**Table 3.2 — CredentialsHub bitmask encoding**

To check whether a caller can access a specific credential type, the contract evaluates:

```
(grantedTypes[tokenId][caller] >> uint8(credType)) & 1 == 1
```

This single bit-shift and AND operation runs in O(1) and costs approximately 200 gas — negligible compared to the external call cost. A token owner who wants to grant an employer access to degrees and work experience only (bits 0 and 2) sets the bitmask to `0b00101 = 5`. The employer can query degrees and work experience but receives `NoAccess()` for all other types.

The same pattern applies in `SocialHub`, where bits 0–2 control access to Reviews, Projects, and Endorsements respectively.

### 3.5.2 The Request/Approve/Deny Lifecycle

The access request lifecycle in `SoulboundIdentity` governs access to the IPFS metadata CID (and through it, the full identity profile). The lifecycle has five states:

```
        requestAccess()
None ──────────────────► Pending
                            │
              approveAccess()│  denyAccess()
                  ┌─────────┤
                  ▼         ▼
             Approved      Denied
                  │
    (after expiresAt)│  revokeAccess()
                  └──────────► None
```

**Figure 3.3 — Access request state machine**

A requester who has been denied or whose access has expired returns to `None` and may submit a new request subject to the cooldown constraint. A requester who is re-approved replaces their expired access record with a new `Approved` state and a new expiry timestamp.

The default access grant duration is 30 days (2,592,000 seconds), configurable per approval. After expiry, the `canView()` function returns false automatically — no on-chain transaction is needed to enforce expiry because the check is done at query time against `block.timestamp`.

### 3.5.3 Rate Limiting and Cooldown Design

Two rate-limiting mechanisms prevent spam access requests:

**Per-token cooldown.** After a requester submits an access request for a specific token, they cannot submit another request for the same token for 1 hour (`REQUEST_COOLDOWN = 1 hours`). The cooldown is enforced by comparing `block.timestamp` against the last request time stored per (requester, tokenId) pair. This prevents burst harassment of a specific token owner.

**Daily global limit.** Each address is limited to 10 access requests per calendar day (`MAX_REQUESTS_PER_DAY = 10`) across all tokens. The daily counter resets at midnight UTC (computed as `block.timestamp / 1 days`). This prevents an attacker from distributing harassment across many target tokens to circumvent the per-token cooldown.

These limits were chosen based on realistic usage patterns: a legitimate user making access requests to multiple employers in a single day would rarely need more than 10, and re-requesting access to the same token within an hour has no plausible legitimate use case.

### 3.5.4 Batch Operations

Both `batchApproveAccess` and `batchDenyAccess` are provided on `SoulboundIdentity`, and `batchGrantCredentialAccess` and `batchGrantSocialAccess` are provided on `CredentialsHub` and `SocialHub` respectively. These batch operations allow a token owner to process multiple pending requests in a single transaction, significantly reducing gas costs and the number of MetaMask confirmation dialogs required in practice. A token owner recruiting for a team who needs to approve access for ten employers simultaneously would otherwise face ten separate transactions.

---

## 3.6 ZKP Subsystem Design

### 3.6.1 The Role of ZKPs in This System

The ZKP subsystem exists to bridge the gap between two incompatible requirements: (a) credentials must be stored on-chain or have on-chain commitments to be tamper-evident, and (b) credential details must be private. The bridge is a selective disclosure mechanism: given a specific on-chain claim, a user can generate a ZKP that proves the claim holds without revealing the underlying data.

Five circuits address the five highest-value credential claims:

| Circuit | Claim Proved | Key Private Inputs | Key Public Inputs |
|---|---|---|---|
| `reputation_threshold` | Average peer score ≥ T | Score array (50 elements) | Threshold, tokenId, scoresCommit |
| `gpa_threshold` | GPA ≥ T | GPA value (scaled ×100) | Threshold, tokenId |
| `work_experience_threshold` | Total experience ≥ T months | Individual job durations | Threshold, tokenId |
| `degree_category` | Degree is in category C | Full degree data | Category, tokenId |
| `cert_domain` | Certification is in domain D | Full cert data | Domain, tokenId |

**Table 3.3 — Five ZKP circuits and their claim structures**

The choice of these five circuits was driven by the most common employer verification queries: qualification in a specific field (degree category), relevant sector certification (cert domain), sufficient practical experience (work experience and GPA), and peer-assessed professional competence (reputation). Each circuit proves a categorical or threshold claim — the form of query that is useful to a verifier while being privacy-sensitive for the holder.

### 3.6.2 Groth16 Selection Rationale

The choice of Groth16 as the proof system was driven by five concrete properties:

1. **Proof size.** A Groth16 proof consists of exactly three elliptic curve points: two points on G₁ (each 32 bytes) and one point on G₂ (64 bytes), totalling approximately 192–200 bytes. This is the smallest proof size of any deployed SNARK system, minimising the calldata cost when submitting proofs to the blockchain.

2. **EVM precompile support.** The EVM includes native precompiles for BN128 elliptic curve addition (EIP-196), scalar multiplication (EIP-196), and optimal Ate pairing (EIP-197). Groth16 over the BN128 curve exploits all three precompiles during on-chain verification, reducing the gas cost to approximately 280,000 gas — achievable within standard block gas limits.

3. **On-chain verification cost.** Among deployed SNARK systems, Groth16 has the lowest on-chain verification gas cost on EVM (see Table 2.1). For a high-value identity attestation that a verifier might check once per hiring decision, 280K gas at current gas prices is economically acceptable.

4. **Circom 2 toolchain compatibility.** Circom 2 and snarkjs have mature, production-tested Groth16 support including browser-side WASM witness generation. The toolchain is well-documented and has been validated in production systems including Polygon ID and the Tornado Cash privacy protocol.

5. **Circuit-specific trusted setup.** While the requirement for a circuit-specific trusted setup is a limitation, it is acceptable for a known, fixed set of five circuits. If the circuits change, a new setup is required — but for a stable production system with fixed verification logic, this is a one-time cost.

### 3.6.3 The Poseidon Commitment Scheme

For the `reputation_threshold` circuit, a cryptographic commitment to the score array is required. The commitment serves two purposes: it binds the proof to a specific snapshot of on-chain data (preventing replay of valid proofs against outdated scores), and it provides a public value that the verifier can check against the current state without receiving the scores themselves.

Poseidon was selected as the hash function for this commitment. As discussed in Section 2.3.6, Poseidon is designed for the arithmetic circuit model and requires approximately 240 R1CS constraints per two-input hash — versus approximately 27,000 for SHA-256. For a 50-element score array, a Poseidon tree hash requires approximately 49 two-input invocations (building a Merkle-like structure), totalling roughly 12,000 constraints — feasible within the circuit size constraints of the Powers of Tau ceremony used for setup.

The `scoresCommit` is computed as `Poseidon(scores[0], scores[1], ..., scores[49], reviewCount)` and published as a public input. The verifier contract can independently compute the same hash from the on-chain score data and confirm that the proof was generated for the current state. If scores have changed since the proof was generated, the commitment will not match and the proof will fail verification.

### 3.6.4 The ReputationProofRegistry Design

`ReputationProofRegistry` stores only one value per token: the highest threshold that has been ZK-proven for that token. This minimal design reflects a deliberate choice about the semantics of the attestation.

An employer asking "does this candidate have a reputation score above 70?" does not need the exact score or a history of all proofs. They need to know whether the claim holds right now, attested by a valid cryptographic proof. Storing only the highest proven threshold achieves this: a token owner who has proven a score above 80 implicitly satisfies any query for 70 or below, and a query for 90 returns false until a proof for 90 or higher is submitted.

The `recordProof` function is permissionless — anyone may submit a valid proof for any token. This design means employers can request a proof and the holder can generate it, or a third party (a background check service, for example) could submit a proof on behalf of the holder. The verifier contract ensures that only valid proofs can update the registry regardless of who submits them.

---

## 3.7 Key Design Trade-offs

### 3.7.1 Bitmask vs. Per-Grant Access Control

An alternative to the bitmask scheme would be a per-grant mapping: a separate `mapping(uint256 => mapping(address => mapping(CredentialType => bool)))` that stores one boolean per (token, viewer, type) triple. This approach is conceptually simpler and avoids the need to encode/decode bitmasks.

The bitmask approach was chosen for three reasons. First, gas efficiency: updating all five credential type permissions for a viewer requires a single `SSTORE` of one `uint8` word versus five separate `SSTORE` operations. Second, batch readability: the caller's entire permission profile can be read in a single `SLOAD` and all five type checks performed with bitwise operations — no iteration needed. Third, compactness: the full permission state for all credential types fits in a single storage slot (one `uint8`), whereas the per-grant approach would require five storage slots per (token, viewer) pair.

The trade-off is that the bitmask is less readable in raw on-chain storage and requires a simple decoding step in the frontend. This is an acceptable cost given the gas savings.

### 3.7.2 In-Browser vs. Server-Side Proof Generation

The prototype implements in-browser proof generation: the `.wasm` witness generator and `.zkey` proving key are loaded into the browser, and snarkjs runs the Groth16 prover in a Web Worker. This approach has two significant advantages: it requires no server infrastructure beyond the blockchain node, and it preserves privacy — the private inputs (score array, GPA value) never leave the user's browser.

The limitations are equally significant. The `.zkey` files for complex circuits can be tens of megabytes, requiring download on first use. Groth16 proving is computationally intensive; the `reputation_threshold` circuit with 50 score elements can take 15–60 seconds on a mid-range laptop and is impractical on mobile. The browser JavaScript engine does not have access to native multi-threading optimisations available to a Node.js server.

An alternative design (labelled "Path 2" in `ZKP_DESIGN_OVERVIEW.md`) places proof generation on a server-side Node.js process. Since all credential data is publicly on-chain, the server can read the inputs directly without the user disclosing anything — there is no privacy cost to server-side generation for data that is already public. The current in-browser implementation is appropriate for a prototype that prioritises not requiring server infrastructure; a production deployment would benefit from server-side generation for all circuits whose inputs are already public.

### 3.7.3 On-Chain vs. Off-Chain Data Storage

The choice of what to store on-chain versus on IPFS involves a three-way trade-off between cost, privacy, and availability.

On-chain storage is expensive: an EVM `SSTORE` for a 32-byte word costs 20,000 gas for a new value. Storing a full credential with all its rich metadata fields on-chain would cost hundreds of thousands of gas per credential — prohibitive for a user with a dozen credentials. IPFS storage is effectively free (ignoring pinning infrastructure costs) and scales to arbitrary sizes.

However, IPFS storage requires the CID to be known to retrieve the data. In the current design, the CID is stored in `SoulboundIdentity` and revealed only to parties with an approved access grant. This access-gating of the CID provides the privacy protection: a party without access cannot find the IPFS content.

The risk is availability: if the IPFS content is not pinned, it may become unavailable. In a production system, this would be mitigated by ensuring that token owners or the platform pin their credential metadata. For the prototype, simulated CIDs are used and availability is not a concern.

The result of this trade-off is the split described in Section 3.4.3: all data needed for cryptographic verifiability (GPA, category enums, timestamps, `verified` flag) is stored on-chain; all human-readable descriptive data is stored off-chain. This minimises on-chain storage costs while preserving the on-chain data necessary for ZKP circuit inputs.

---

*End of Chapter 3*
