// ===========================
// CONTRACT CONFIGURATION
// ===========================

const CONTRACTS = {
    SoulboundIdentity: '0xf1FB393025ef07673CcFBD5E83E07f6cF503F8ee',
    CredentialsHub: '0x25154346a75204f80108E73739f0A4AaD4754c8B',
    SocialHub: '0xbe78D2f3c24Abdd91AD8263D7cF10290F94045a7'
};

// Simplified ABIs (add full ABIs for production)
const ABIS = {
    SoulboundIdentity: [
        "function mint(address to, string memory metadataCID, uint8 burnAuth) external returns (uint256)",
        "function burn(uint256 tokenId) external",
        "function ownerOf(uint256 tokenId) external view returns (address)",
        "function tokenMetadataCID(uint256 tokenId) external view returns (string)",
        "function burnAuth(uint256 tokenId) external view returns (uint8)",
        "function requestAccess(uint256 tokenId) external",
        "function approveAccessRequest(uint256 tokenId, address requester, uint64 expiryTime) external",
        "function hasAccess(uint256 tokenId, address user) external view returns (bool)",
        "function revokeAccess(uint256 tokenId, address user, string memory reason) external",
        "function paused() external view returns (bool)",
        "function pause() external",
        "function unpause() external",
        "function owner() external view returns (address)",
        "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
        "event AccessRequested(uint256 indexed tokenId, address indexed requester)",
        "event AccessApproved(uint256 indexed tokenId, address indexed requester, uint64 expiryTime)"
    ],
    CredentialsHub: [
        "function addCredential(uint256 tokenId, uint8 credType, bytes32 metadataHash, uint64 issueDate, uint64 expiryDate, uint8 category) external returns (uint256)",
        "function issueCredential(uint256 tokenId, uint8 credType, bytes32 metadataHash, uint64 issueDate, uint64 expiryDate, uint8 category) external returns (uint256)",
        "function revokeCredential(uint256 tokenId, uint256 credentialId) external",
        "function getCredential(uint256 tokenId, uint256 credentialId) external view returns (tuple)",
        "function setIssuerAuthorization(uint8 credType, address issuer, bool authorized) external",
        "function isAuthorizedIssuer(uint8 credType, address issuer) external view returns (bool)",
        "event CredentialIssued(uint256 indexed tokenId, uint256 indexed credentialId, uint8 credType, address indexed issuer)"
    ],
    SocialHub: [
        "function submitReview(uint256 subjectTokenId, uint256 reviewerTokenId, uint8 score, bool verifiedCollab, bool anonymous, string memory comment) external",
        "function getReviews(uint256 tokenId) external view returns (tuple[] memory)",
        "function createProject(uint256 tokenId, bytes32 metadataHash) external returns (uint256)",
        "function updateProjectStatus(uint256 tokenId, uint256 projectId, uint8 newStatus) external",
        "function addCollaborator(uint256 tokenId, uint256 projectId, uint256 collaboratorTokenId) external",
        "function endorseSkill(uint256 subjectTokenId, uint256 endorserTokenId, bytes32 skillHash, string memory comment) external",
        "function getEndorsements(uint256 tokenId) external view returns (tuple[] memory)",
        "event ReviewSubmitted(uint256 indexed subjectTokenId, uint256 indexed reviewerTokenId, uint8 score)",
        "event ProjectCreated(uint256 indexed tokenId, uint256 indexed projectId)",
        "event SkillEndorsed(uint256 indexed subjectTokenId, uint256 indexed endorserTokenId, bytes32 skillHash)"
    ]
};

// ===========================
// GLOBAL STATE
// ===========================

let provider;
let signer;
let connectedAddress;
let contracts = {};
let userTokens = [];
let transactionHistory = [];
let eventListeners = {};
let isEventListening = false;

// ===========================
// INITIALIZATION
// ===========================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 SoulBound Identity System Initialized');
    
    // Set up event listeners
    setupEventListeners();
    
    // Check if wallet is already connected
    if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    }
    
    // Update UI
    updateAllDropdowns();
});

// ===========================
// WALLET CONNECTION
// ===========================

async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            showToast('Please install MetaMask to use this application', 'error');
            return;
        }

        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        // Initialize provider and signer
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        connectedAddress = accounts[0];

        // Initialize contracts
        contracts.identity = new ethers.Contract(CONTRACTS.SoulboundIdentity, ABIS.SoulboundIdentity, signer);
        contracts.credentials = new ethers.Contract(CONTRACTS.CredentialsHub, ABIS.CredentialsHub, signer);
        contracts.social = new ethers.Contract(CONTRACTS.SocialHub, ABIS.SocialHub, signer);

        // Get network info
        const network = await provider.getNetwork();
        
        // Get gas price
        const gasPrice = await provider.getGasPrice();
        const gasPriceGwei = ethers.utils.formatUnits(gasPrice, 'gwei');

        // Update UI
        document.getElementById('wallet-status').style.display = 'none';
        document.getElementById('wallet-info').style.display = 'flex';
        document.getElementById('wallet-address').textContent = truncateAddress(connectedAddress);
        document.getElementById('network-name').textContent = `${network.name} (${network.chainId})`;
        document.getElementById('gas-price').textContent = `${parseFloat(gasPriceGwei).toFixed(2)} Gwei`;

        // Load user tokens
        await loadUserTokens();
        
        // Check if user is owner for admin functions
        await checkOwnerStatus();

        showToast('Wallet connected successfully! 🎉', 'success');

        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

    } catch (error) {
        console.error('Error connecting wallet:', error);
        showToast(`Failed to connect wallet: ${error.message}`, 'error');
    }
}

async function disconnectWallet() {
    // Reset state
    provider = null;
    signer = null;
    connectedAddress = null;
    contracts = {};
    userTokens = [];

    // Stop event listening
    if (isEventListening) {
        stopEventListener();
    }

    // Update UI
    document.getElementById('wallet-status').style.display = 'block';
    document.getElementById('wallet-info').style.display = 'none';
    document.getElementById('my-tokens-container').innerHTML = '<p class="empty-state">Connect your wallet to view your tokens</p>';

    showToast('Wallet disconnected', 'info');
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        disconnectWallet();
    } else {
        window.location.reload();
    }
}

function handleChainChanged() {
    window.location.reload();
}

// ===========================
// USER TOKEN MANAGEMENT
// ===========================

async function loadUserTokens() {
    if (!contracts.identity) return;

    try {
        userTokens = [];
        
        // Listen for Transfer events to find user's tokens
        const filter = contracts.identity.filters.Transfer(null, connectedAddress);
        const events = await contracts.identity.queryFilter(filter);

        for (const event of events) {
            const tokenId = event.args.tokenId.toString();
            try {
                const owner = await contracts.identity.ownerOf(tokenId);
                if (owner.toLowerCase() === connectedAddress.toLowerCase()) {
                    userTokens.push(tokenId);
                }
            } catch (e) {
                // Token might have been burned
            }
        }

        document.getElementById('user-tokens').textContent = userTokens.length > 0 ? userTokens.join(', ') : 'None';
        
        await displayUserTokens();
        updateAllDropdowns();

    } catch (error) {
        console.error('Error loading user tokens:', error);
        showToast('Failed to load tokens', 'error');
    }
}

async function displayUserTokens() {
    const container = document.getElementById('my-tokens-container');
    
    if (userTokens.length === 0) {
        container.innerHTML = '<p class="empty-state">You don\'t own any tokens yet. Mint your first identity!</p>';
        return;
    }

    let html = '<div class="tokens-grid">';
    
    for (const tokenId of userTokens) {
        try {
            const metadataCID = await contracts.identity.tokenMetadataCID(tokenId);
            const burnAuth = await contracts.identity.burnAuth(tokenId);
            const burnAuthText = ['IssuerOnly', 'OwnerOnly', 'Both', 'Neither'][burnAuth];

            html += `
                <div class="token-card">
                    <div class="token-header">
                        <h4>Token #${tokenId}</h4>
                        <span class="token-badge">${burnAuthText}</span>
                    </div>
                    <div class="token-body">
                        <div class="token-field">
                            <label>Metadata CID:</label>
                            <a href="https://ipfs.io/ipfs/${metadataCID}" target="_blank" class="ipfs-link">${truncateHash(metadataCID)}</a>
                        </div>
                        <div class="token-field">
                            <label>Owner:</label>
                            <span>${truncateAddress(connectedAddress)}</span>
                        </div>
                    </div>
                    <div class="token-actions">
                        <button class="btn-small" onclick="viewTokenDetails('${tokenId}')">View Details</button>
                        <button class="btn-small btn-danger" onclick="selectTokenToBurn('${tokenId}')">Burn</button>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error(`Error loading token ${tokenId}:`, error);
        }
    }
    
    html += '</div>';
    container.innerHTML = html;
}

// ===========================
// IDENTITY MANAGEMENT FUNCTIONS
// ===========================

async function mintToken() {
    if (!contracts.identity) {
        showToast('Please connect your wallet first', 'error');
        return;
    }

    const cid = document.getElementById('mint-ipfs-cid').value;
    const burnAuth = document.getElementById('mint-burn-auth').value;

    if (!validateIPFSCID(cid)) {
        showToast('Invalid IPFS CID format', 'error');
        return;
    }

    try {
        showToast('Minting token... Please confirm the transaction', 'info');
        
        const tx = await contracts.identity.mint(connectedAddress, cid, burnAuth);
        
        addTransaction('Mint Identity Token', tx.hash, 'pending');
        showToast('Transaction submitted! Waiting for confirmation...', 'info');
        
        const receipt = await tx.wait();
        
        // Extract token ID from Transfer event
        const transferEvent = receipt.events.find(e => e.event === 'Transfer');
        const tokenId = transferEvent.args.tokenId.toString();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast(`Token minted successfully! Token ID: ${tokenId} 🎉`, 'success');
        
        // Reload tokens
        await loadUserTokens();
        
        // Clear form
        document.getElementById('mint-ipfs-cid').value = '';
        
    } catch (error) {
        console.error('Error minting token:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

async function burnToken() {
    const tokenId = document.getElementById('burn-token-id').value;
    
    if (!tokenId) {
        showToast('Please select a token to burn', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to burn token #${tokenId}? This action cannot be undone!`)) {
        return;
    }

    try {
        showToast('Burning token... Please confirm the transaction', 'info');
        
        const tx = await contracts.identity.burn(tokenId);
        
        addTransaction('Burn Token', tx.hash, 'pending');
        showToast('Transaction submitted! Waiting for confirmation...', 'info');
        
        const receipt = await tx.wait();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast('Token burned successfully', 'success');
        
        // Reload tokens
        await loadUserTokens();
        
        // Uncheck confirmation
        document.getElementById('burn-confirm-checkbox').checked = false;
        document.getElementById('burn-token-btn').disabled = true;
        
    } catch (error) {
        console.error('Error burning token:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

async function searchToken() {
    const tokenId = document.getElementById('search-token-id').value;
    
    if (!tokenId) {
        showToast('Please enter a token ID', 'error');
        return;
    }

    try {
        const owner = await contracts.identity.ownerOf(tokenId);
        const metadataCID = await contracts.identity.tokenMetadataCID(tokenId);
        const burnAuth = await contracts.identity.burnAuth(tokenId);
        const hasAccess = await contracts.identity.hasAccess(tokenId, connectedAddress);

        const burnAuthText = ['IssuerOnly', 'OwnerOnly', 'Both', 'Neither'][burnAuth];

        const resultHtml = `
            <div class="search-result">
                <h4>Token #${tokenId}</h4>
                <div class="result-field">
                    <label>Owner:</label>
                    <span>${owner}</span>
                </div>
                <div class="result-field">
                    <label>Metadata CID:</label>
                    <a href="https://ipfs.io/ipfs/${metadataCID}" target="_blank">${metadataCID}</a>
                </div>
                <div class="result-field">
                    <label>Burn Authorization:</label>
                    <span>${burnAuthText}</span>
                </div>
                <div class="result-field">
                    <label>Access Status:</label>
                    <span class="${hasAccess ? 'status-active' : 'status-inactive'}">
                        ${hasAccess ? '✓ You have access' : '✗ No access'}
                    </span>
                </div>
                ${!hasAccess && owner.toLowerCase() !== connectedAddress.toLowerCase() ? 
                    '<button class="btn-primary" onclick="requestAccessToToken(' + tokenId + ')">Request Access</button>' : ''}
            </div>
        `;

        document.getElementById('search-token-result').innerHTML = resultHtml;

    } catch (error) {
        console.error('Error searching token:', error);
        document.getElementById('search-token-result').innerHTML = 
            '<div class="error-box">Token not found or error occurred</div>';
    }
}

// ===========================
// ACCESS CONTROL FUNCTIONS
// ===========================

async function requestAccessToToken(tokenId) {
    if (!tokenId) {
        tokenId = document.getElementById('request-token-id').value;
    }

    if (!tokenId) {
        showToast('Please enter a token ID', 'error');
        return;
    }

    try {
        showToast('Requesting access... Please confirm the transaction', 'info');
        
        const tx = await contracts.identity.requestAccess(tokenId);
        
        addTransaction('Request Access', tx.hash, 'pending');
        
        const receipt = await tx.wait();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast('Access request submitted successfully!', 'success');
        
    } catch (error) {
        console.error('Error requesting access:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

async function approveAccessRequest(tokenId, requester, duration) {
    try {
        const currentTime = Math.floor(Date.now() / 1000);
        const expiryTime = currentTime + duration;

        showToast('Approving access... Please confirm the transaction', 'info');
        
        const tx = await contracts.identity.approveAccessRequest(tokenId, requester, expiryTime);
        
        addTransaction('Approve Access', tx.hash, 'pending');
        
        const receipt = await tx.wait();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast('Access approved successfully!', 'success');
        
    } catch (error) {
        console.error('Error approving access:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

async function revokeAccess() {
    const tokenId = document.getElementById('revoke-token-id').value;
    const address = document.getElementById('revoke-address').value;
    const reason = document.getElementById('revoke-reason').value;

    if (!tokenId || !address) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    try {
        showToast('Revoking access... Please confirm the transaction', 'info');
        
        const tx = await contracts.identity.revokeAccess(tokenId, address, reason);
        
        addTransaction('Revoke Access', tx.hash, 'pending');
        
        const receipt = await tx.wait();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast('Access revoked successfully!', 'success');
        
        // Clear form
        document.getElementById('revoke-token-id').value = '';
        document.getElementById('revoke-address').value = '';
        document.getElementById('revoke-reason').value = '';
        
    } catch (error) {
        console.error('Error revoking access:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

// ===========================
// CREDENTIALS FUNCTIONS
// ===========================

async function addCredential(credType) {
    const typeMap = {
        'degree': 0,
        'certification': 1,
        'work': 2,
        'identity': 3,
        'skill': 4
    };

    const credTypeNum = typeMap[credType];
    const tokenId = document.getElementById(`${credType}-token-id`).value;
    const metadata = document.getElementById(`${credType}-metadata`).value;
    const issueDate = document.getElementById(`${credType}-issue-date`).value;
    const expiryDate = document.getElementById(`${credType}-expiry-date`).value;
    const neverExpires = document.getElementById(`${credType}-never-expires`).checked;
    const submitMethod = document.querySelector(`input[name="${credType}-submit-method"]:checked`).value;

    if (!tokenId || !metadata || !issueDate) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    // Convert dates to Unix timestamps
    const issueTimestamp = Math.floor(new Date(issueDate).getTime() / 1000);
    const expiryTimestamp = neverExpires ? 
        Math.floor(Date.now() / 1000) + (100 * 365 * 24 * 60 * 60) : // 100 years from now
        Math.floor(new Date(expiryDate).getTime() / 1000);

    // Get category (only for skills)
    const category = credType === 'skill' ? 
        document.getElementById('skill-category').value : 0;

    try {
        showToast('Adding credential... Please confirm the transaction', 'info');
        
        let tx;
        if (submitMethod === 'issuer') {
            tx = await contracts.credentials.issueCredential(
                tokenId, credTypeNum, metadata, issueTimestamp, expiryTimestamp, category
            );
        } else {
            tx = await contracts.credentials.addCredential(
                tokenId, credTypeNum, metadata, issueTimestamp, expiryTimestamp, category
            );
        }
        
        addTransaction(`Add ${credType} Credential`, tx.hash, 'pending');
        
        const receipt = await tx.wait();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast(`${credType.charAt(0).toUpperCase() + credType.slice(1)} credential added successfully!`, 'success');
        
    } catch (error) {
        console.error('Error adding credential:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

async function setIssuerAuthorization() {
    const credType = document.getElementById('auth-cred-type').value;
    const issuer = document.getElementById('auth-issuer-address').value;
    const authorize = document.getElementById('auth-authorize-checkbox').checked;

    if (!issuer) {
        showToast('Please enter an issuer address', 'error');
        return;
    }

    try {
        showToast('Setting authorization... Please confirm the transaction', 'info');
        
        const tx = await contracts.credentials.setIssuerAuthorization(credType, issuer, authorize);
        
        addTransaction('Set Issuer Authorization', tx.hash, 'pending');
        
        const receipt = await tx.wait();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast(`Issuer ${authorize ? 'authorized' : 'revoked'} successfully!`, 'success');
        
    } catch (error) {
        console.error('Error setting authorization:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

async function searchCredential() {
    const tokenId = document.getElementById('search-cred-token-id').value;
    const credId = document.getElementById('search-cred-id').value;

    if (!tokenId || !credId) {
        showToast('Please enter both token ID and credential ID', 'error');
        return;
    }

    try {
        const credential = await contracts.credentials.getCredential(tokenId, credId);
        
        const credTypeNames = ['Degree', 'Certification', 'Work Experience', 'Identity Proof', 'Skill'];
        const credTypeName = credTypeNames[credential.credType];

        const resultHtml = `
            <div class="credential-card">
                <h4>Credential #${credId}</h4>
                <div class="credential-field"><label>Type:</label> ${credTypeName}</div>
                <div class="credential-field"><label>Metadata:</label> ${credential.metadataHash}</div>
                <div class="credential-field"><label>Issuer:</label> ${credential.issuer}</div>
                <div class="credential-field"><label>Issue Date:</label> ${new Date(credential.issueDate * 1000).toLocaleDateString()}</div>
                <div class="credential-field"><label>Expiry Date:</label> ${new Date(credential.expiryDate * 1000).toLocaleDateString()}</div>
                <div class="credential-field"><label>Status:</label> <span class="${credential.isRevoked ? 'status-inactive' : 'status-active'}">${credential.isRevoked ? 'Revoked' : 'Active'}</span></div>
                <div class="credential-field"><label>Verified:</label> ${credential.isVerified ? '✓ Yes' : '✗ No'}</div>
            </div>
        `;

        document.getElementById('search-credential-result').innerHTML = resultHtml;

    } catch (error) {
        console.error('Error searching credential:', error);
        document.getElementById('search-credential-result').innerHTML = 
            '<div class="error-box">Credential not found or you don\'t have access</div>';
    }
}

async function revokeCredential() {
    const tokenId = document.getElementById('revoke-cred-token-id').value;
    const credId = document.getElementById('revoke-cred-id').value;

    if (!tokenId || !credId) {
        showToast('Please enter both token ID and credential ID', 'error');
        return;
    }

    if (!confirm('Are you sure you want to revoke this credential?')) {
        return;
    }

    try {
        showToast('Revoking credential... Please confirm the transaction', 'info');
        
        const tx = await contracts.credentials.revokeCredential(tokenId, credId);
        
        addTransaction('Revoke Credential', tx.hash, 'pending');
        
        const receipt = await tx.wait();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast('Credential revoked successfully!', 'success');
        
    } catch (error) {
        console.error('Error revoking credential:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

// ===========================
// SOCIAL FUNCTIONS
// ===========================

async function submitReview() {
    const subjectToken = document.getElementById('review-subject-token').value;
    const yourToken = document.getElementById('review-your-token').value;
    const score = document.getElementById('review-score').value;
    const verified = document.getElementById('review-verified').checked;
    const anonymous = document.getElementById('review-anonymous').checked;
    const comment = document.getElementById('review-comment').value;

    if (!subjectToken || !yourToken) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    if (subjectToken === yourToken) {
        showToast('You cannot review your own identity', 'error');
        return;
    }

    try {
        showToast('Submitting review... Please confirm the transaction', 'info');
        
        const tx = await contracts.social.submitReview(
            subjectToken, yourToken, score, verified, anonymous, comment
        );
        
        addTransaction('Submit Review', tx.hash, 'pending');
        
        const receipt = await tx.wait();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast('Review submitted successfully!', 'success');
        
        // Clear form
        document.getElementById('review-comment').value = '';
        
    } catch (error) {
        console.error('Error submitting review:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

async function createProject() {
    const tokenId = document.getElementById('project-token-id').value;
    const metadata = document.getElementById('project-metadata').value;

    if (!tokenId || !metadata) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    try {
        showToast('Creating project... Please confirm the transaction', 'info');
        
        const tx = await contracts.social.createProject(tokenId, metadata);
        
        addTransaction('Create Project', tx.hash, 'pending');
        
        const receipt = await tx.wait();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast('Project created successfully!', 'success');
        
    } catch (error) {
        console.error('Error creating project:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

async function updateProjectStatus() {
    const tokenId = document.getElementById('update-project-token').value;
    const projectId = document.getElementById('update-project-id').value;
    const status = document.getElementById('update-project-status').value;

    if (!tokenId || !projectId) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    try {
        showToast('Updating project status... Please confirm the transaction', 'info');
        
        const tx = await contracts.social.updateProjectStatus(tokenId, projectId, status);
        
        addTransaction('Update Project Status', tx.hash, 'pending');
        
        const receipt = await tx.wait();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast('Project status updated successfully!', 'success');
        
    } catch (error) {
        console.error('Error updating project status:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

async function addCollaborator() {
    const tokenId = document.getElementById('collab-token-id').value;
    const projectId = document.getElementById('collab-project-id').value;
    const collaboratorToken = document.getElementById('collab-collaborator-token').value;

    if (!tokenId || !projectId || !collaboratorToken) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    try {
        showToast('Adding collaborator... Please confirm the transaction', 'info');
        
        const tx = await contracts.social.addCollaborator(tokenId, projectId, collaboratorToken);
        
        addTransaction('Add Collaborator', tx.hash, 'pending');
        
        const receipt = await tx.wait();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast('Collaborator added successfully!', 'success');
        
    } catch (error) {
        console.error('Error adding collaborator:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

async function endorseSkill() {
    const subjectToken = document.getElementById('endorse-subject-token').value;
    const yourToken = document.getElementById('endorse-your-token').value;
    const skillHash = document.getElementById('endorse-skill-hash').value;
    const comment = document.getElementById('endorse-comment').value;

    if (!subjectToken || !yourToken || !skillHash) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    if (subjectToken === yourToken) {
        showToast('You cannot endorse your own skills', 'error');
        return;
    }

    try {
        showToast('Endorsing skill... Please confirm the transaction', 'info');
        
        const tx = await contracts.social.endorseSkill(subjectToken, yourToken, skillHash, comment);
        
        addTransaction('Endorse Skill', tx.hash, 'pending');
        
        const receipt = await tx.wait();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast('Skill endorsed successfully!', 'success');
        
    } catch (error) {
        console.error('Error endorsing skill:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

// ===========================
// ADMIN FUNCTIONS
// ===========================

async function checkOwnerStatus() {
    try {
        const owner = await contracts.identity.owner();
        const isOwner = owner.toLowerCase() === connectedAddress.toLowerCase();

        if (isOwner) {
            document.getElementById('admin-content').style.display = 'block';
            document.getElementById('admin-restricted').style.display = 'none';
            await updateContractStatus();
        } else {
            document.getElementById('admin-content').style.display = 'none';
            document.getElementById('admin-restricted').style.display = 'block';
        }
    } catch (error) {
        console.error('Error checking owner status:', error);
    }
}

async function updateContractStatus() {
    try {
        const isPaused = await contracts.identity.paused();
        
        const statusIndicator = document.getElementById('contract-status-indicator');
        statusIndicator.textContent = isPaused ? 'PAUSED' : 'ACTIVE';
        statusIndicator.className = isPaused ? 'status-badge status-inactive' : 'status-badge status-active';

        document.getElementById('pause-contract-btn').disabled = isPaused;
        document.getElementById('unpause-contract-btn').disabled = !isPaused;
    } catch (error) {
        console.error('Error updating contract status:', error);
    }
}

async function pauseContract() {
    try {
        showToast('Pausing contract... Please confirm the transaction', 'info');
        
        const tx = await contracts.identity.pause();
        
        addTransaction('Pause Contract', tx.hash, 'pending');
        
        const receipt = await tx.wait();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast('Contract paused successfully!', 'success');
        
        await updateContractStatus();
        
    } catch (error) {
        console.error('Error pausing contract:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

async function unpauseContract() {
    try {
        showToast('Unpausing contract... Please confirm the transaction', 'info');
        
        const tx = await contracts.identity.unpause();
        
        addTransaction('Unpause Contract', tx.hash, 'pending');
        
        const receipt = await tx.wait();
        
        updateTransaction(tx.hash, 'success', receipt.gasUsed.toString());
        showToast('Contract unpaused successfully!', 'success');
        
        await updateContractStatus();
        
    } catch (error) {
        console.error('Error unpausing contract:', error);
        showToast(parseErrorMessage(error), 'error');
    }
}

// ===========================
// UTILITY FUNCTIONS
// ===========================

function generateMockIPFS() {
    // Generate a valid Qm... IPFS hash
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let hash = 'Qm';
    for (let i = 0; i < 44; i++) {
        hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('generator-output').innerHTML = 
        `<div class="output-item"><strong>Generated IPFS CID:</strong><br><code>${hash}</code></div>`;
    showToast('IPFS CID generated', 'success');
}

function generateMockBytes32() {
    const hash = '0x' + Array(64).fill(0).map(() => 
        Math.floor(Math.random() * 16).toString(16)
    ).join('');
    document.getElementById('generator-output').innerHTML = 
        `<div class="output-item"><strong>Generated Hash:</strong><br><code>${hash}</code></div>`;
    showToast('Hash generated', 'success');
}

function generateSampleHash(inputId) {
    const hash = '0x' + Array(64).fill(0).map(() => 
        Math.floor(Math.random() * 16).toString(16)
    ).join('');
    document.getElementById(inputId).value = hash;
}

function generateRandomTimestamp() {
    const now = Math.floor(Date.now() / 1000);
    const randomOffset = Math.floor(Math.random() * 31536000); // Random offset up to 1 year
    const timestamp = now + randomOffset;
    const date = new Date(timestamp * 1000);
    document.getElementById('generator-output').innerHTML = 
        `<div class="output-item"><strong>Random Timestamp:</strong><br><code>${timestamp}</code><br>${date.toLocaleString()}</div>`;
    showToast('Random timestamp generated', 'success');
}

function generateRandomScore() {
    const score = Math.floor(Math.random() * 101);
    document.getElementById('generator-output').innerHTML = 
        `<div class="output-item"><strong>Random Score:</strong><br><code>${score}/100</code></div>`;
    showToast('Random score generated', 'success');
}

async function convertHashToBytes32() {
    const input = document.getElementById('hash-input').value;
    if (!input) {
        showToast('Please enter text to convert', 'error');
        return;
    }

    const hash = ethers.utils.id(input); // keccak256
    document.getElementById('hash-output').innerHTML = 
        `<div class="output-item"><strong>Bytes32 Hash:</strong><br><code>${hash}</code></div>`;
}

function convertDateToTimestamp() {
    const dateInput = document.getElementById('date-to-timestamp').value;
    if (!dateInput) {
        showToast('Please select a date', 'error');
        return;
    }

    const timestamp = Math.floor(new Date(dateInput).getTime() / 1000);
    document.getElementById('date-converter-output').innerHTML = 
        `<div class="output-item"><strong>Unix Timestamp:</strong><br><code>${timestamp}</code></div>`;
}

function convertTimestampToDate() {
    const timestamp = document.getElementById('timestamp-to-date').value;
    if (!timestamp) {
        showToast('Please enter a timestamp', 'error');
        return;
    }

    const date = new Date(timestamp * 1000);
    document.getElementById('date-converter-output').innerHTML = 
        `<div class="output-item"><strong>Date:</strong><br><code>${date.toLocaleString()}</code></div>`;
}

function addDuration(seconds) {
    const now = Math.floor(Date.now() / 1000);
    const future = now + seconds;
    const date = new Date(future * 1000);
    document.getElementById('date-converter-output').innerHTML = 
        `<div class="output-item"><strong>Future Timestamp:</strong><br><code>${future}</code><br>${date.toLocaleString()}</div>`;
}

function validateIPFSCID(cid) {
    // Validate Qm... format (46 chars) or bafy... format (59+ chars)
    if (cid.startsWith('Qm') && cid.length === 46) return true;
    if (cid.startsWith('bafy') && cid.length >= 59) return true;
    return false;
}

function truncateAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function truncateHash(hash) {
    if (hash.length <= 20) return hash;
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function parseErrorMessage(error) {
    if (error.reason) return error.reason;
    if (error.data && error.data.message) return error.data.message;
    if (error.message) {
        // Extract revert reason from error message
        const match = error.message.match(/reason="([^"]+)"/);
        if (match) return match[1];
        return error.message;
    }
    return 'Transaction failed';
}

// ===========================
// TRANSACTION HISTORY
// ===========================

function addTransaction(action, hash, status) {
    transactionHistory.unshift({
        action,
        hash,
        status,
        timestamp: new Date().toISOString(),
        gasUsed: null
    });
    updateTransactionHistory();
}

function updateTransaction(hash, status, gasUsed) {
    const tx = transactionHistory.find(t => t.hash === hash);
    if (tx) {
        tx.status = status;
        tx.gasUsed = gasUsed;
        updateTransactionHistory();
    }
}

function updateTransactionHistory() {
    const container = document.getElementById('transaction-history');
    
    if (transactionHistory.length === 0) {
        container.innerHTML = '<p class="empty-state">No transactions yet</p>';
        return;
    }

    let html = '<div class="transaction-list">';
    
    transactionHistory.slice(0, 10).forEach(tx => {
        const statusClass = tx.status === 'success' ? 'status-active' : 
                           tx.status === 'pending' ? 'status-pending' : 'status-inactive';
        
        html += `
            <div class="transaction-item">
                <div class="tx-header">
                    <strong>${tx.action}</strong>
                    <span class="status-badge ${statusClass}">${tx.status}</span>
                </div>
                <div class="tx-details">
                    <div>Hash: <a href="https://etherscan.io/tx/${tx.hash}" target="_blank">${truncateHash(tx.hash)}</a></div>
                    ${tx.gasUsed ? `<div>Gas Used: ${tx.gasUsed}</div>` : ''}
                    <div>${new Date(tx.timestamp).toLocaleString()}</div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function clearTransactionHistory() {
    if (confirm('Clear all transaction history?')) {
        transactionHistory = [];
        updateTransactionHistory();
        showToast('Transaction history cleared', 'info');
    }
}

// ===========================
// EVENT MONITORING
// ===========================

function startEventListener() {
    if (!contracts.identity) {
        showToast('Please connect your wallet first', 'error');
        return;
    }

    if (isEventListening) {
        showToast('Already listening to events', 'info');
        return;
    }

    isEventListening = true;
    
    // Listen to all contracts
    eventListeners.transfer = contracts.identity.on('Transfer', (from, to, tokenId) => {
        addEvent('Transfer', { from, to, tokenId: tokenId.toString() });
    });

    eventListeners.accessRequested = contracts.identity.on('AccessRequested', (tokenId, requester) => {
        addEvent('AccessRequested', { tokenId: tokenId.toString(), requester });
    });

    eventListeners.accessApproved = contracts.identity.on('AccessApproved', (tokenId, requester, expiryTime) => {
        addEvent('AccessApproved', { tokenId: tokenId.toString(), requester, expiryTime: expiryTime.toString() });
    });

    showToast('Event listener started 🎧', 'success');
}

function stopEventListener() {
    if (!isEventListening) {
        showToast('Event listener is not running', 'info');
        return;
    }

    // Remove all listeners
    Object.values(contracts).forEach(contract => {
        contract.removeAllListeners();
    });

    eventListeners = {};
    isEventListening = false;

    showToast('Event listener stopped', 'info');
}

const eventsLog = [];

function addEvent(eventType, data) {
    eventsLog.unshift({
        type: eventType,
        data,
        timestamp: new Date().toISOString()
    });

    updateEventsDisplay();
}

function updateEventsDisplay() {
    const container = document.getElementById('events-container');
    const filter = document.getElementById('event-filter').value;

    const filteredEvents = filter ? 
        eventsLog.filter(e => e.type === filter) : 
        eventsLog;

    if (filteredEvents.length === 0) {
        container.innerHTML = '<p class="empty-state">No events captured yet</p>';
        return;
    }

    let html = '<div class="events-list">';
    
    filteredEvents.slice(0, 20).forEach(event => {
        html += `
            <div class="event-item">
                <div class="event-header">
                    <strong>${event.type}</strong>
                    <span class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="event-data">
                    <pre>${JSON.stringify(event.data, null, 2)}</pre>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function exportEventsToCSV() {
    if (eventsLog.length === 0) {
        showToast('No events to export', 'info');
        return;
    }

    const csv = [
        ['Timestamp', 'Event Type', 'Data'],
        ...eventsLog.map(e => [
            e.timestamp,
            e.type,
            JSON.stringify(e.data)
        ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `events_${Date.now()}.csv`;
    a.click();

    showToast('Events exported to CSV', 'success');
}

// ===========================
// UI HELPERS
// ===========================

function updateAllDropdowns() {
    // Update all token dropdowns
    const tokenSelects = document.querySelectorAll('.cred-token-select, #view-cred-token-id, #burn-token-id, #view-access-token-id, #project-token-id, #review-your-token, #endorse-your-token');
    
    tokenSelects.forEach(select => {
        select.innerHTML = '<option value="">-- Select token --</option>';
        userTokens.forEach(tokenId => {
            const option = document.createElement('option');
            option.value = tokenId;
            option.textContent = `Token #${tokenId}`;
            select.appendChild(option);
        });
    });
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => container.removeChild(toast), 300);
    }, 5000);
}

// ===========================
// EVENT LISTENERS SETUP
// ===========================

function setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // Update active tab
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active content
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    });

    // Credential type tabs
    document.querySelectorAll('.cred-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const credType = tab.dataset.credType;
            
            // Update active tab
            document.querySelectorAll('.cred-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active form
            document.querySelectorAll('.cred-form').forEach(form => form.classList.remove('active'));
            document.getElementById(`cred-form-${credType}`).classList.add('active');
        });
    });

    // Wallet connection
    document.getElementById('connect-wallet-btn').addEventListener('click', connectWallet);
    document.getElementById('disconnect-wallet-btn').addEventListener('click', disconnectWallet);

    // Identity Management
    document.getElementById('generate-mock-cid').addEventListener('click', () => {
        const cid = generateValidCID();
        document.getElementById('mint-ipfs-cid').value = cid;
    });
    document.getElementById('mint-token-btn').addEventListener('click', mintToken);
    document.getElementById('search-token-btn').addEventListener('click', searchToken);
    document.getElementById('burn-confirm-checkbox').addEventListener('change', (e) => {
        document.getElementById('burn-token-btn').disabled = !e.target.checked;
    });
    document.getElementById('burn-token-btn').addEventListener('click', burnToken);

    // Access Control
    document.getElementById('request-access-btn').addEventListener('click', () => requestAccessToToken());
    document.getElementById('revoke-access-btn').addEventListener('click', revokeAccess);

    // Credentials
    document.getElementById('set-authorization-btn').addEventListener('click', setIssuerAuthorization);
    document.getElementById('search-credential-btn').addEventListener('click', searchCredential);
    document.getElementById('revoke-credential-btn').addEventListener('click', revokeCredential);

    // Social
    document.getElementById('review-score').addEventListener('input', (e) => {
        const value = e.target.value;
        document.getElementById('review-score-value').textContent = value;
        const stars = Math.round(value / 20);
        document.getElementById('score-stars').textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    });
    document.getElementById('review-comment').addEventListener('input', (e) => {
        document.getElementById('review-char-count').textContent = e.target.value.length;
    });
    document.getElementById('submit-review-btn').addEventListener('click', submitReview);
    document.getElementById('create-project-btn').addEventListener('click', createProject);
    document.getElementById('update-project-status-btn').addEventListener('click', updateProjectStatus);
    document.getElementById('add-collaborator-btn').addEventListener('click', addCollaborator);
    document.getElementById('endorse-skill-btn').addEventListener('click', endorseSkill);

    // Admin
    document.getElementById('pause-contract-btn').addEventListener('click', pauseContract);
    document.getElementById('unpause-contract-btn').addEventListener('click', unpauseContract);

    // Utilities
    document.getElementById('convert-hash-btn').addEventListener('click', convertHashToBytes32);
    document.getElementById('clear-history-btn').addEventListener('click', clearTransactionHistory);
    document.getElementById('start-event-listener').addEventListener('click', startEventListener);
    document.getElementById('stop-event-listener').addEventListener('click', stopEventListener);
    document.getElementById('export-events-csv').addEventListener('click', exportEventsToCSV);
    document.getElementById('event-filter').addEventListener('change', updateEventsDisplay);

    // IPFS CID validation
    document.getElementById('mint-ipfs-cid').addEventListener('input', (e) => {
        const indicator = e.target.parentElement.querySelector('.validation-indicator');
        if (validateIPFSCID(e.target.value)) {
            indicator.textContent = '✓';
            indicator.className = 'validation-indicator valid';
        } else {
            indicator.textContent = '✗';
            indicator.className = 'validation-indicator invalid';
        }
    });
}

function generateValidCID() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let hash = 'Qm';
    for (let i = 0; i < 44; i++) {
        hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return hash;
}

// Helper functions for UI interactions
function viewTokenDetails(tokenId) {
    // Switch to identity tab and populate search
    document.querySelector('[data-tab="identity"]').click();
    document.getElementById('search-token-id').value = tokenId;
    searchToken();
}

function selectTokenToBurn(tokenId) {
    // Switch to burn section
    document.querySelector('[data-tab="identity"]').click();
    document.getElementById('burn-token-id').value = tokenId;
    document.getElementById('burn-confirm-checkbox').checked = false;
    document.getElementById('burn-token-btn').disabled = true;
    
    // Scroll to burn section
    setTimeout(() => {
        document.querySelector('.card-danger').scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

console.log('✨ Application ready!');
