// Utility Functions - declared globally

// Query contract events in RPC-safe chunks.
//
// Most providers (MetaMask built-in, Infura, Alchemy) reject eth_getLogs
// requests that span more than ~2 000–10 000 blocks with error -32005.
// This helper:
//   • Splits [fromBlock, toBlock] into chunks of `chunkSize` (default 2 000).
//   • On -32005 for any chunk, halves the chunk size and retries that window
//     (down to a minimum of 100 blocks before re-throwing).
//   • Only uses the caller-supplied filter — never widens scope as a fallback.
queryFilterInChunks = async (contract, filter, fromBlock, toBlock, chunkSize = 2000) => {
    const events = [];
    let start = fromBlock;
    let currentChunkSize = chunkSize;

    while (start <= toBlock) {
        const end = Math.min(start + currentChunkSize - 1, toBlock);
        try {
            const chunk = await contract.queryFilter(filter, start, end);
            events.push(...chunk);
            start = end + 1;
            // Restore chunk size after a successful fetch so transient
            // congestion doesn't permanently slow down the whole scan.
            currentChunkSize = chunkSize;
        } catch (err) {
            // Normalise the error code across ethers v5 error shapes.
            const code = err.code ?? err.error?.code ?? err.data?.code;
            if (code === -32005 && currentChunkSize > 100) {
                currentChunkSize = Math.floor(currentChunkSize / 2);
                console.warn(
                    `[queryFilterInChunks] RPC range limit on blocks ${start}–${end}, ` +
                    `retrying with chunk size ${currentChunkSize}`
                );
                // Do NOT advance `start` — retry the same window with a smaller chunk.
            } else {
                throw err;
            }
        }
    }

    return events;
};

shortenAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

formatDate = (timestamp) => {
    if (!timestamp || timestamp === 0) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString();
};

getIPFSLink = (cid) => {
    if (!cid) return '';
    // Removes 'ipfs://' prefix if it exists before appending to gateway
    const cleanCID = cid.replace('ipfs://', '');
    return `${CONFIG.IPFS_GATEWAY}${cleanCID}`;
};

getStatusBadge = (isVerified) => {
    return isVerified ? '✅ Verified' : '⏳ Pending';
};

// Constants - declared globally
credentialTypes = ['Degree', 'Certification', 'Work Experience', 'Identity Proof', 'Skill'];
skillCategories = ['Technical', 'Soft', 'Language', 'Domain', 'Tool', 'Other'];
projectStatuses = ['Planning', 'Active', 'Completed', 'Cancelled'];

console.log('✅ Utilities loaded globally');
