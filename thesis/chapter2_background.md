# Chapter 2 — Background and Related Work

This chapter surveys the technical and academic foundations upon which SoulBound Identity is built. Section 2.1 examines the decentralised identity landscape, covering the W3C standards for Decentralised Identifiers and Verifiable Credentials and the broader Self-Sovereign Identity movement. Section 2.2 focuses on Soulbound Tokens — their conceptual origin, the ERC-5484 standard, and existing implementations. Section 2.3 provides a technical grounding in zero-knowledge proofs, comparing the major proof systems and explaining the choice of Groth16. Section 2.4 describes the blockchain infrastructure on which the system is deployed. Section 2.5 surveys five deployed or proposed related systems. Section 2.6 synthesises these reviews into a precise statement of the research gap that this thesis addresses.

---

## 2.1 The Decentralised Identity Landscape

### 2.1.1 The Centralised Identity Problem

Contemporary digital identity infrastructure is dominated by centralised identity providers. A user's professional existence is fragmented across institutional silos: a university's student record system, an employer's HR platform, a government e-ID database, a social network's profile store. Each silo is managed by a different organisation with its own data model, access policy, and retention practice. The absence of interoperability means that any cross-boundary identity claim — a job application, a professional licence verification, an academic credential check — requires contacting the original issuing institution directly.

This model creates three structural problems. First, it is inefficient: verification latency is measured in days for high-assurance checks. Second, it is privacy-hostile: verifiers receive complete credential records when they may only need to confirm a single attribute. Third, it creates single points of failure and control — if an institution's records system goes offline, is breached, or decides to revoke access, the individual has no recourse.

### 2.1.2 Self-Sovereign Identity

Self-Sovereign Identity (SSI) is a design philosophy that proposes returning control of identity data to the individual. Allen [2016] articulated ten foundational principles for SSI, including existence (users must have an independent existence), control (users must control their identities), access (users must have access to their own data), and persistence (identities must be long-lived). These principles stand in direct contrast to federated identity models in which the identity provider retains ultimate authority over the user's digital existence.

SSI implementations typically separate three roles: the **issuer** (an institution that attests to a claim), the **holder** (the individual who receives and stores credentials), and the **verifier** (a party that needs to confirm a claim). The holder mediates all interactions — presenting credentials selectively to verifiers without routing the request through the issuer [W3C, 2019]. This triangle of trust is the architectural foundation on which both the W3C Verifiable Credentials standard and SoulBound Identity are built.

### 2.1.3 W3C Decentralised Identifiers (DIDs)

A Decentralised Identifier (DID) is a globally unique persistent identifier that does not require a centralised registration authority and is cryptographically verifiable [Sporny et al., 2022]. A DID is a URI of the form `did:<method>:<method-specific-id>`, where the method specifies how the DID is resolved to a **DID document** — a JSON-LD document containing the public keys, authentication methods, and service endpoints associated with the identifier. For example, `did:ethr:0xf1FB...` is an Ethereum-based DID resolved by looking up the associated address on-chain.

The DID Core specification [W3C, 2022] defines the data model, URL syntax, and resolution requirements without mandating any particular underlying infrastructure. This method-agnostic design allows DIDs to be anchored on blockchain networks, distributed hash tables, or domain names, making them compatible with a wide range of deployment contexts.

DIDs provide the persistent, user-controlled identifier that SSI requires. However, a DID alone is not a credential — it identifies a subject but does not attest to any claims about that subject. This is the role of Verifiable Credentials.

### 2.1.4 W3C Verifiable Credentials (VCs)

The W3C Verifiable Credentials Data Model [Sporny et al., 2019] defines a standard for expressing cryptographically verifiable claims. A Verifiable Credential (VC) is a JSON-LD document containing a set of claims made by an issuer about a subject (identified by a DID), along with the issuer's digital signature. A **Verifiable Presentation** (VP) is a derived document in which the holder packages one or more VCs — possibly with selective disclosure applied — and presents them to a verifier.

VCs represent a significant improvement over traditional credential formats: they are machine-readable, cryptographically tamper-evident, and carry their issuer's signature in a standard format that any conforming verifier can check. However, the VC specification does not define a transport mechanism, a storage layer, or a privacy-preserving disclosure protocol. It is a data model, not a complete system. Most VC implementations store credentials in a digital wallet on the user's device, which introduces questions of wallet availability, backup, and cross-device access that the standard does not address.

SoulBound Identity adopts the conceptual SSI triangle and the VC issuer/holder/verifier role model, but replaces the wallet-centric off-chain storage model with on-chain storage secured by smart contract access control — a design choice motivated in detail in Chapter 3.

---

## 2.2 Soulbound Tokens

### 2.2.1 Conceptual Origin

The concept of a "soulbound" token was introduced by Vitalik Buterin in a January 2022 blog post [Buterin, 2022a], drawing an analogy from massively multiplayer online games in which certain powerful items, once equipped, cannot be traded or transferred. Buterin observed that the NFT ecosystem of 2021–2022 was overwhelmingly focused on transferable, financialisable assets — profile pictures, digital art, in-game items — and argued that this omitted an entire class of valuable social objects: attestations, achievements, memberships, and credentials whose value is inseparable from the identity of the holder.

A university degree is not valuable because it can be sold; it is valuable precisely because it cannot be legitimately transferred. The same applies to professional licences, employment records, and peer endorsements. If these credentials are represented as transferable tokens, they become tradeable — and therefore forgeable in economic terms. Binding a token permanently to a wallet address eliminates this attack vector: the token's presence in a wallet is evidence that the wallet's owner legitimately received the attestation.

### 2.2.2 Decentralised Society

Weyl, Ohlhaver, and Buterin [2022] elaborated this concept into a broader social vision in "Decentralized Society: Finding Web3's Soul." The paper proposes a world in which "Souls" — wallet addresses holding a rich collection of Soulbound Tokens — become the foundation for a decentralised social graph. SBTs would encode educational credentials, employment history, community memberships, and peer endorsements. This social graph would enable novel applications: undercollateralised lending based on social trust, quadratic voting weighted by community membership, and decentralised organisation governance resistant to plutocracy.

The DeSoc vision is explicitly not a simple identity system but a broad sociotechnical proposal. The authors acknowledge significant open problems, including privacy (the SBT social graph is fully public on a naive implementation), recovery (loss of a Soul wallet is irrecoverable if there is no off-chain backup), and the risk of discrimination enabled by immutable on-chain records. These concerns are directly relevant to this thesis, which addresses the privacy problem through ZKPs and the access control problem through a granular permission system.

### 2.2.3 The ERC-5484 Standard

ERC-5484 [Cai, 2022] is the Ethereum Improvement Proposal that formalises Soulbound Tokens as an extension of the ERC-721 NFT standard. Its primary technical contribution is the `burnAuth` mechanism, an enumerated value set at minting time that determines which parties can destroy the token:

| `burnAuth` Value | Who Can Burn |
|---|---|
| `IssuerOnly` | The address that issued the token |
| `OwnerOnly` | The token owner (holder) |
| `Both` | Either issuer or owner |
| `Neither` | The token is permanently non-destroyable |

Critically, ERC-5484 overrides the ERC-721 transfer functions to revert unconditionally, enforcing non-transferability at the protocol level. A single `Issued` event is emitted at mint time to provide a canonical record of issuance. The standard does not specify metadata format, access control, or credential semantics — these are left to implementors, as they are in ERC-721.

SoulBound Identity implements ERC-5484 in `SoulboundIdentity.sol`, extending it with a bitmask access control system, rate limiting, and IPFS metadata storage. One token is permitted per address, enforced at the contract level.

### 2.2.4 Existing SBT Implementations

Beyond theoretical proposals, a small number of production SBT systems exist. Gitcoin Passport [Gitcoin, 2023] issues SBT-like attestations representing completion of various identity verification "stamps" (Google account ownership, GitHub activity, BrightID verification) and aggregates them into a trust score used to resist Sybil attacks in quadratic funding. Binance Account Bound tokens (BAB) [Binance, 2022] are SBTs issued to users who have completed KYC verification on the Binance exchange, used to gate access to certain on-chain features. Neither system combines SBTs with ZKP-based selective disclosure or granular per-credential access control.

---

## 2.3 Zero-Knowledge Proofs

### 2.3.1 Foundational Properties

A zero-knowledge proof (ZKP) is an interactive or non-interactive cryptographic protocol between a prover and a verifier. The seminal definition was given by Goldwasser, Micali, and Rackoff [1989], who identified three properties that any ZKP system must satisfy:

- **Completeness.** If the statement is true and both parties follow the protocol honestly, the verifier will accept the proof.
- **Soundness.** If the statement is false, no cheating prover can convince an honest verifier to accept the proof, except with negligible probability.
- **Zero-knowledge.** If the statement is true, the verifier learns nothing beyond the fact that the statement is true. Formally, everything the verifier can compute from the proof can be simulated without access to the prover's secret witness.

These three properties together make ZKPs ideal for credential verification: completeness guarantees that legitimate credential holders can always produce valid proofs; soundness guarantees that invalid claims cannot be proven; zero-knowledge guarantees that no sensitive information beyond the specific claim is disclosed.

### 2.3.2 zk-SNARKs

A Succinct Non-Interactive Argument of Knowledge (SNARK) is a ZKP system in which the proof is short (succinct), does not require back-and-forth interaction between prover and verifier (non-interactive), and the verifier's acceptance constitutes a proof that the prover knows a secret witness satisfying the proved statement (argument of knowledge). zk-SNARKs add the zero-knowledge property.

Non-interactivity is achieved via the Fiat-Shamir heuristic [Fiat & Shamir, 1986] or through a Structured Reference String (SRS) produced by a trusted setup ceremony. The prover uses the SRS to generate a proof; the verifier uses a separate verification key derived from the same SRS to check it. The proof can be verified by anyone, at any time, without further interaction — a property essential for on-chain verification, where there is no synchronous channel between prover and verifier.

### 2.3.3 Groth16

Groth [2016] introduced a pairing-based SNARK construction that produces proofs consisting of exactly three elliptic curve points — two points on G₁ and one on G₂ — yielding a proof size of approximately 192–200 bytes. Verification requires only three pairing operations, making it the most efficient known pairing-based SNARK with respect to both proof size and verification computation.

On the Ethereum Virtual Machine, verification of a Groth16 proof over the BN128 (alt_bn128) curve costs approximately 280,000 gas — a predictable, bounded cost enabled by the native EVM precompiles introduced in EIP-196 (elliptic curve addition and scalar multiplication) and EIP-197 (optimal Ate pairing) [Ethereum Foundation, 2017]. This gas cost makes Groth16 economically viable for on-chain verification of high-value attestations.

The limitation of Groth16 is its **trusted setup requirement**: the SRS is produced by a multi-party computation (MPC) ceremony in which at least one participant must discard their secret randomness ("toxic waste"). If all participants collude, they could forge proofs. In practice, large MPC ceremonies (e.g., the Hermez network's Powers of Tau ceremony with over 200 participants) reduce this trust assumption to near-negligible levels. For this prototype, the publicly available Hermez Powers of Tau files are used.

### 2.3.4 PLONK and STARKs — Why Not Chosen

Two prominent alternative proof systems were considered and rejected for this project.

**PLONK** [Gabizon, Williamson & Ciobotaru, 2019] is a universal SNARK that uses a single trusted setup for all circuits of a given maximum size, rather than a circuit-specific setup as in Groth16. This is a significant practical advantage for systems with many circuits. However, PLONK proofs are larger (approximately 400 bytes) and more expensive to verify on-chain (approximately 450,000–500,000 gas), making them less suitable for cost-sensitive EVM deployment.

**zk-STARKs** (Scalable Transparent Arguments of Knowledge) [Ben-Sasson et al., 2018] require no trusted setup — the SRS is replaced with a public hash function, eliminating the toxic waste problem entirely. However, STARK proofs are significantly larger (tens of kilobytes) and the verification cost on EVM is prohibitive without a recursive aggregation layer. EVM-native STARK verifiers are an active research area but are not yet production-ready for the per-credential verification use case of this system.

The comparison is summarised in Table 2.1.

**Table 2.1 — ZKP system comparison**

| Property | Groth16 | PLONK | zk-STARK |
|---|---|---|---|
| Proof size | ~200 bytes | ~400 bytes | ~50–200 KB |
| On-chain verify (gas) | ~280K | ~450–500K | Impractical without aggregation |
| Trusted setup | Circuit-specific | Universal | None |
| EVM precompile support | Yes (BN128) | Partial | No |
| Circuit language (this project) | Circom 2 | Circom 2 / Plonkish | Cairo / Noir |

Groth16 is the clear choice for a prototype that prioritises EVM compatibility, minimal on-chain gas cost, and a well-supported toolchain.

### 2.3.5 Circom and the Arithmetic Circuit Model

ZKP systems operate over arithmetic circuits: computational graphs in which values are elements of a prime field Fₚ and operations are field addition and multiplication. Any computation that can be expressed as a system of polynomial constraints over Fₚ — a Rank-1 Constraint System (R1CS) — can be proved with a SNARK.

Circom 2 [iden3, 2022] is a domain-specific language for writing arithmetic circuits that compiles to an R1CS representation and a WebAssembly witness generator. It provides a template system for modular circuit composition and a standard library of common gadgets (range checks, comparators, hash functions). The compiler produces the `.r1cs` file consumed by the trusted setup, and the `.wasm` file used by snarkjs [iden3, 2020] to compute the witness during proof generation.

The constraint count of a circuit determines the size of the SRS required, the memory needed for proof generation, and (indirectly) the proving time. The five circuits in this thesis range from approximately 1,000 to 15,000 constraints, as detailed in Chapter 5.

### 2.3.6 The Poseidon Hash Function

Standard hash functions (SHA-256, Keccak-256) are efficient in software but extremely constraint-heavy when encoded as arithmetic circuits — SHA-256 requires approximately 27,000 R1CS constraints per invocation. This makes them impractical for use inside ZKP circuits.

Poseidon [Grassi et al., 2019] is a hash function designed specifically for the arithmetic circuit model. It operates directly over prime field elements using the HADES permutation, which alternates full S-box layers (where every element is raised to a power in Fₚ) with partial S-box layers (where only one element is raised to a power) to achieve security with minimal constraint overhead. A Poseidon hash over two field elements requires approximately 240 R1CS constraints — roughly two orders of magnitude fewer than SHA-256.

In this system, Poseidon is used to compute the `scoresCommit` public input of the `reputation_threshold` circuit: a hash of the full array of peer review scores that binds the proof to a specific snapshot of on-chain data, preventing replay of proofs against stale state.

---

## 2.4 Blockchain Infrastructure

### 2.4.1 The Ethereum Virtual Machine

The Ethereum Virtual Machine (EVM) is a stack-based, deterministic, Turing-complete runtime that executes smart contracts on the Ethereum network and its compatible chains [Buterin, 2014; Wood, 2014]. Smart contracts are deployed as EVM bytecode at a fixed address; transactions invoke the contract by sending a message to that address with encoded calldata. The EVM's gas model assigns a cost to every computational operation, preventing resource exhaustion and providing a predictable execution environment.

Key EVM properties relevant to this thesis:
- **Determinism:** Every node executes the same transaction and arrives at the same state; no external data sources can be invoked from within a contract.
- **Immutability:** Deployed contract code cannot be modified (absent an explicit upgrade proxy pattern). This is both a security property and an auditability guarantee.
- **Events:** Contracts can emit logs (events) that are stored in a Bloom-filter-indexed structure alongside each block. Events are the primary mechanism for off-chain applications to observe on-chain state changes.
- **Precompiles:** A small set of cryptographic operations (hashing, elliptic curve arithmetic, pairing) are implemented as native EVM instructions at fixed low addresses, enabling efficient on-chain cryptography.

### 2.4.2 QBFT Consensus and Hyperledger Besu

The system is deployed on a permissioned consortium blockchain running the Quorum Byzantine Fault Tolerant (QBFT) consensus protocol [EIP-N/A, 2021] on Hyperledger Besu [Hyperledger, 2022] with Chain ID 424242.

QBFT is a deterministic BFT consensus protocol derived from Istanbul BFT. It achieves immediate transaction finality — once a block is committed, it cannot be reorganised — and tolerates up to ⌊(n−1)/3⌋ faulty or malicious validators in an n-validator network. This contrasts sharply with Ethereum mainnet's probabilistic finality, where a transaction is considered irreversible only after multiple confirmations.

Immediate finality has two important implications for an identity system. First, approved access grants and credential additions are irreversible the moment they are committed, with no risk of chain reorganisation undoing them. Second, ZKP proofs submitted to the verifier contract are immediately final — there is no need to wait for confirmation depth before treating an attestation as valid.

Besu is a full-featured Ethereum client maintained by the Hyperledger Foundation that supports both public Ethereum and permissioned enterprise networks. Its QBFT support, JSON-RPC API compatibility with standard Ethereum tooling (MetaMask, ethers.js, Hardhat), and pluggable permissioning model make it well-suited to a prototype system that must interoperate with a standard web3 frontend stack.

### 2.4.3 OpenZeppelin Contract Patterns

OpenZeppelin Contracts [OpenZeppelin, 2023] is the dominant open-source library for secure Solidity smart contract development. This project uses several OpenZeppelin components:

- **`Ownable`** — a two-step ownership transfer pattern with explicit acceptance, used to manage contract administration rights.
- **`ReentrancyGuard`** — a mutex that prevents re-entrant calls, guarding functions that transfer value or update state in multiple steps.
- **`EnumerableSet`** — a library for sets of addresses or bytes32 values that supports O(1) add, remove, and contains operations along with full enumeration, used for token-to-owner mappings and approved requester sets.

The project also applies OpenZeppelin's custom-error pattern (introduced in Solidity 0.8.4) in preference to `require` with string messages, reducing gas costs for revert operations and improving off-chain error introspection.

---

## 2.5 Related Systems

### 2.5.1 Polygon ID

Polygon ID [Polygon, 2022] is an identity framework developed by Polygon (formerly Matic Network) built on the iden3 protocol. It uses a Merkle tree-based identity state anchored on the Polygon PoS blockchain. Credentials are issued off-chain as W3C Verifiable Credentials and stored in the user's mobile wallet; a commitment to the credential is inserted into the holder's identity Merkle tree, whose root is published on-chain. ZKP circuits (Circom 2, Groth16) allow the holder to prove claims about their credentials — such as age over 18 or membership in a specific group — without revealing the credential contents, using circuits generated from the iden3 `CredentialAtomicQuerySig` and `CredentialAtomicQueryMTP` templates.

Polygon ID is the closest existing system to SoulBound Identity in terms of technology stack and design goals. The key differences are: (1) Polygon ID credentials are off-chain VCs in a mobile wallet, whereas SoulBound Identity stores credentials on-chain with access control; (2) Polygon ID has no concept of soulbound (non-transferable) identity anchoring; (3) Polygon ID does not implement a peer reputation system or social graph. Polygon ID targets general-purpose identity with enterprise issuer integrations; SoulBound Identity targets professional credentials with on-chain social attestations.

### 2.5.2 Worldcoin / World ID

Worldcoin [Worldcoin Foundation, 2023] is a biometric identity system that uses a custom iris-scanning hardware device (the Orb) to generate a unique biometric hash (IrisCode) for each participant. The IrisCode is inserted into a Merkle tree; a ZKP (based on the Semaphore protocol [Gurkan et al., 2021]) allows the user to prove they are a unique human registered in the Worldcoin system — without revealing which IrisCode they hold or linking different proofs to the same person. The on-chain signal is a "World ID": a nullifier that proves unique personhood per action.

Worldcoin solves a specific and narrow problem: Sybil resistance for digital public goods. It does not address professional credentials, access control, or reputation. Its reliance on specialised hardware and centralised biometric data collection raises significant ethical and regulatory concerns [O'Brien, 2023] that are entirely absent from SoulBound Identity's trust model.

### 2.5.3 Civic

Civic [Civic Technologies, 2018] is an identity verification platform that issues reusable KYC attestations. A user completes an identity verification process (document scanning, liveness check) through Civic's partner network; the verified identity is stored in a Civic "Secure Identity Platform" and can be presented to third parties via a QR code or API call. Blockchain is used as an audit trail for verification events, not as the primary storage or access control mechanism.

Civic represents a centralised-verification, blockchain-anchoring hybrid model. Its credentials are proprietary, tied to the Civic platform, and require Civic's continued operation to be verifiable. This contrasts with SoulBound Identity's design goal of permissionless verifiability: any party with access to the blockchain can verify a ZKP-attested claim without routing through the original issuer's infrastructure.

### 2.5.4 MIT Digital Certificates (Blockcerts)

The MIT Media Lab's Digital Certificates project [Nazaré, Bhargava & Schmidt, 2016], later generalised as the Blockcerts open standard [Learning Machine, 2017], issues academic credentials as signed JSON-LD documents anchored on the Bitcoin or Ethereum blockchain. The credential is stored off-chain (delivered to the recipient as a `.json` file or URL); the blockchain record contains a Merkle root of a batch of issued credentials, allowing any credential's validity to be verified against the on-chain root.

Blockcerts established the important principle that blockchain-anchored credentials can be fully verifiable without a central verification service. However, Blockcerts credentials are not selective: a verifier who receives a credential file sees all fields. There is no ZKP layer, no access control mechanism, and no concept of non-transferability — a Blockcerts credential file is as shareable as a PDF.

### 2.5.5 LinkedIn Credential Verification

LinkedIn has introduced credential verification features through partnerships with third-party verifiers (CLEAR, Persona) that allow users to add a "verified" badge to their education and employment entries [LinkedIn, 2023]. Verification involves submitting government ID or institutional login credentials to the third-party service, which confirms the claim and signals LinkedIn to display the badge.

This model illustrates the state of the art for mainstream professional identity: an ad-hoc, platform-dependent, centralised verification process with no cryptographic guarantees, no user control over data sharing, no privacy-preserving selective disclosure, and no portability beyond the LinkedIn platform. The verification badge is meaningful only insofar as users trust LinkedIn and its verification partners — it has no value outside the platform ecosystem.

---

## 2.6 Research Gap

The survey above reveals a clear and consistent gap in the existing landscape. Table 2.2 positions the five reviewed systems and SoulBound Identity against six design criteria.

**Table 2.2 — Feature comparison across related systems**

| System | Non-transferable tokens | ZKP selective disclosure | Granular access control | On-chain credential storage | Peer reputation | Open/permissionless |
|---|---|---|---|---|---|---|
| Polygon ID | No | Yes | No | No (Merkle root only) | No | Partial |
| Worldcoin | No | Yes (Semaphore) | No | No | No | Partial |
| Civic | No | No | No | No | No | No |
| Blockcerts | No | No | No | No (Merkle root only) | No | Yes |
| LinkedIn Verification | No | No | No | No | No | No |
| **SoulBound Identity** | **Yes (ERC-5484)** | **Yes (Groth16)** | **Yes (bitmask)** | **Yes** | **Yes** | **Yes** |

No existing system combines all six properties. The specific gap is:

1. **SBTs + ZKPs together.** Polygon ID uses ZKPs but not soulbound tokens. Existing SBT implementations (Gitcoin Passport, BAB) use non-transferable tokens but no ZKP selective disclosure. No deployed system combines both.

2. **Granular access control for on-chain credentials.** When credentials are stored on-chain, they are typically either fully public or not stored on-chain at all. No existing system implements a fine-grained, user-controlled access request/approve/deny lifecycle over on-chain credential data.

3. **Integrated peer reputation with ZKP attestation.** Peer reputation systems exist on centralised platforms (LinkedIn endorsements, StackOverflow reputation), but none integrate with on-chain identity or provide ZKP-verified threshold proofs of reputation scores.

4. **A unified platform.** Existing systems address one or two of these properties in isolation, requiring users to manage credentials across multiple platforms and protocols. SoulBound Identity integrates all three subsystems — SBT identity, ZKP credential verification, and peer social reputation — into a single coherent platform with a unified frontend.

This gap justifies the research undertaken in this thesis. The following chapters describe the design (Chapter 3), implementation (Chapter 4), ZKP subsystem (Chapter 5), and evaluation (Chapter 6) of a system that closes it.

---

### References for This Chapter

- Allen, C. (2016). "The Path to Self-Sovereign Identity." *Life with Alacrity* (blog). `https://www.lifewithalacrity.com/article/the-path-to-self-soverereign-identity/`
- Ben-Sasson, E., Bentov, I., Horesh, Y., & Riabzev, M. (2018). "Scalable, transparent, and post-quantum secure computational integrity." *IACR ePrint 2018/046.*
- Buterin, V. (2014). "Ethereum: A Next-Generation Smart Contract and Decentralized Application Platform." `https://ethereum.org/en/whitepaper/`
- Buterin, V. (2022a). "Soulbound." `https://vitalik.ca/general/2022/01/26/soulbound.html`
- Cai, B. (2022). ERC-5484: Consensual Soulbound Tokens. *Ethereum EIPs*. `https://eips.ethereum.org/EIPS/eip-5484`
- Fiat, A., & Shamir, A. (1986). "How to prove yourself: Practical solutions to identification and signature problems." *CRYPTO 1986*, LNCS 263, pp. 186–194.
- Gabizon, A., Williamson, Z.J., & Ciobotaru, O. (2019). "PLONK: Permutations over Lagrange-bases for Oecumenical Noninteractive arguments of Knowledge." *IACR ePrint 2019/953.*
- Goldwasser, S., Micali, S., & Rackoff, C. (1989). "The Knowledge Complexity of Interactive Proof Systems." *SIAM Journal on Computing* 18(1): 186–208.
- Grassi, L., Khovratovich, D., Rechberger, C., Roy, A., & Schofnegger, M. (2019). "Poseidon: A New Hash Function for Zero-Knowledge Proof Systems." *USENIX Security 2021.*
- Groth, J. (2016). "On the Size of Pairing-Based Non-interactive Arguments." *EUROCRYPT 2016*, LNCS 9666, pp. 305–326.
- Hyperledger Foundation. (2022). *Hyperledger Besu* [software]. `https://besu.hyperledger.org/`
- iden3. (2020). *snarkjs* [software]. `https://github.com/iden3/snarkjs`
- iden3. (2022). *circom* [software]. `https://github.com/iden3/circom`
- Nazaré, J., Bhargava, R., & Schmidt, P. (2016). *Digital Certificates Project*. MIT Media Lab.
- OpenZeppelin. (2023). *OpenZeppelin Contracts* [software]. `https://github.com/OpenZeppelin/openzeppelin-contracts`
- Sporny, M. et al. (2019). *Verifiable Credentials Data Model 1.0*. W3C Recommendation. `https://www.w3.org/TR/2019/REC-vc-data-model-20191119/`
- Sporny, M. et al. (2022). *Decentralized Identifiers (DIDs) v1.0*. W3C Recommendation. `https://www.w3.org/TR/did-1.0/`
- Weyl, E.G., Ohlhaver, P., & Buterin, V. (2022). "Decentralized Society: Finding Web3's Soul." *SSRN 4105763.* `https://doi.org/10.2139/ssrn.4105763`
- Wood, G. (2014). "Ethereum: A Secure Decentralised Generalised Transaction Ledger." *Ethereum Yellow Paper.* `https://ethereum.github.io/yellowpaper/paper.pdf`

---

*End of Chapter 2*
