// Utility Functions
import { CONFIG } from './contracts';

// Query contract events in RPC-safe chunks.
//
// Handles three failure modes that previously caused a permanent loading state:
//
//  1. Block-range limit (-32005): halves chunk size and retries the same
//     window automatically (down to 100-block minimum, then breaks).
//  2. Hanging RPC call: each chunk is raced against a 15-second timeout;
//     on expiry the loop breaks and returns whatever was collected so far.
//  3. Any other error: logs a warning and breaks — never re-throws, so the
//     caller's loading state is guaranteed to reset via its finally block.
//
// The caller is responsible for passing a capped fromBlock
// (e.g. Math.max(DEPLOYMENT_BLOCK, latestBlock - MAX_BLOCK_LOOKBACK))
// so the total number of chunks stays small from the start.
export const queryFilterInChunks = async (contract, filter, fromBlock, toBlock, chunkSize = 2000) => {
    const CHUNK_TIMEOUT_MS = 15000;
    const events = [];
    let start = fromBlock;
    let currentChunkSize = chunkSize;

    while (start <= toBlock) {
        const end = Math.min(start + currentChunkSize - 1, toBlock);

        let chunk;
        try {
            // Race the query against a hard timeout so a non-responding RPC
            // node never blocks the event loop indefinitely.
            const queryPromise = contract.queryFilter(filter, start, end);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject({ code: 'TIMEOUT' }), CHUNK_TIMEOUT_MS)
            );
            chunk = await Promise.race([queryPromise, timeoutPromise]);
        } catch (err) {
            // Normalise the error code across ethers v5 error shapes.
            const code = err.code ?? err.error?.code ?? err.data?.code;
            if (code === -32005 && currentChunkSize > 100) {
                // Range too large — halve and retry the same window.
                currentChunkSize = Math.floor(currentChunkSize / 2);
                console.warn(
                    `[queryFilterInChunks] Range limit on blocks ${start}-${end}, ` +
                    `retrying with chunk size ${currentChunkSize}`
                );
                continue; // do NOT advance start
            }
            // Timeout or unrecoverable error: return partial results rather
            // than throwing so the caller's finally always runs.
            console.warn(
                `[queryFilterInChunks] Chunk ${start}-${end} failed ` +
                `(code=${code ?? err.message}), stopping scan early`
            );
            break;
        }

        events.push(...chunk);
        start = end + 1;
        // Restore chunk size after a clean fetch so one bad chunk
        // doesn't permanently slow down the rest of the scan.
        currentChunkSize = chunkSize;
    }

    return events;
};

export const shortenAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export const formatDate = (timestamp) => {
    if (!timestamp || timestamp === 0) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString();
};

export const getIPFSLink = (cid) => {
    if (!cid) return '';
    // Removes 'ipfs://' prefix if it exists before appending to gateway
    const cleanCID = cid.replace('ipfs://', '');
    return `${CONFIG.IPFS_GATEWAY}${cleanCID}`;
};

export const getStatusBadge = (isVerified) => {
    return isVerified ? '✅ Verified' : '⏳ Pending';
};

// Constants
export const credentialTypes = ['Degree', 'Certification', 'Work Experience', 'Identity Proof', 'Skill'];
export const skillCategories = ['Technical', 'Soft', 'Language', 'Domain', 'Tool', 'Other'];
export const projectStatuses = ['Planning', 'Active', 'Completed', 'Cancelled'];

console.log('✅ Utilities loaded');
