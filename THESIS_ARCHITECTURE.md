# Thesis Architecture Options

**Title:** SoulBound Identity — A Decentralized Professional Identity Platform Using Soulbound Tokens and Zero-Knowledge Proofs

**Target length:** 60–80 pages

---

## Option A: Academic / Research-First (62–72 pages)

*Best for: formal academic submission, strong emphasis on literature and theory*

| # | Chapter | Pages |
|---|---------|-------|
| — | Abstract | 1 |
| — | Table of Contents / List of Figures | 2 |
| 1 | Introduction | 8–10 |
| 2 | Background & Related Work | 16–18 |
| 3 | System Design | 12–14 |
| 4 | Implementation | 10–12 |
| 5 | Evaluation & Analysis | 8–10 |
| 6 | Conclusion & Future Work | 5–6 |
| — | Bibliography | 4–6 |

### Chapter Details

**Chapter 1 — Introduction (8–10 pp)**
- The digital identity problem: fragmentation, fraud, lack of user control
- Why blockchain-native identity matters
- Soulbound tokens as a paradigm shift (Buterin's 2022 "Decentralized Society" paper)
- The privacy paradox: blockchain transparency vs. credential sensitivity
- Zero-knowledge proofs as the resolution
- Research questions (3 formal RQs)
- Scope and contributions
- Thesis roadmap

**Chapter 2 — Background & Related Work (16–18 pp)**
- *2.1 Decentralized Identity Landscape* — W3C DIDs, Verifiable Credentials, SSI
- *2.2 Soulbound Tokens* — ERC-5484 standard, Vitalik's original proposal, existing SBT projects
- *2.3 Zero-Knowledge Proofs* — Foundations (completeness, soundness, zero-knowledge), zk-SNARKs, Groth16 vs. PLONK vs. STARKs, Poseidon hash
- *2.4 Smart Contract Systems* — Ethereum EVM, QBFT Besu, OpenZeppelin patterns
- *2.5 Related Systems* — Polygon ID, Worldcoin, Civic, LinkedIn credential verification, academic credential systems (MIT Digital Certificates)
- *2.6 Gaps in Existing Work* — no system combines all three: SBTs + ZKPs + granular access control

**Chapter 3 — System Design (12–14 pp)**
- *3.1 Architecture Overview* — three-layer diagram (Blockchain / ZKP / Frontend)
- *3.2 Threat Model & Design Goals* — privacy, verifiability, censorship resistance, usability
- *3.3 Smart Contract Architecture* — SoulboundIdentity, CredentialsHub, SocialHub, ReputationProofRegistry; data flow and contract interactions
- *3.4 Access Control Model* — bitmask permission system, request/approve/deny lifecycle, rate limiting rationale
- *3.5 ZKP Circuit Design* — circuit selection rationale, Groth16 choice (proof size, EVM gas cost), trusted setup implications, Poseidon commitment scheme
- *3.6 Credential Data Model* — on-chain vs. IPFS off-chain split, 5 credential types, unverified vs. issuer-verified distinction

**Chapter 4 — Implementation (10–12 pp)**
- *4.1 Development Environment* — Besu QBFT, Hardhat, Circom 2, snarkjs, React 18
- *4.2 Smart Contract Implementation* — key design decisions with code excerpts (bitmask access, reentrancy guards, gas optimization)
- *4.3 ZK Circuit Implementation* — 5 circuits with constraint analysis; reputation_threshold circuit deep-dive (private inputs, cross-multiplication trick to avoid division)
- *4.4 In-Browser Proof Generation* — wasm + zkey loading flow, invisible UX design
- *4.5 Frontend Architecture* — component tree, state management, ethers.js integration, MetaMask network auto-config

**Chapter 5 — Evaluation & Analysis (8–10 pp)**
- *5.1 Functional Testing* — end-to-end test scenarios, all 5 ZK circuits verified on-chain
- *5.2 Gas Cost Analysis* — table of all operations (mint: 200K, credential: 150K, ZKP verify: 280K), comparison to alternatives
- *5.3 ZKP Performance* — browser proof generation times, circuit constraint counts, zkey sizes
- *5.4 Security Analysis* — access control correctness, replay attack prevention, rate limiting effectiveness, Groth16 soundness
- *5.5 Answering the Research Questions* — structured answers to the 3 RQs with evidence from implementation

**Chapter 6 — Conclusion & Future Work (5–6 pp)**
- Summary of contributions
- Limitations (trusted setup, mock IPFS, single-user browser proof generation)
- Future work: recursive proofs, multi-attribute selective disclosure, server-side proof generation (Path 2), cross-chain identity

---

## Option B: Engineering / Build-Driven (68–78 pages)

*Best for: CS/software engineering programs, strong emphasis on architecture decisions and implementation depth*

| # | Chapter | Pages |
|---|---------|-------|
| — | Abstract | 1 |
| — | Table of Contents / List of Figures | 2 |
| 1 | Introduction | 7–8 |
| 2 | State of the Art | 10–12 |
| 3 | Requirements & Design Rationale | 10–12 |
| 4 | Smart Contract Architecture | 12–14 |
| 5 | Zero-Knowledge Proof Subsystem | 12–14 |
| 6 | Frontend & Integration | 8–10 |
| 7 | Testing, Results & Discussion | 8–10 |
| 8 | Conclusion | 4–5 |
| — | Bibliography | 4–5 |

### Key Differences vs. Option A

- The single "Implementation" chapter is split into three deep technical chapters (4, 5, 6), each with real code analysis, diagrams, and decision tables
- Chapter 3 explicitly documents *why* each design choice was made (bitmask vs. per-grant, Groth16 vs. alternatives, in-browser vs. VM proof generation)
- Chapter 7 is heavier on quantitative results — gas profiling tables, proof generation benchmarks, circuit constraint counts
- Good fit if your supervisor expects you to defend every technical decision with evidence

---

## Option C: Narrative / Problem-Solution (60–70 pages)

*Best for: interdisciplinary or industry-aligned programs, accessible storytelling arc*

| # | Chapter | Pages |
|---|---------|-------|
| — | Abstract | 1 |
| — | Table of Contents | 1–2 |
| 1 | Introduction — The Identity Crisis | 7–8 |
| 2 | Foundations | 12–14 |
| 3 | Designing SoulBound Identity | 14–16 |
| 4 | Bringing It to Life — Implementation | 12–14 |
| 5 | Does It Work? — Evaluation | 8–10 |
| 6 | Reflection & Future Directions | 5–6 |
| — | Bibliography | 4–5 |

### Key Differences vs. Option A

- More narrative voice — Chapter 1 opens with a concrete scenario (a graduate applying for a job, sharing credentials)
- Chapter 3 is one big unified design chapter that tells the story of how the system came together (requirements → architecture → trade-offs) rather than separating design from implementation
- Fewer formal RQs, more emphasis on "what problem does this solve and how well does it solve it?"
- Lighter on theory, heavier on diagrams and flow explanations
- Good fit if your program values communication and clarity as much as depth

---

## Option D: Hybrid — Recommended (70–80 pages)

*Best for: most university CS/informatics thesis programs*

| # | Chapter | Pages |
|---|---------|-------|
| — | Abstract | 1 |
| — | Table of Contents / List of Figures / Abbreviations | 2–3 |
| 1 | Introduction | 8–10 |
| 2 | Background & Related Work | 12–14 |
| 3 | System Architecture & Design | 14–16 |
| 4 | Implementation | 10–12 |
| 5 | Zero-Knowledge Proof Integration | 10–12 |
| 6 | Evaluation | 8–10 |
| 7 | Conclusion & Future Work | 5–6 |
| — | Bibliography | 5–6 |
| — | Appendices (circuit code, ABI excerpts, test data) | 4–6 |

### Chapter Details

**Chapter 1 — Introduction (8–10 pp)**
- The digital identity problem: fragmentation, fraud, lack of user control
- Why blockchain-native identity matters now
- Soulbound tokens as a paradigm shift
- The privacy paradox on public blockchains
- Zero-knowledge proofs as the resolution mechanism
- Three formal research questions:
  1. How can decentralized identity platforms protect privacy while maintaining verifiability?
  2. Can zero-knowledge proofs provide efficient, user-transparent credential verification at scale?
  3. What is the appropriate balance between on-chain transparency and selective disclosure?
- Scope, contributions, and thesis roadmap

**Chapter 2 — Background & Related Work (12–14 pp)**
- *2.1 Decentralized Identity Landscape* — W3C DIDs, Verifiable Credentials, Self-Sovereign Identity
- *2.2 Soulbound Tokens* — ERC-5484, Buterin et al. "Decentralized Society" (2022), existing SBT implementations
- *2.3 Zero-Knowledge Proofs* — Completeness, soundness, zero-knowledge properties; zk-SNARKs; Groth16 vs. PLONK vs. STARKs; Poseidon hash function
- *2.4 Blockchain Infrastructure* — Ethereum EVM, QBFT consensus, Besu client, OpenZeppelin contract patterns
- *2.5 Related Systems* — Polygon ID, Worldcoin, Civic, MIT Digital Certificates, LinkedIn credential verification
- *2.6 Research Gap* — No existing system combines SBTs + ZKPs + granular access control in a unified platform

**Chapter 3 — System Architecture & Design (14–16 pp)**
- *3.1 Architecture Overview* — three-layer diagram (Blockchain Layer / ZKP Layer / Application Layer)
- *3.2 Design Goals & Threat Model* — privacy, verifiability, non-transferability, usability, censorship resistance; attacker model
- *3.3 Smart Contract Architecture* — four contracts (SoulboundIdentity, CredentialsHub, SocialHub, ReputationProofRegistry); responsibilities, interfaces, interactions
- *3.4 Credential Data Model* — 5 credential types; on-chain fields vs. IPFS metadata; unverified (self-asserted) vs. issuer-verified credentials
- *3.5 Access Control Design* — bitmask permission scheme; request/approve/deny lifecycle; rate limiting and cooldown design decisions
- *3.6 ZKP Subsystem Design* — 5 circuit overview; Groth16 selection rationale (proof size: 3 EC points, EVM precompile support, lowest gas cost); trusted setup implications; Poseidon commitment design
- *3.7 Key Design Trade-offs* — bitmask vs. per-grant access; in-browser vs. server-side proof generation; on-chain vs. off-chain data split

**Chapter 4 — Implementation (10–12 pp)**
- *4.1 Technology Stack* — Besu QBFT (Chain ID 424242), Solidity, Hardhat, Circom 2, snarkjs, React 18 CDN, ethers.js v5.7.2
- *4.2 Smart Contracts* — SoulboundIdentity (ERC-5484, access control, rate limiting); CredentialsHub (5 credential types, issuer system); SocialHub (reputation, projects, endorsements); key code excerpts and gas optimizations (custom errors, EnumerableSet, reentrancy guards)
- *4.3 Frontend Architecture* — component tree; state management; MetaMask integration and network auto-configuration; responsive design system
- *4.4 Deployment* — contract deployment sequence; address registry; QBFT network setup

**Chapter 5 — Zero-Knowledge Proof Integration (10–12 pp)**
- *5.1 Circuit Design Overview* — mapping real-world claims to arithmetic circuits; private vs. public inputs
- *5.2 reputation_threshold Circuit (Deep Dive)* — private inputs (50-element score array), public inputs (threshold, tokenId, scoresCommit); constraints: range check (0–100), sum accumulation, count consistency, cross-multiplication to avoid field division, Poseidon commitment verification
- *5.3 Remaining Circuits* — gpa_threshold, work_experience_threshold, degree_category, cert_domain; design patterns and differences
- *5.4 Trusted Setup & Proving Key Generation* — Powers of Tau ceremony, circuit-specific phase 2, .zkey file generation
- *5.5 In-Browser Proof Generation* — .wasm + .zkey loading flow; snarkjs Groth16 prove; invisible UX — why users never see ZKP complexity
- *5.6 On-Chain Verification* — ReputationProofRegistry; Groth16 verifier contract; gas cost of on-chain proof verification (~280K gas)

**Chapter 6 — Evaluation (8–10 pp)**
- *6.1 Functional Evaluation* — end-to-end test scenarios covering all 5 user journeys; 5 ZK circuits verified on-chain
- *6.2 Gas Cost Analysis* — full operation cost table (mint: ~200K, add credential: ~150K, submit review: ~120K, approve access: ~80K, ZKP verify: ~280K); comparison to naive alternatives
- *6.3 ZKP Performance* — browser-side proof generation timing; circuit constraint counts; .wasm and .zkey file sizes
- *6.4 Security Analysis* — access control correctness; replay attack prevention; rate limiting (10 req/day, 1hr cooldown); Groth16 soundness guarantees
- *6.5 Limitations* — mock IPFS (CID generation without real pinning); trusted setup trust assumptions; browser-only proof generation scalability
- *6.6 Research Question Answers* — structured responses to all 3 RQs with evidence from Chapters 4–5

**Chapter 7 — Conclusion & Future Work (5–6 pp)**
- Summary of contributions (working PoC, 4 contracts, 5 circuits, full frontend)
- Key findings (ZKPs can be invisible to users; bitmask access scales; Groth16 is practical on EVM)
- Limitations revisited
- Future work:
  - Server-side proof generation (Path 2 architecture)
  - Recursive/batch proofs for multi-attribute selective disclosure
  - Real IPFS integration
  - Cross-chain identity portability
  - Full production trusted setup (Multi-Party Computation ceremony)
  - Standardization contribution toward ERC-5484 extensions

**Appendices (4–6 pp)**
- A: Full reputation_threshold.circom source
- B: Contract ABI excerpts
- C: Gas measurement methodology and raw data
- D: TestingGuide summary / evaluation checklist

---

## Why Option D is Recommended

1. **ZKP gets its own chapter** — the ZKP integration is the most novel contribution and deserves dedicated treatment beyond a subsection
2. **Chapter 3 is pure architecture** (no code) — diagrams, data models, access control lifecycle, threat model
3. **Chapter 4 is implementation** (with code excerpts) — the "how we built it" without the ZKP details
4. **Appendices absorb technical detail** that would bloat the main text (full circuit listings, ABI fragments, raw gas tables)
5. The literature review is substantial but not over-padded — 12–14 pp is appropriate for a prototype-focused thesis
6. The page distribution hits 70–80 pages comfortably without artificial padding
