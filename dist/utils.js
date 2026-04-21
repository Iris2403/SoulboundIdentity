// Utility Functions - declared globally

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
queryFilterInChunks = async (contract, filter, fromBlock, toBlock, chunkSize = 2000) => {
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
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject({
        code: 'TIMEOUT'
      }), CHUNK_TIMEOUT_MS));
      chunk = await Promise.race([queryPromise, timeoutPromise]);
    } catch (err) {
      // Normalise the error code across ethers v5 error shapes.
      const code = err.code ?? err.error?.code ?? err.data?.code;
      if (code === -32005 && currentChunkSize > 100) {
        // Range too large — halve and retry the same window.
        currentChunkSize = Math.floor(currentChunkSize / 2);
        console.warn(`[queryFilterInChunks] Range limit on blocks ${start}-${end}, ` + `retrying with chunk size ${currentChunkSize}`);
        continue; // do NOT advance start
      }
      // Timeout or unrecoverable error: return partial results rather
      // than throwing so the caller's finally always runs.
      console.warn(`[queryFilterInChunks] Chunk ${start}-${end} failed ` + `(code=${code ?? err.message}), stopping scan early`);
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
shortenAddress = address => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
formatDate = timestamp => {
  if (!timestamp || timestamp === 0) return 'N/A';
  return new Date(timestamp * 1000).toLocaleDateString();
};
getIPFSLink = cid => {
  if (!cid) return '';
  // Removes 'ipfs://' prefix if it exists before appending to gateway
  const cleanCID = cid.replace('ipfs://', '');
  return `${CONFIG.IPFS_GATEWAY}${cleanCID}`;
};
getStatusBadge = isVerified => {
  return isVerified ? '✅ Verified' : '⏳ Pending';
};

// Constants - declared globally
credentialTypes = ['Degree', 'Certification', 'Work Experience', 'Identity Proof', 'Skill'];
skillCategories = ['Technical', 'Soft', 'Language', 'Domain', 'Tool', 'Other'];
projectStatuses = ['Planning', 'Active', 'Completed', 'Cancelled'];

// Degree categories (matches CredentialsHub.sol DegreeCategory enum)
degreeCategories = ['Arts & Humanities', 'Business & Economics', 'Law & Social Sciences', 'Education & Development', 'Health & Life Sciences', 'Science & Technology'];

// Certification domains (matches CredentialsHub.sol CertificationDomain enum)
certificationDomains = ['IT & Software Dev', 'Business & Management', 'Health & Medicine', 'Data & AI Analytics', 'Communication & Marketing'];

// Predefined standardized skills (matches SocialHub.sol PredefinedSkill enum)
predefinedSkills = [{
  id: 0,
  name: 'Software Development',
  category: 0
}, {
  id: 1,
  name: 'Web Development',
  category: 0
}, {
  id: 2,
  name: 'Data Analysis',
  category: 0
}, {
  id: 3,
  name: 'AI / Machine Learning',
  category: 0
}, {
  id: 4,
  name: 'Cybersecurity',
  category: 0
}, {
  id: 5,
  name: 'Blockchain Development',
  category: 0
}, {
  id: 6,
  name: 'Project Management',
  category: 1
}, {
  id: 7,
  name: 'Business Strategy',
  category: 1
}, {
  id: 8,
  name: 'Marketing & Digital Marketing',
  category: 1
}, {
  id: 9,
  name: 'Sales & Negotiation',
  category: 1
}, {
  id: 10,
  name: 'Financial Literacy',
  category: 1
}, {
  id: 11,
  name: 'UI/UX Design',
  category: 2
}, {
  id: 12,
  name: 'Content Creation',
  category: 2
}, {
  id: 13,
  name: 'Video & Media Production',
  category: 2
}, {
  id: 14,
  name: 'Communication Skills',
  category: 3
}, {
  id: 15,
  name: 'Leadership & Teamwork',
  category: 3
}];

// Standard skill categories (matches SocialHub.sol SkillCategory enum)
standardSkillCategories = ['Technical', 'Business', 'Creative', 'Soft'];
console.log('✅ Utilities loaded globally');