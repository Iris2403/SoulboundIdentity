# Bibliography

**Thesis:** SoulBound Identity — A Decentralized Professional Identity Platform Using Soulbound Tokens and Zero-Knowledge Proofs

All sources are listed alphabetically within each section. Use this as the basis for your reference list. DOIs and URLs are included for every source where available.

---

## 1. Foundational Cryptography & Zero-Knowledge Proofs

**[1]** Goldwasser, S., Micali, S., & Rackoff, C. (1989). The knowledge complexity of interactive proof systems. *SIAM Journal on Computing*, 18(1), 186–208.
DOI: [10.1137/0218012](https://doi.org/10.1137/0218012)
> *The original paper that defined zero-knowledge proofs. Essential citation for any ZKP thesis.*

**[2]** Bitansky, N., Canetti, R., Chiesa, A., & Tromer, E. (2012). From extractable collision resistance to succinct non-interactive arguments of knowledge, and back again. In *Proceedings of the 3rd Innovations in Theoretical Computer Science Conference (ITCS '12)* (pp. 326–349). ACM.
DOI: [10.1145/2090236.2090263](https://doi.org/10.1145/2090236.2090263)
> *Introduced the term zk-SNARK and formalized the framework; cite when introducing zk-SNARKs.*

**[3]** Groth, J. (2016). On the size of pairing-based non-interactive arguments. In *Advances in Cryptology – EUROCRYPT 2016*, Lecture Notes in Computer Science, Vol. 9666 (pp. 305–326). Springer.
DOI: [10.1007/978-3-662-49896-5_11](https://doi.org/10.1007/978-3-662-49896-5_11)
ePrint: [https://eprint.iacr.org/2016/260.pdf](https://eprint.iacr.org/2016/260.pdf)
> *The "Groth16" paper. Proof consists of 3 group elements; lowest on-chain verification cost. Core justification for using Groth16 in this thesis.*

**[4]** Grassi, L., Khovratovich, D., Rechberger, C., Roy, A., & Schofnegger, M. (2021). Poseidon: A new hash function for zero-knowledge proof systems. In *Proceedings of the 30th USENIX Security Symposium* (pp. 519–535). USENIX Association.
ePrint: [https://eprint.iacr.org/2019/458](https://eprint.iacr.org/2019/458)
Full text: [https://www.usenix.org/conference/usenixsecurity21/presentation/grassi](https://www.usenix.org/conference/usenixsecurity21/presentation/grassi)
> *The Poseidon hash function used in the reputation_threshold circuit's commitment scheme. Up to 8x fewer constraints per bit than Pedersen Hash.*

**[5]** Bowe, S., Gabizon, A., & Miers, I. (2017). Scalable multi-party computation for zk-SNARK parameters in the random beacon model. Cryptology ePrint Archive, Paper 2017/1050.
URL: [https://eprint.iacr.org/2017/1050](https://eprint.iacr.org/2017/1050)
> *The "Powers of Tau" ceremony design — the multi-party computation (MPC) trusted setup used when generating .zkey files for Groth16 circuits.*

---

## 2. ZKP Tools & Circuit Languages

**[6]** Bellés-Muñoz, M., Baylina, J., Daza, V., & Muñoz-Tapia, J. L. (2023). Circom: A circuit description language for building zero-knowledge applications. *IEEE Transactions on Dependable and Secure Computing*, 20(6), 3426–3439.
DOI: [10.1109/TDSC.2022.3232813](https://doi.org/10.1109/TDSC.2022.3232813)
IEEE Xplore: [https://ieeexplore.ieee.org/document/10002421](https://ieeexplore.ieee.org/document/10002421)
> *The peer-reviewed paper describing Circom 2, the circuit compiler used for all 5 ZK circuits in this thesis.*

**[7]** iden3. (2023). *snarkjs: zkSNARK library in JavaScript & Pure WASM* (v0.7.x). GitHub.
URL: [https://github.com/iden3/snarkjs](https://github.com/iden3/snarkjs)
> *The JavaScript/WebAssembly library used for in-browser Groth16 proof generation and verification.*

---

## 3. Soulbound Tokens

**[8]** Weyl, E. G., Ohlhaver, P., & Buterin, V. (2022). Decentralized society: Finding Web3's soul. SSRN Working Paper 4105763.
URL: [https://ssrn.com/abstract=4105763](https://ssrn.com/abstract=4105763)
Microsoft Research: [https://www.microsoft.com/en-us/research/publication/decentralized-society-finding-web3s-soul/](https://www.microsoft.com/en-us/research/publication/decentralized-society-finding-web3s-soul/)
> *The founding paper that introduced "soulbound tokens" as non-transferable credentials representing commitments, affiliations, and social identity on-chain.*

**[9]** Chalkiadakis, T. (2022). ERC-5484: Consensual soulbound tokens. *Ethereum Improvement Proposals*.
URL: [https://eips.ethereum.org/EIPS/eip-5484](https://eips.ethereum.org/EIPS/eip-5484)
> *The token standard directly implemented in SoulboundIdentity.sol. Defines non-transferability, burn authorization levels, and ERC-721 compatibility.*

**[10]** Kakebayashi, M., & Beverley, J. (2023). Soulbound tokens (SBTs) study report part 1: Building and embracing a new social identity layer. SSRN Working Paper 4449592. Blockchain Governance Initiative Network (BGIN).
URL: [https://ssrn.com/abstract=4449592](https://ssrn.com/abstract=4449592)
> *Structured analysis of SBT use cases, governance implications, and deployment considerations.*

**[11]** Alonso, J. M., Gordo, M., Puig, L., & Puig, V. (2024). Soulbound token applications: A case study in the health sector. *Distributed Ledger Technologies: Research and Practice*, 3(3), Article 30.
DOI: [10.1145/3674155](https://doi.org/10.1145/3674155)
> *Peer-reviewed case study on real-world SBT deployment, including credential management and identity proofs in a regulated domain.*

**[12]** Al-Breiki, H., et al. (2024). Soulbound tokens: Enabler for privacy-aware and decentralized authentication mechanism in medical data storage. *Blockchain in Healthcare Today*, 7(1).
PubMed: [https://pubmed.ncbi.nlm.nih.gov/39649415/](https://pubmed.ncbi.nlm.nih.gov/39649415/)
PMC: [https://pmc.ncbi.nlm.nih.gov/articles/PMC11624496/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11624496/)
> *Demonstrates privacy-aware SBT architectures combining SSI and soulbound tokens — directly comparable to this thesis's design.*

---

## 4. Decentralized Identity Standards

**[13]** Sporny, M., Longley, D., Sabadello, M., Reed, D., Steele, O., & Allen, C. (2022). Decentralized identifiers (DIDs) v1.0. W3C Recommendation, 19 July 2022. World Wide Web Consortium.
URL: [https://www.w3.org/TR/did-1.0/](https://www.w3.org/TR/did-1.0/)
> *The W3C standard for globally unique, cryptographically verifiable identifiers. Provides the identity infrastructure context for this thesis.*

**[14]** Sporny, M., Longley, D., Chadwick, D., et al. (2022). Verifiable credentials data model v1.1. W3C Recommendation, 3 March 2022. World Wide Web Consortium.
URL: [https://www.w3.org/TR/vc-data-model-1.1/](https://www.w3.org/TR/vc-data-model-1.1/)
> *The W3C standard defining the credential data model (issuer, holder, verifier triad) that informs the CredentialsHub design.*

---

## 5. Self-Sovereign Identity

**[15]** Soltani, R., Nguyen, U. T., & An, A. (2021). A survey of self-sovereign identity ecosystem. *Security and Communication Networks*, 2021, Article 8873429.
DOI: [10.1155/2021/8873429](https://doi.org/10.1155/2021/8873429)
URL: [https://onlinelibrary.wiley.com/doi/10.1155/2021/8873429](https://onlinelibrary.wiley.com/doi/10.1155/2021/8873429)
> *Comprehensive survey of the SSI landscape including DIDs, VCs, digital wallets, and blockchain's role in realising SSI requirements.*

**[16]** Čučko, Š., Keršič, V., & Turkanović, M. (2022). Blockchain-based identity management system and self-sovereign identity ecosystem: A comprehensive survey. *IEEE Access*, 10, 113606–113633.
DOI: [10.1109/ACCESS.2022.3213100](https://doi.org/10.1109/ACCESS.2022.3213100)
IEEE Xplore: [https://ieeexplore.ieee.org/document/9927415](https://ieeexplore.ieee.org/document/9927415)
> *Recent comprehensive IEEE survey covering DID-based identity management and SSI ecosystem — directly supports the related work chapter.*

**[17]** Ferdous, M. S., Chowdhury, M. J. M., & Alassafi, M. O. (2019). In search of self-sovereign identity leveraging blockchain technology. *IEEE Access*, 7, 103059–103079.
DOI: [10.1109/ACCESS.2019.2931173](https://doi.org/10.1109/ACCESS.2019.2931173)
> *Analysis of the motivations and technical requirements for blockchain-based SSI, including key management and privacy.*

---

## 6. Anonymous Credentials & Selective Disclosure

**[18]** Camenisch, J., & Lysyanskaya, A. (2001). Efficient non-transferable anonymous multi-show credential system with optional anonymity revocation. In *Advances in Cryptology – EUROCRYPT 2001*, Lecture Notes in Computer Science, Vol. 2045 (pp. 93–118). Springer.
DOI: [10.1007/3-540-44987-6_7](https://doi.org/10.1007/3-540-44987-6_7)
> *The foundational CL signature scheme that enabled selective disclosure of credential attributes — the theoretical precursor to ZKP-based credentials.*

**[19]** Camenisch, J., & Gross, T. (2012). Efficient attributes for anonymous credentials. *ACM Transactions on Information and System Security*, 15(1), Article 4.
DOI: [10.1145/2133375.2133379](https://doi.org/10.1145/2133375.2133379)
ePrint: [https://eprint.iacr.org/2010/496](https://eprint.iacr.org/2010/496)
> *Extends CL credentials to allow highly efficient selective attribute disclosure — theoretical foundation for privacy-preserving credential systems.*

**[20]** Soltani, R., et al. (2024). Selective disclosure in digital credentials: A review. *ICT Express*, 10(3), 614–626.
DOI: [10.1016/j.icte.2024.01.005](https://doi.org/10.1016/j.icte.2024.01.005)
ScienceDirect: [https://www.sciencedirect.com/science/article/pii/S2405959524000614](https://www.sciencedirect.com/science/article/pii/S2405959524000614)
> *Recent survey of selective disclosure mechanisms relevant to this thesis's ZKP-based approach.*

---

## 7. Privacy-Preserving Credential Systems (Related Systems)

**[21]** Constantinides, T., & Cartlidge, J. P. (2023). BlockVerify: Privacy-preserving zero-knowledge credentials verification framework on Ethereum. In *Proceedings of the 35th European Modelling and Simulation Symposium (EMSS 2023)*.
PDF: [https://www.cal-tek.eu/proceedings/i3m/2023/emss/022/pdf.pdf](https://www.cal-tek.eu/proceedings/i3m/2023/emss/022/pdf.pdf)
Bristol Research: [https://research-information.bris.ac.uk/en/publications/blockverify-privacy-preserving-zero-knowledge-credentials-verific/](https://research-information.bris.ac.uk/en/publications/blockverify-privacy-preserving-zero-knowledge-credentials-verific/)
> *A closely related system enabling ZKP-based attribute verification on Ethereum without revealing raw credential data — key comparison point.*

**[22]** (Author TBC). (2024). CrossCert: A privacy-preserving cross-chain system for educational credential verification using zero-knowledge proof. In *Lecture Notes in Computer Science*. Springer.
DOI: [10.1007/978-3-031-67357-3_18](https://doi.org/10.1007/978-3-031-67357-3_18)
> *Cross-chain ZKP credential verification for education — useful comparison for scalability and interoperability discussion.*

**[23]** Liu, Z., et al. (2023). Leveraging zero knowledge proofs for blockchain-based identity sharing: A survey of advancements, challenges and opportunities. *Journal of Information Security and Applications*, 80, 103678.
DOI: [10.1016/j.jisa.2023.103678](https://doi.org/10.1016/j.jisa.2023.103678)
ScienceDirect: [https://www.sciencedirect.com/science/article/pii/S2214212623002624](https://www.sciencedirect.com/science/article/pii/S2214212623002624)
> *Survey of ZKP applications in blockchain identity sharing — directly supports the related work and evaluation chapters.*

**[24]** Polygon Technology. (2022). Introducing Polygon ID: Zero-knowledge identity for Web3. Polygon Blog.
URL: [https://polygon.technology/blog/introducing-polygon-id-zero-knowledge-own-your-identity-for-web3](https://polygon.technology/blog/introducing-polygon-id-zero-knowledge-own-your-identity-for-web3)
> *Industry implementation of ZKP-based decentralized identity using Iden3/Circom — the closest production system to this thesis.*

**[25]** World Foundation. (2023). *World: Protocol whitepaper*. World.
URL: [https://whitepaper.world.org](https://whitepaper.world.org)
> *Worldcoin/World ID proof-of-personhood system using iris biometrics + ZKPs — important comparison for biometric vs. credential-based identity approaches.*

**[26]** Schmidt, P., & Haag, M. (2016). Blockcerts: An open infrastructure for academic credentials on the blockchain. MIT Media Lab.
URL: [https://medium.com/mit-media-lab/blockcerts-an-open-infrastructure-for-academic-credentials-on-the-blockchain-899a6b880b2f](https://medium.com/mit-media-lab/blockcerts-an-open-infrastructure-for-academic-credentials-on-the-blockchain-899a6b880b2f)
Project page: [https://certificates.media.mit.edu/](https://certificates.media.mit.edu/)
> *MIT's pioneering blockchain credential system — establishes the prior art for academic credential management on-chain.*

---

## 8. Blockchain Infrastructure & Smart Contracts

**[27]** Nakamoto, S. (2008). Bitcoin: A peer-to-peer electronic cash system. Self-published.
URL: [https://bitcoin.org/en/bitcoin-paper](https://bitcoin.org/en/bitcoin-paper)
> *The foundational blockchain paper. Cite in Chapter 2 when introducing the blockchain concept.*

**[28]** Wood, G. (2014). Ethereum: A secure decentralised generalised transaction ledger. Ethereum Project Yellow Paper (EIP-150 revision). Berlin Version.
URL: [https://ethereum.github.io/yellowpaper/paper.pdf](https://ethereum.github.io/yellowpaper/paper.pdf)
GitHub: [https://github.com/ethereum/yellowpaper](https://github.com/ethereum/yellowpaper)
> *The formal specification of the EVM. Cite when describing smart contract execution, gas cost model, and state transitions.*

**[29]** Entriken, W., Shirley, D., Evans, J., & Sachs, N. (2018). ERC-721: Non-fungible token standard. *Ethereum Improvement Proposals*, EIP-721.
URL: [https://eips.ethereum.org/EIPS/eip-721](https://eips.ethereum.org/EIPS/eip-721)
> *The NFT standard that ERC-5484 (SoulboundIdentity.sol) extends. Required citation when introducing the token architecture.*

**[30]** Hyperledger Besu Contributors. (2024). *Hyperledger Besu documentation* (v24.x). Linux Foundation / LF Decentralized Trust.
URL: [https://besu.hyperledger.org/](https://besu.hyperledger.org/)
> *Official documentation for the enterprise Ethereum client used as the network infrastructure in this thesis.*

**[31]** Enterprise Ethereum Alliance. (2021). *EEA QBFT blockchain consensus protocol specification*. Enterprise Ethereum Alliance.
URL: [https://entethalliance.org/eea-publishes-qbft-blockchain-consensus-protocol/](https://entethalliance.org/eea-publishes-qbft-blockchain-consensus-protocol/)
> *The published specification for QBFT — the Byzantine Fault Tolerant consensus algorithm used by the thesis's Besu network.*

**[32]** OpenZeppelin. (2024). *OpenZeppelin Contracts v5.x: A library for secure smart contract development*. OpenZeppelin / GitHub.
URL: [https://github.com/OpenZeppelin/openzeppelin-contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)
Docs: [https://docs.openzeppelin.com/contracts](https://docs.openzeppelin.com/contracts)
> *The security library providing Ownable, ReentrancyGuard, and EnumerableSet used across all contracts.*

---

## 9. Smart Contract Security

**[33]** Wang, W., Song, J., Xu, G., Li, Y., Wang, H., & Su, C. (2023). ContractWard: Automated vulnerability detection models for Ethereum smart contracts. *Information and Software Technology*, 159, 107221.
DOI: [10.1016/j.infsof.2023.107221](https://doi.org/10.1016/j.infsof.2023.107221)
ACM: [https://dl.acm.org/doi/10.1016/j.infsof.2023.107221](https://dl.acm.org/doi/10.1016/j.infsof.2023.107221)
> *Survey of 49 smart contract vulnerabilities including reentrancy — supports the security analysis of this thesis's contracts.*

**[34]** Praitheeshan, P., et al. (2019). Security analysis methods on Ethereum smart contract vulnerabilities: A survey. arXiv:1908.08605.
URL: [https://arxiv.org/abs/1908.08605](https://arxiv.org/abs/1908.08605)
> *Covers reentrancy, integer overflow, and other EVM vulnerabilities; useful background for Chapter 6 security analysis.*

---

## 10. Distributed Storage

**[35]** Benet, J. (2014). IPFS — Content addressed, versioned, P2P file system. arXiv:1407.3561.
URL: [https://arxiv.org/abs/1407.3561](https://arxiv.org/abs/1407.3561)
Protocol Labs: [https://research.protocol.ai/publications/ipfs-content-addressed-versioned-p2p-file-system/](https://research.protocol.ai/publications/ipfs-content-addressed-versioned-p2p-file-system/)
> *The original IPFS paper. Cite when describing the off-chain metadata storage architecture (CIDs stored on-chain, content on IPFS).*

---

## 11. Survey Papers for Literature Review

**[36]** Mukta, R., et al. (2023). A survey on blockchain-based privacy applications: An analysis of consent management and self-sovereign identity approaches. arXiv:2411.16404.
URL: [https://arxiv.org/html/2411.16404v1](https://arxiv.org/html/2411.16404v1)
> *Recent survey bridging consent management, SSI, and blockchain privacy — contextualises this thesis in the broader landscape.*

**[37]** Zheng, Z., et al. (2020). An overview of blockchain technology: Architecture, consensus, and future trends. In *2017 IEEE International Congress on Big Data* (pp. 557–564). IEEE.
DOI: [10.1109/BigDataCongress.2017.85](https://doi.org/10.1109/BigDataCongress.2017.85)
> *Widely-cited blockchain overview paper; suitable for Chapter 2 background on blockchain fundamentals.*

**[38]** Nitulescu, A. (2020). zk-SNARKs: A gentle introduction. École Normale Supérieure / CNRS.
PDF: [https://www.di.ens.fr/~nitulesc/files/Survey-SNARKs.pdf](https://www.di.ens.fr/~nitulesc/files/Survey-SNARKs.pdf)
> *Accessible survey covering SNARK definitions, constructions, and comparisons (Groth16 vs. PLONK vs. STARKs). Good citation for the ZKP background section.*

---

## Quick Reference: Which Chapter Uses Which Sources

| Chapter | Key Sources |
|---------|------------|
| Ch.1 Introduction | [8], [13], [27], [28] |
| Ch.2 Background & Related Work | [1], [2], [3], [4], [6], [8], [9], [13], [14], [15], [16], [18], [19], [38] |
| Ch.3 System Architecture & Design | [9], [13], [14], [29], [30], [31], [32], [35] |
| Ch.4 Implementation | [6], [7], [30], [31], [32] |
| Ch.5 ZKP Integration | [3], [4], [5], [6], [7], [38] |
| Ch.6 Evaluation | [21], [22], [23], [33], [34] |
| Related Work (throughout) | [10], [11], [12], [20], [21], [22], [24], [25], [26] |

---

## Notes

- Sources marked with ePrint URLs are freely accessible without institutional access.
- IEEE Xplore sources ([6], [16], [17]) require institutional login or purchase.
- [8] (Buterin et al.) is a working paper on SSRN — check whether your institution requires peer-reviewed journal sources and supplement if so.
- [24] (Polygon ID) and [25] (World/Worldcoin) are technical whitepapers — cite as "Technical Report" or "White Paper" in your reference list.
- [32] (OpenZeppelin) is a software library — cite as software/code with version number.
- Verify all DOIs before final submission using [https://doi.org](https://doi.org).
