// Utility Functions - declared globally

// Query contract events in chunks to stay within RPC provider block-range limits.
// Most providers (MetaMask, Infura, Alchemy) reject requests that span more than
// ~10 000 blocks in one call (error -32005). This helper splits the range into
// smaller batches and merges the results.
queryFilterInChunks = async (contract, filter, fromBlock, toBlock, chunkSize = 5000) => {
    const events = [];
    for (let start = fromBlock; start <= toBlock; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, toBlock);
        const chunk = await contract.queryFilter(filter, start, end);
        events.push(...chunk);
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
