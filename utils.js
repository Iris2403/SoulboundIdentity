// Utility Functions - declared globally
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
