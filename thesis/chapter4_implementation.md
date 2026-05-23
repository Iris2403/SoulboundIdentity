# Chapter 4 — Implementation

This chapter describes how the architecture presented in Chapter 3 was realised in code. Section 4.1 surveys the technology stack and explains each tool choice. Section 4.2 covers the smart contract implementation, highlighting key engineering decisions with code excerpts. Section 4.3 describes the frontend architecture — its component structure, state management, and MetaMask integration. Section 4.4 documents the deployment sequence and the deployed contract address registry. The ZKP circuit implementation is treated separately in Chapter 5.

---

## 4.1 Technology Stack

### 4.1.1 Blockchain Runtime: Hyperledger Besu with QBFT

The system is deployed on a permissioned Hyperledger Besu network running the QBFT consensus protocol with Chain ID 424242. The network is accessible at `https://rpc.dimikog.org/rpc/` via a standard JSON-RPC endpoint compatible with all Ethereum tooling. QBFT was chosen over Clique (Proof-of-Authority) and standard Proof-of-Work/Proof-of-Stake for its immediate, deterministic finality — once a block is committed under QBFT, no reorganisation is possible, which makes access grants and credential additions immediately irrevocable.

The EVM compatibility of Besu is complete: all Solidity features up to version 0.8.20 are supported, OpenZeppelin libraries compile without modification, and the BN128 elliptic curve precompiles required for Groth16 on-chain verification (EIP-196 and EIP-197) are present.

### 4.1.2 Smart Contract Language and Toolchain

**Solidity 0.8.20** is used for all four contracts. Version 0.8.x was selected for its built-in arithmetic overflow protection (eliminating the need for SafeMath) and its native support for custom errors (introduced in 0.8.4), which reduce revert gas costs compared to string-based `require` messages.

**Hardhat** serves as the development and deployment framework. Its local Hardhat Network (a fast in-process EVM) was used throughout development for unit testing before deploying to the Besu node. Hardhat's task system provides scriptable deployment with deployment address capture.

**OpenZeppelin Contracts v5** provides the audited base contracts used across the system: `ERC721Enumerable` (extended by the ERC-5484 implementation), `Ownable`, `ReentrancyGuard`, `Pausable`, and `EnumerableSet`.

### 4.1.3 ZKP Toolchain

**Circom 2** is used to write all five arithmetic circuits. Circom 2 introduced a new template system with explicit signal types (`input`, `output`, `intermediate`) and improved constraint optimisation compared to Circom 1. The compiler produces `.r1cs` (constraint system), `.wasm` (witness generator), and `.sym` (symbol table) artefacts.

**snarkjs v0.7** is used for the trusted setup (Powers of Tau and circuit-specific phase 2), proving key generation (`.zkey` files), Groth16 proof generation, and Solidity verifier contract export. The `groth16.fullProve()` function in snarkjs accepts the circuit `.wasm`, the `.zkey`, and the input JSON, and returns the proof and public signals in the format expected by the on-chain verifier.

### 4.1.4 Frontend Stack

The frontend is a single-page application built without a bundler or build server. This was a deliberate choice to minimise tooling friction for a prototype: the application runs directly in a browser by serving static files.

- **React 18.2.0** is loaded from the unpkg CDN as a UMD build. React hooks (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`, `useContext`) are exposed as global variables on `window` so that all component files can use them without ES module imports.
- **ethers.js v5.7.2** is loaded from cdnjs as a UMD build. The v5 API was chosen over v6 for its stability and the larger volume of available reference implementations for contract interaction patterns.
- **QRious 4.0.2** provides QR code generation for token sharing, loaded from cdnjs.
- **Babel** (`@babel/preset-react`) transpiles JSX syntax in the component source files to standard JavaScript. The build step (`npm run build`) produces a `dist/` directory; the HTML file loads pre-compiled output. This avoids requiring a full webpack/Vite pipeline while still allowing JSX authoring.

---

## 4.2 Smart Contract Implementation

### 4.2.1 Gas Optimisation Patterns

All four contracts apply a consistent set of gas optimisation techniques.

**Custom errors.** All revert conditions use custom errors declared at the contract level rather than `require` with string messages. Strings are stored in the contract bytecode and cost calldata gas when the error is triggered; custom errors encode only a 4-byte selector plus any parameters.

```solidity
// Gas-efficient: 4-byte selector, no string storage
error TooManyRequests();
error RequestCooldown(uint256 timeRemaining);

// Used in place of:
// require(_requestCount[requester] < MAX_REQUESTS_PER_DAY, "Too many requests");
if (_requestCount[requester] >= MAX_REQUESTS_PER_DAY) revert TooManyRequests();
```

**`unchecked` arithmetic.** Counter increments and loop indices that cannot realistically overflow are wrapped in `unchecked` blocks to bypass the Solidity 0.8.x overflow checker, saving approximately 80 gas per operation.

```solidity
unchecked {
    tokenId = ++_tokenIdCounter;   // counter can never reach uint256 max
}

for (uint256 i = 0; i < count; ) {
    // loop body
    unchecked { ++i; }             // i < count guarantees no overflow
}
```

**`EnumerableSet` for pending requesters.** The set of addresses with a pending access request for a given token is stored as an `EnumerableSet.AddressSet`. This data structure provides O(1) add and remove operations (unlike an array, which requires a linear scan to remove an element) and supports full enumeration for the paginated `getPendingRequests` view. When a request is approved or denied, the requester is removed from the set in O(1) without shifting other elements.

**`uint64` for timestamps.** All block timestamps and durations are stored as `uint64` rather than `uint256`. A `uint64` can represent timestamps up to the year 584,542 — more than sufficient — while fitting two timestamps into a single 32-byte storage slot alongside other fields (slot packing), saving one `SLOAD`/`SSTORE` per access.

### 4.2.2 SoulboundIdentity: ERC-5484 and Non-Transferability

`SoulboundIdentity` extends an `ERC5484` base contract that itself extends `ERC721Enumerable`. The non-transferability invariant is enforced at the base contract level by overriding `_beforeTokenTransfer` to revert unconditionally on any transfer that is not a mint (token transferred from the zero address) or an authorised burn:

The contract enforces one token per address at the `mint` function level:

```solidity
function mint(string calldata ipfsCID, BurnAuth burnAuth) external returns (uint256) {
    if (balanceOf(msg.sender) > 0) revert AlreadyHasToken();
    return _mint(msg.sender, ipfsCID, burnAuth);
}
```

IPFS CID validation is performed before storing the CID to prevent invalid references from being committed on-chain. The validator accepts both CIDv0 (base58, `Qm...`, 46 characters) and CIDv1 (base32, `b...`, minimum 59 characters) formats, checking character-set validity:

```solidity
function _isValidCID(string memory cid) internal pure returns (bool) {
    bytes memory b = bytes(cid);
    uint256 len = b.length;
    if (len < 46 || len > 100) return false;

    if (b[0] == "Q" && b[1] == "m") {
        if (len != 46) return false;
        // validate base58 character set...
        return true;
    }
    if (b[0] == "b") {
        if (len < 59) return false;
        // validate CIDv1 multibase prefix...
        return true;
    }
    return false;
}
```

### 4.2.3 SoulboundIdentity: Rate Limiting Implementation

The rate limiting system uses a day-boundary approach. Each address has a `_requestCount` (number of requests today) and a `_lastResetDay` (the day index when the count was last reset). The day index is computed as `block.timestamp / 1 days` — a deterministic, manipulation-resistant value.

```solidity
function _checkAndUpdateRateLimit(address requester) internal {
    uint256 currentDay = block.timestamp / 1 days;

    if (currentDay > _lastResetDay[requester]) {
        _requestCount[requester] = 0;
        _lastResetDay[requester] = currentDay;
    }

    if (_requestCount[requester] >= MAX_REQUESTS_PER_DAY) revert TooManyRequests();

    unchecked { _requestCount[requester]++; }
}
```

The per-token cooldown is checked separately in `requestAccess` by comparing `block.timestamp` against `_lastRequestTime[msg.sender][tokenId] + REQUEST_COOLDOWN`. If the cooldown has not elapsed, the error includes the remaining wait time — enabling the frontend to display a meaningful countdown:

```solidity
if (block.timestamp < lastRequest + REQUEST_COOLDOWN) {
    revert RequestCooldown((lastRequest + REQUEST_COOLDOWN) - block.timestamp);
}
```

### 4.2.4 CredentialsHub: The Issuer System

`CredentialsHub` distinguishes two paths for adding credentials: the self-assert path (`addCredential`, `addDegreeCredential`, `addCertificationCredential`) callable by the token owner, which sets `verified = false`; and the issuer path (`issueCredential`, `issueDegreeCredential`, `issueCertificationCredential`) callable only by addresses in the `authorizedIssuers` mapping, which sets `verified = true`.

The `onlyAuthorizedIssuer` modifier enforces this at the function level:

```solidity
modifier onlyAuthorizedIssuer(CredentialType credType) {
    if (!authorizedIssuers[credType][msg.sender]) revert NotAuthorizedIssuer();
    _;
}
```

Issuer authorisation is per credential type, not global. A university authorised to issue `Degree` credentials cannot issue `Certification` or `WorkExperience` credentials under the same authorisation. This granularity prevents authorised issuers from exceeding their intended scope.

### 4.2.5 CredentialsHub: Bitmask Access Check

The access check for credential type queries is implemented as a single bitwise expression evaluated in the `_canAccessType` internal helper:

```solidity
function _canAccessType(uint256 tokenId, CredentialType credType) internal view returns (bool) {
    if (msg.sender == identity.ownerOf(tokenId)) return true;
    return (grantedTypes[tokenId][msg.sender] >> uint8(credType)) & 1 == 1;
}
```

The token owner always has full access (the first branch). For any other caller, the `credType` enum value (0–4) is used as a bit position: shifting the stored `uint8` right by `credType` positions and ANDing with 1 extracts the permission bit. This entire check costs approximately 200 gas (one `SLOAD` for `grantedTypes` plus the bitwise operations), with no branching over credential type cases.

### 4.2.6 SocialHub: Cached Reputation Totals

A naive implementation of `getReputationSummary` would iterate over all stored reviews to compute the average score — an O(n) operation that becomes expensive as review counts grow. `SocialHub` avoids this by maintaining three cached accumulators updated on every `submitReview` call:

```solidity
// Updated atomically with each review submission:
unchecked {
    _runningScoreTotal[subjectTokenId] += score;
    _reviewCount[subjectTokenId]++;
    if (verified) _verifiedCount[subjectTokenId]++;
}

// O(1) summary read — no iteration:
function getReputationSummary(uint256 tokenId) external view returns (ReputationSummary memory) {
    uint256 count = _reviewCount[tokenId];
    if (count == 0) return ReputationSummary(0, 0, 0);
    return ReputationSummary({
        averageScore: _runningScoreTotal[tokenId] / count,
        totalReviews: count,
        verifiedReviews: _verifiedCount[tokenId]
    });
}
```

These cached values are also the inputs to the `reputation_threshold` ZKP circuit: the circuit proves that `_runningScoreTotal / _reviewCount >= threshold` using the cross-multiplication technique described in Chapter 5.

The duplicate-review guard uses a `mapping(uint256 => mapping(uint256 => bool)) private hasReviewedMap` keyed by `(reviewerTokenId, subjectTokenId)`. Checking and setting this mapping is O(1) and prevents a single reviewer from inflating a subject's score by submitting multiple reviews.

### 4.2.7 ReputationProofRegistry: Minimal Verifier Wrapper

`ReputationProofRegistry` is intentionally the simplest contract in the system. It wraps the auto-generated Groth16 verifier behind a single public function:

```solidity
function recordProof(
    uint256 tokenId,
    uint[2] calldata _pA,
    uint[2][2] calldata _pB,
    uint[2] calldata _pC,
    uint[1] calldata _pubSignals
) external {
    require(verifier.verifyProof(_pA, _pB, _pC, _pubSignals), "Invalid proof");
    uint256 threshold = _pubSignals[0];
    if (threshold > provenThreshold[tokenId]) {
        provenThreshold[tokenId] = threshold;
        emit ProofRecorded(tokenId, threshold);
    }
}
```

The proof parameters (`_pA`, `_pB`, `_pC`) are the three elliptic curve points of the Groth16 proof. `_pubSignals[0]` carries the threshold value — the single public signal of the `reputation_threshold` circuit. The registry only updates the stored threshold if the newly proven threshold is strictly higher than the existing record, making the mapping monotonically non-decreasing per token.

---

## 4.3 Frontend Architecture

### 4.3.1 Component Structure

The frontend is divided into 19 JavaScript files, each exposing a single React component as a global variable. The load order in `index.html` reflects the dependency graph: foundation components (`theme.js`, `toast.js`, `ui.js`) load first; the root `app-component.js` loads after all utilities; tab and section components load last.

```
AppRoot
└── ThemeProvider
    └── ToastProvider
        └── App (app-component.js)
            ├── Header (header.js)
            ├── Welcome (welcome.js)          — shown before wallet connection
            ├── Navigation (navigation.js)
            └── [active tab]
                ├── IdentityTab (identity-tab.js)
                │   ├── TokenCard (token-card.js)
                │   └── QRCode (qr-code.js)
                ├── CredentialsTab (credentials-tab.js)
                ├── AccessControlTab (access-control-tab.js)
                ├── SocialTab (social-tab.js)
                │   ├── ReputationSection (reputation-section.js)
                │   ├── ProjectsSection (projects-section.js)
                │   └── EndorsementsSection (endorsements-section.js)
                ├── ViewIdentitiesTab (view-identities-tab.js)
                └── AnalyticsTab (analytics-tab.js)
```

**Figure 4.1 — Component tree**

### 4.3.2 Application State

All application-level state is held in the root `App` component and passed down through props. The principal state variables are:

| State variable | Type | Purpose |
|---|---|---|
| `account` | `string \| null` | Connected wallet address |
| `provider` | `Web3Provider \| null` | ethers.js provider wrapping MetaMask |
| `signer` | `Signer \| null` | ethers.js signer for write transactions |
| `contracts` | `object \| null` | Initialised contract instances (soulbound, credentials, social) |
| `userTokens` | `array` | Array of `{id, cid}` for the connected wallet's SBTs |
| `selectedToken` | `number \| null` | Currently active token ID |
| `activeTab` | `string` | Active navigation tab key |
| `pendingTxs` | `array` | In-flight transaction tracking objects |

**Table 4.1 — Root application state**

This flat, props-drilling state architecture was chosen deliberately over a context-based or Redux-based approach. The application has a single primary flow (connect wallet → select token → interact with credentials) with no complex cross-tree state sharing. The simplicity of direct prop passing outweighs the mild verbosity at this application scale.

The exception is notification state, which is managed through a `ToastProvider` context to allow any component at any depth in the tree to trigger user-visible notifications without threading a callback through every intermediate component.

### 4.3.3 MetaMask Integration and Network Auto-Configuration

Wallet connection is handled by the `connectWallet` function in `App`. On connection, the function detects the user's current network by calling `eth_chainId` and compares it against `CONFIG.CHAIN_ID` (424242). If the networks differ, it attempts to switch:

```javascript
const chainId = await window.ethereum.request({ method: 'eth_chainId' });
if (parseInt(chainId, 16) !== CONFIG.CHAIN_ID) {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${CONFIG.CHAIN_ID.toString(16)}` }],
        });
    } catch (switchError) {
        if (switchError.code === 4902) {
            // Network not known to MetaMask — add it automatically
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: `0x${CONFIG.CHAIN_ID.toString(16)}`,
                    chainName: CONFIG.NETWORK_NAME,
                    rpcUrls: [CONFIG.RPC_URL],
                }],
            });
        }
    }
}
```

Error code `4902` is MetaMask's "unrecognised chain" error. When it is caught, `wallet_addEthereumChain` is called to register the QBFT Besu network in the user's MetaMask with the correct RPC URL, chain name, and chain ID. After this one-time registration, subsequent connections switch directly without prompting for network addition. This means a first-time user requires only two MetaMask clicks (approve connection, confirm network add) to reach the application — the network configuration burden is entirely automated.

### 4.3.4 Resilient Event Log Querying

The application reads historical events (minted tokens, past access requests, credential additions) by querying contract event logs. The Besu RPC node limits the block range of a single `eth_getLogs` query, which would cause the application to fail silently if queried over a large range with a single call.

The `queryFilterInChunks` utility (in `utils.js`) handles this transparently. It divides the block range into chunks of 2,000 blocks and queries each chunk sequentially. Three failure modes are handled:

1. **Block-range limit error (code `-32005`):** the chunk size is halved and the same window is retried, down to a minimum of 100 blocks.
2. **RPC timeout (>15 seconds):** the chunk is abandoned and the function returns partial results rather than hanging indefinitely.
3. **Any other error:** logged as a warning and the loop exits cleanly, returning whatever events were collected.

This ensures that the user's loading state always resolves — even on a slow or partially unavailable RPC node — rather than spinning indefinitely.

### 4.3.5 Transaction Tracking

All write operations are submitted through the `trackTransaction` helper, which wraps the transaction receipt wait in a state machine:

```javascript
const trackTransaction = async (tx, description) => {
    const txId = Date.now();
    setPendingTxs(prev => [...prev, { id: txId, hash: tx.hash, description, status: 'pending' }]);

    try {
        const receipt = await tx.wait();
        setPendingTxs(prev => prev.map(t =>
            t.id === txId ? { ...t, status: 'confirmed', receipt } : t
        ));
        addToast(`${description} confirmed!`, 'success');
        return receipt;
    } catch (error) {
        setPendingTxs(prev => prev.map(t =>
            t.id === txId ? { ...t, status: 'failed', error: error.message } : t
        ));
        addToast(`${description} failed: ${error.message}`, 'error');
        throw error;
    }
};
```

The `pendingTxs` array drives a visible transaction status panel in the header, giving users real-time feedback on transaction confirmation without requiring them to check MetaMask's activity log.

### 4.3.6 QR Code Integration

Each token has a shareable QR code generated by `QRious` that encodes the token's URL (`?token=<tokenId>`). When a third party scans the QR code, the application loads with the `token` query parameter pre-set, and `scannedTokenId` in `App` initialises to that value — directing the user directly to the view-identity flow for that token. This provides a zero-friction sharing mechanism: a professional can display their QR code at a conference and a recruiter can scan it to immediately view the identity and request access.

---

## 4.4 Deployment

### 4.4.1 Deployment Sequence

The contracts were deployed to the QBFT Besu network in a strict sequence dictated by their dependency graph:

1. **`SoulboundIdentity`** — deployed first, as it has no dependencies on other system contracts. Its deployment address is recorded.

2. **`CredentialsHub`** — deployed second, passing the `SoulboundIdentity` deployment address as a constructor argument. The address is stored as an `immutable` reference.

3. **`SocialHub`** — deployed third, also passing the `SoulboundIdentity` address as a constructor argument.

4. **Groth16 verifier contract** — the auto-generated Solidity verifier (exported from snarkjs for the `reputation_threshold` circuit) is deployed fourth.

5. **`ReputationProofRegistry`** — deployed last, passing the Groth16 verifier address as a constructor argument.

The `immutable` keyword in Solidity stores constructor arguments directly in the contract bytecode rather than in storage slots, saving one `SLOAD` (approximately 2,100 gas) on every read. Since `identity` is read on every write operation in `CredentialsHub` and `SocialHub`, this optimisation compounds across the lifetime of the deployment.

### 4.4.2 Deployed Contract Address Registry

| Contract | Deployed Address |
|---|---|
| `SoulboundIdentity` | `0xf1FB393025ef07673CcFBD5E83E07f6cF503F8ee` |
| `CredentialsHub` | `0x25154346a75204f80108E73739f0A4AaD4754c8B` |
| `SocialHub` | `0xbe78D2f3c24Abdd91AD8263D7cF10290F94045a7` |

**Table 4.2 — Deployed contract addresses (Chain ID 424242)**

The `ReputationProofRegistry` address is not listed here as it is constructed during ZKP circuit setup, described in Chapter 5.

### 4.4.3 Network Configuration

The frontend `CONFIG` object centralises all deployment-specific parameters:

```javascript
CONFIG = {
    RPC_URL:      'https://rpc.dimikog.org/rpc/',
    CHAIN_ID:     424242,
    NETWORK_NAME: 'QBFT_Besu_EduNet',
    IPFS_GATEWAY: 'https://ipfs.io/ipfs/',
    CONTRACTS: {
        SOULBOUND_IDENTITY: '0xf1FB393025ef07673CcFBD5E83E07f6cF503F8ee',
        CREDENTIALS_HUB:    '0x25154346a75204f80108E73739f0A4AaD4754c8B',
        SOCIAL_HUB:         '0xbe78D2f3c24Abdd91AD8263D7cF10290F94045a7',
    }
};
```

Centralising these values in a single object means that migrating the deployment to a new network or set of contract addresses requires changing one file, not hunting for hardcoded addresses across the component tree.

---

*End of Chapter 4*
