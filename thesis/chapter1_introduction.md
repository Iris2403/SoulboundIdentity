# Chapter 1 — Introduction

## 1.1 The Digital Identity Problem

Consider a recent computer science graduate applying for her first software engineering position. She has a bachelor's degree from a reputable university, two internship contracts, a portfolio of open-source projects, and professional endorsements from colleagues who can vouch for her technical skills. To demonstrate these credentials to a potential employer, she must log into multiple platforms — her university's verification portal, LinkedIn, GitHub, a government e-ID service — and manually compile PDFs, screenshots, and reference letters. The employer, in turn, has no reliable way to distinguish her authentic credentials from fabricated ones without contacting each issuing institution individually. The process is slow, fragmented, and places both parties in a position of institutional dependency and mutual uncertainty.

This scenario is not an edge case. It is the standard experience for billions of professionals worldwide. The management of digital professional identity today is characterised by three interlocking failures: fragmentation, fraud vulnerability, and the absence of meaningful user control.

**Fragmentation.** Professional credentials exist in siloed, incompatible systems controlled by separate institutions — universities, employers, certification bodies, and social networks. There is no universal standard for representing, sharing, or verifying a credential across these boundaries. A W3C Verifiable Credential issued by a European university cannot be natively consumed by an employment platform built on a different data model. A LinkedIn endorsement carries no cryptographic proof of authenticity. A PDF degree certificate can be forged with freely available tools [ACFE, 2024]. The result is that professional identity is reassembled from scratch at every new context, imposing repeated friction and verification overhead on both holders and verifiers [Allen, 2016].

**Fraud.** Credential fraud is a significant and growing problem. Studies by the Association of Certified Fraud Examiners estimate that organisations lose a combined $4.7 trillion annually to occupational fraud, a substantial portion of which involves falsified credentials [ACFE, 2024]. Degree mills — organisations that sell fraudulent academic qualifications — generate hundreds of millions of dollars in revenue annually [Ezell & Bear, 2012]. Traditional verification methods rely on contacting issuing institutions, a process that is slow, expensive, and often impractical at scale. Automated pre-employment screening services fill part of this gap but depend on proprietary databases that are neither complete nor globally interoperable.

**Lack of user control.** Even where credentials are legitimate and verifiable, the individual has little control over how their identity data is used. LinkedIn retains and monetises user profile data. University portals store graduate records indefinitely with no mechanism for the graduate to selectively share or revoke access. Employment background check services aggregate and resell sensitive personal information without meaningful consent mechanisms [GDPR Recital 71, 2016]. The individual is simultaneously the subject of their own credentials and the least powerful actor in the verification ecosystem.

These three failures together constitute what this thesis terms the **digital identity crisis**: a systemic inability of existing infrastructure to provide portable, verifiable, and user-controlled professional credentials.

---

## 1.2 Why Blockchain-Native Identity Matters Now

The emergence of public and consortium blockchains offers a compelling alternative foundation for identity systems. Three properties of distributed ledger technology are particularly relevant.

**Immutability and tamper-evidence.** Once a record is written to a blockchain, altering it requires controlling a majority of the network's consensus participants — a property that makes credential fraud computationally impractical at scale. An employer who queries a credential stored on-chain receives a cryptographic guarantee of authenticity that no PDF certificate or database lookup can provide [Nakamoto, 2008; Buterin, 2014].

**Decentralisation.** Unlike centralised identity providers such as national e-ID systems or social login services, blockchain-based identity is not controlled by any single organisation. Users interact directly with smart contracts; there is no intermediary that can unilaterally revoke access, censor records, or go offline [Allen, 2016]. This property is especially valuable in cross-border professional mobility scenarios where no single jurisdiction's identity infrastructure is universally trusted.

**Programmability.** Smart contracts allow identity and credential logic to be encoded as executable, self-enforcing rules deployed on the blockchain. Access control, credential issuance rules, and verification conditions can all be expressed in code that executes identically for every participant without the need for trusted intermediaries [Szabo, 1997; Wood, 2014].

The maturity of blockchain infrastructure has reached a point where these properties can be exploited for practical identity systems. The Ethereum Virtual Machine (EVM) and its compatible chains support a rich ecosystem of tooling, standards, and developer experience. Enterprise-grade consortium blockchains such as Hyperledger Besu offer the same EVM programmability in a permissioned setting with deterministic finality and predictable transaction costs [Hyperledger, 2022] — properties well-suited to production identity deployments.

The W3C has already recognised this potential through its Decentralised Identifiers (DID) specification [W3C, 2022] and Verifiable Credentials (VC) data model [W3C, 2019], which provide a standards layer above blockchain infrastructure. The missing piece, however, is a concrete, integrated system that combines these standards with mechanisms for non-transferability, granular access control, and privacy-preserving verification. This thesis addresses that gap.

---

## 1.3 Soulbound Tokens as a Paradigm Shift

In January 2022, Vitalik Buterin introduced the concept of "soulbound" tokens — blockchain tokens that are permanently and non-transferably bound to a single wallet address, analogous to the "soulbound" items in the Warcraft video game that cannot be traded once equipped [Buterin, 2022a]. The implications for identity are profound. If a credential is represented as a token that cannot be transferred, sold, or delegated, then possession of the token is itself proof of legitimate ownership. This property cannot be achieved with standard ERC-20 or ERC-721 tokens, which are freely transferable and thus cannot serve as reliable identity attestations.

Buterin, Weyl, and Ohlhaver formalised this concept later in 2022 in the paper "Decentralized Society: Finding Web3's Soul" [Weyl, Ohlhaver & Buterin, 2022], which proposed a broader vision of a "Decentralized Society" (DeSoc) built on a network of non-transferable attestations — educational credentials, employment history, community memberships — stored as Soulbound Tokens (SBTs) in "Soul" wallets. The authors argued that SBTs could serve as the foundation for a pluralistic, bottom-up conception of social trust that complements rather than replaces existing institutions.

The ERC-5484 standard, proposed in 2022 and formalised in 2023, provides a concrete EVM implementation of non-transferable tokens [ERC-5484, 2022]. It extends the ERC-721 NFT standard with a `burnAuth` mechanism that determines who holds the authority to destroy a token: the issuer, the token owner, both parties, or neither. This fine-grained burn control allows different deployment scenarios — a university might mint a degree credential that only the issuer can revoke, while a self-asserted skill badge might be burnable by the owner alone.

SBTs represent a paradigm shift because they reconceive the blockchain token not as a tradeable financial asset but as a verifiable social attestation. This shift opens the possibility of a truly portable, interoperable professional identity that travels with the individual rather than residing in any single platform's database.

---

## 1.4 The Privacy Paradox on Public Blockchains

SBTs introduce a fundamental tension that does not arise in traditional identity systems: the **privacy paradox of public blockchains**.

All data written to a public blockchain is permanently and globally visible. Anyone with a node or access to a block explorer can read every transaction, every contract call, and every stored value. For financial assets, this transparency is a feature — it enables permissionless auditability. For professional credentials, it is a serious liability. A job applicant should be able to prove they hold a degree without revealing their GPA. A contractor should be able to demonstrate sufficient experience without exposing which previous clients they worked for. A professional should be able to share a reputation score above a given threshold without disclosing the exact score or the identities of their reviewers.

Storing raw credential data on-chain solves the fragmentation and fraud problems but creates a new problem: **irreversible disclosure**. Once a credential's details are on the blockchain, they cannot be unwritten. Every employer, competitor, or data aggregator who ever queries the chain has permanent access to every field. This is incompatible with both user autonomy and data protection law (e.g., GDPR's right to data minimisation [GDPR Article 5, 2016]).

Storing credentials off-chain (e.g., on IPFS) and storing only a commitment hash on-chain partially addresses this by making data access controlled. However, hash commitments alone are not sufficient for selective disclosure: if a verifier wants to confirm a specific claim (e.g., "this person's GPA is above 3.5"), they must either receive the full underlying data or trust the holder's assertion without verification.

This is the privacy paradox at the heart of blockchain-based identity: the same properties that make blockchain an excellent platform for tamper-evident credential storage — transparency and global accessibility — undermine the privacy and selective disclosure that meaningful identity management requires.

---

## 1.5 Zero-Knowledge Proofs as the Resolution Mechanism

Zero-knowledge proofs (ZKPs) offer a mathematically rigorous solution to the privacy paradox. A zero-knowledge proof is a cryptographic protocol by which a **prover** can convince a **verifier** that a statement is true without revealing any information beyond the truth of the statement itself [Goldwasser, Micali & Rackoff, 1985].

Applied to credential verification, ZKPs allow a user to prove claims of the form "my GPA is above 3.5", "I have more than three years of work experience", or "my peer reputation score exceeds 70" — without revealing the underlying GPA, the specific employment history, or the individual review scores. The verifier receives a compact cryptographic proof that is either valid or invalid; no intermediate data is disclosed.

Modern ZKP systems — in particular the Groth16 variant of zk-SNARKs (Zero-Knowledge Succinct Non-Interactive Arguments of Knowledge) [Groth, 2016] — produce proofs that are small (approximately 200 bytes), fast to verify, and compatible with the Ethereum Virtual Machine via native elliptic curve precompiles introduced in EIP-196 and EIP-197. This makes on-chain proof verification practical and economically viable.

The ZKP construction used in this thesis proceeds as follows. Credential claims are encoded as arithmetic circuits written in Circom 2 [iden3, 2022], a domain-specific language for ZKP circuit design. The circuit encodes the constraint that a claim holds (e.g., the weighted average of a score array exceeds a threshold) along with commitment checks that bind the proof to specific on-chain data. A trusted setup ceremony produces the proving and verification keys. Users generate Groth16 proofs using snarkjs [iden3, 2020] and submit them to an on-chain verifier contract, which uses the EVM's bn128 precompile to verify the proof in approximately 280,000 gas — a feasible cost for a high-value attestation.

Crucially, ZKPs can be made invisible to end users. The computational complexity of proof generation can be handled by the frontend application (or a supporting backend) without any user-facing interaction. A user experiences only a brief loading state; the cryptographic machinery is entirely abstracted. This property — what this thesis terms **zero-knowledge transparency** — is essential for practical adoption, as professional users cannot be expected to understand or manage cryptographic primitives directly.

By combining SBTs with ZKPs, it becomes possible to design an identity system that achieves what previous approaches could not: credentials that are tamper-evident and non-transferable (from SBTs), selective disclosure of specific claims without full data exposure (from ZKPs), and granular, user-controlled access to underlying data (from smart contract access control).

---

## 1.6 Research Questions

This thesis is structured around three formal research questions derived from the problem statement above.

**RQ1.** *How can a decentralised identity platform based on soulbound tokens protect user privacy while maintaining the cryptographic verifiability of professional credentials?*

This question addresses the privacy paradox directly. The answer must demonstrate not merely that ZKPs exist, but that they can be practically integrated with SBTs in a deployed system — with working circuits, on-chain verifier contracts, and a user experience that does not expose cryptographic complexity.

**RQ2.** *Can zero-knowledge proof systems provide efficient, user-transparent credential verification at scale on an EVM-compatible blockchain?*

This question addresses the practical viability of ZKP-based verification. The answer requires empirical data: proof generation times, circuit constraint counts, on-chain gas costs, and a comparison against alternative approaches. "User-transparent" means the ZKP machinery must be invisible to the end user; "efficient" means the gas cost and latency must be within acceptable bounds for real-world deployment.

**RQ3.** *What is the appropriate design balance between on-chain transparency and selective disclosure in a professional identity system, and what access control mechanisms can mediate this balance?*

This question addresses the system design dimension. Not all credential data warrants ZKP-level privacy; some data should be fully public, some accessible to approved parties only, and some verifiable in aggregate form only. The answer requires a principled access control architecture — the bitmask permission scheme and request/approve/deny lifecycle implemented in this thesis — and an analysis of its correctness and limitations.

---

## 1.7 Scope and Contributions

This thesis presents the design, implementation, and evaluation of **SoulBound Identity**, a decentralised professional identity platform built on the following technology stack: a permissioned Hyperledger Besu QBFT blockchain (Chain ID 424242), four Solidity smart contracts (`SoulboundIdentity`, `CredentialsHub`, `SocialHub`, `ReputationProofRegistry`), five Circom 2 arithmetic circuits with Groth16 proving keys, and a React 18 frontend application.

The primary contributions of this work are:

1. **A complete proof-of-concept implementation** of a SBT-based professional identity platform that integrates ZKP credential verification in a single coherent system — something no existing platform currently provides.

2. **A novel five-circuit ZKP subsystem** covering degree category, GPA threshold, work experience duration, certification domain, and reputation score threshold — each with Groth16 proofs verified on-chain.

3. **A bitmask access control architecture** that encodes per-credential-type access grants as a single `uint256` bitmask, enabling efficient batch operations and a clearly defined request/approve/deny lifecycle.

4. **An empirical evaluation** of ZKP performance (proof generation time, circuit constraint counts, gas costs) in an EVM context, providing a reference baseline for future system designers.

5. **A user-experience design** that makes ZKP generation entirely invisible to end users — contributing a practical template for ZKP UX in consumer-facing blockchain applications.

**Scope limitations.** This is a prototype system deployed on a private consortium network; it is not intended for immediate production deployment. IPFS integration is simulated (CID generation without real pinning). The trusted setup for the ZKP circuits uses a publicly available Powers of Tau ceremony sufficient for a research prototype but not for a production deployment requiring a multi-party computation ceremony. Proof generation is browser-side in the current implementation; server-side proof generation (which would improve scalability and mobile performance) is discussed as future work.

---

## 1.8 Thesis Roadmap

The remainder of this thesis is organised as follows.

**Chapter 2 — Background and Related Work** surveys the relevant literature across four domains: decentralised identity standards (W3C DIDs and Verifiable Credentials), soulbound tokens and the ERC-5484 standard, zero-knowledge proof systems (with a focus on zk-SNARKs and Groth16), and existing deployed systems in the decentralised identity space (Polygon ID, Worldcoin, Civic, MIT Digital Certificates). The chapter concludes with an identification of the research gap that SoulBound Identity addresses.

**Chapter 3 — System Architecture and Design** presents the overall architecture of the system, the threat model and design goals, the smart contract architecture and contract interactions, the credential data model, the access control design, and the ZKP subsystem design. This chapter contains no implementation code; it focuses entirely on design decisions, trade-offs, and rationale.

**Chapter 4 — Implementation** describes how the design was realised in code. It covers the technology stack selection, key smart contract implementation decisions (with code excerpts), the frontend architecture, and the deployment process. The ZKP implementation is treated separately in Chapter 5.

**Chapter 5 — Zero-Knowledge Proof Integration** provides a dedicated treatment of the ZKP subsystem: circuit design methodology, a deep dive into the `reputation_threshold` circuit, the remaining four circuits, the trusted setup process, in-browser proof generation, and on-chain verification.

**Chapter 6 — Evaluation** presents the empirical results: functional evaluation against the five user journeys, gas cost analysis, ZKP performance benchmarks, security analysis, and structured answers to the three research questions.

**Chapter 7 — Conclusion and Future Work** summarises the contributions and findings, revisits the limitations, and proposes directions for future development.

Supporting material — full circuit source code, contract ABI excerpts, gas measurement methodology, and the testing checklist — is provided in the Appendices.

---

*End of Chapter 1*
