const { useState, useEffect, useCallback, useMemo } = React;

// Contract ABIs
const SOULBOUND_IDENTITY_ABI = [
    "function mint(string calldata ipfsCID, uint8 burnAuth) external returns (uint256)",
    "function tokensOfOwner(address owner) external view returns (uint256[] memory)",
    "function getMetadata(uint256 tokenId) external view returns (string memory)",
    "function requestAccess(uint256 tokenId) external",
    "function approveAccess(uint256 tokenId, address requester, uint64 duration) external",
    "function denyAccess(uint256 tokenId, address requester) external",
    "function revokeAccess(uint256 tokenId, address requester, string calldata reason) external",
    "function canView(uint256 tokenId, address viewer) external view returns (bool)",
    "function checkAccess(uint256 tokenId, address requester) external view returns (bool hasAccess, uint64 expiresAt)",
    "function getPendingRequests(uint256 tokenId, uint256 offset, uint256 limit) external view returns (address[] memory requesters, uint256 totalCount)",
    "function getAccessStatus(uint256 tokenId, address requester) external view returns (uint8 status)",
    "function ownerOf(uint256 tokenId) external view returns (address)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function getOwnedTokensPaginated(address owner, uint256 offset, uint256 limit) external view returns (uint256[] memory tokenIds, string[] memory metadataCIDs, uint256 totalCount)",
    "event Minted(address indexed to, uint256 indexed tokenId, string ipfsCID, uint8 burnAuth)",
    "event AccessRequested(uint256 indexed tokenId, address indexed requester)",
    "event AccessApproved(uint256 indexed tokenId, address indexed requester, uint64 duration)",
    "event AccessDenied(uint256 indexed tokenId, address indexed requester)",
    "event AccessRevoked(uint256 indexed tokenId, address indexed requester, string reason)"
];

const CREDENTIALS_HUB_ABI = [
    "function issueCredential(uint256 tokenId, uint8 credType, bytes32 metadataHash, uint64 issueDate, uint64 expiryDate, uint8 category) external returns (uint256)",
    "function addCredential(uint256 tokenId, uint8 credType, bytes32 metadataHash, uint64 issueDate, uint64 expiryDate, uint8 category) external returns (uint256)",
    "function revokeCredential(uint256 tokenId, uint256 credentialId) external",
    "function getCredentialsByType(uint256 tokenId, uint8 credType) external view returns (tuple(uint256 credentialId, uint8 credType, bytes32 metadataHash, address issuer, uint64 issueDate, uint64 expiryDate, uint8 status, uint8 category, bool verified)[] memory)",
    "function getCredentialSummary(uint256 tokenId) external view returns (uint256 degrees, uint256 certifications, uint256 workExperience, uint256 identityProofs, uint256 skills)",
    "function getActiveCredentials(uint256 tokenId, uint8 credType) external view returns (tuple(uint256 credentialId, uint8 credType, bytes32 metadataHash, address issuer, uint64 issueDate, uint64 expiryDate, uint8 status, uint8 category, bool verified)[] memory)",
    "function setIssuerAuthorization(uint8 credType, address issuer, bool authorized) external",
    "function authorizedIssuers(uint8 credType, address issuer) external view returns (bool)",
    "event CredentialIssued(uint256 indexed tokenId, uint256 indexed credentialId, uint8 credType, address indexed issuer)",
    "event CredentialRevoked(uint256 indexed tokenId, uint256 indexed credentialId)"
];

const SOCIAL_HUB_ABI = [
    "function submitReview(uint256 subjectTokenId, uint256 reviewerTokenId, uint8 score, bool verified, bool isAnonymous, string calldata comment) external",
    "function getReviews(uint256 tokenId) external view returns (tuple(uint256 reviewId, uint256 reviewerTokenId, uint8 score, bool verified, bool isAnonymous, uint64 createdAt, string comment)[] memory)",
    "function getReputationSummary(uint256 tokenId) external view returns (tuple(uint256 averageScore, uint256 totalReviews, uint256 verifiedReviews) memory)",
    "function createProject(uint256 tokenId, bytes32 metadataHash) external returns (uint256)",
    "function updateProjectStatus(uint256 tokenId, uint256 projectId, uint8 newStatus) external",
    "function addCollaborator(uint256 tokenId, uint256 projectId, uint256 collaboratorTokenId) external",
    "function getProjects(uint256 tokenId) external view returns (tuple(uint256 projectId, bytes32 metadataHash, uint64 createdAt, uint64 completedAt, uint8 status, uint256[] collaborators)[] memory)",
    "function endorseSkill(uint256 subjectTokenId, uint256 endorserTokenId, bytes32 skillHash, string calldata comment) external",
    "function getEndorsements(uint256 tokenId) external view returns (tuple(uint256 endorserId, bytes32 skillHash, uint64 endorsedAt, string comment)[] memory)",
    "function getEndorsementCount(uint256 tokenId, bytes32 skillHash) external view returns (uint256)",
    "event ReviewSubmitted(uint256 indexed subjectTokenId, uint256 indexed reviewerTokenId, uint256 indexed reviewId, uint8 score)",
    "event ProjectCreated(uint256 indexed tokenId, uint256 indexed projectId)",
    "event ProjectStatusUpdated(uint256 indexed tokenId, uint256 indexed projectId, uint8 newStatus)",
    "event CollaboratorAdded(uint256 indexed tokenId, uint256 indexed projectId, uint256 collaboratorTokenId)",
    "event SkillEndorsed(uint256 indexed subjectTokenId, uint256 indexed endorserTokenId, bytes32 skillHash)"
];

// Configuration
const CONFIG = {
    RPC_URL: 'https://rpc.dimikog.org/rpc/',
    CHAIN_ID: 424242,
    NETWORK_NAME: 'QBFT_Besu_EduNet',
    CONTRACTS: {
        SOULBOUND_IDENTITY: '0xf1FB393025ef07673CcFBD5E83E07f6cF503F8ee',
        CREDENTIALS_HUB: '0x25154346a75204f80108E73739f0A4AaD4754c8B',
        SOCIAL_HUB: '0xbe78D2f3c24Abdd91AD8263D7cF10290F94045a7'
    },
    IPFS_GATEWAY: 'https://gateway.pinata.cloud/ipfs/',
    BLOCK_EXPLORER: 'https://explorer.dimikog.org'
};

// Utility Functions
const shortenAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatDate = (timestamp) => {
    if (!timestamp || timestamp === 0) return 'N/A';
    return new Date(timestamp * 1000).toLocaleDateString();
};

const credentialTypes = ['Degree', 'Certification', 'Work Experience', 'Identity Proof', 'Skill'];
const skillCategories = ['Technical', 'Soft', 'Language', 'Domain', 'Tool', 'Other'];
const projectStatuses = ['Planning', 'Active', 'Completed', 'Cancelled'];

// ============================================
// THEME PROVIDER & CONTEXT
// ============================================
const ThemeContext = React.createContext({ 
    theme: 'dark', 
    toggleTheme: () => {} 
});

function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved || 'dark';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    }, []);

    const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

    return React.createElement(
        ThemeContext.Provider,
        { value: value },
        children
    );
}

const useTheme = () => {
    return React.useContext(ThemeContext);
};

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================
const ToastContext = React.createContext({ 
    addToast: () => {} 
});

function Toast({ message, type, onClose }) {
    return (
        <div className={`toast toast-${type}`}>
            <div className="toast-icon">
                {type === 'success' && '✅'}
                {type === 'error' && '❌'}
                {type === 'warning' && '⚠️'}
                {type === 'info' && 'ℹ️'}
            </div>
            <div className="toast-message">{message}</div>
            <button className="toast-close" onClick={onClose}>×</button>
        </div>
    );
}

function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const value = useMemo(() => ({ addToast }), [addToast]);

    return React.createElement(
        ToastContext.Provider,
        { value: value },
        children,
        React.createElement(
            'div',
            { className: 'toast-container' },
            toasts.map(toast => 
                React.createElement(Toast, {
                    key: toast.id,
                    message: toast.message,
                    type: toast.type,
                    onClose: () => removeToast(toast.id)
                })
            )
        )
    );
}

const useToast = () => {
    return React.useContext(ToastContext);
};

// ============================================
// CHECKBOX COMPONENT
// ============================================
const Checkbox = ({ label, checked, onChange }) => (
    <label className="checkbox-label">
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="checkbox-input"
        />
        <span className="checkbox-custom"></span>
        <span>{label}</span>
    </label>
);

// ============================================
// TRANSACTION STATUS WIDGET
// ============================================
function TransactionStatus({ pendingTxs }) {
    const activeTxs = pendingTxs.filter(tx => tx.status === 'pending');
    
    if (activeTxs.length === 0) return null;
    
    return (
        <div className="tx-status-widget">
            <div className="tx-widget-header">
                <span>⏳ Pending Transactions</span>
            </div>
            {activeTxs.map(tx => (
                <div key={tx.id} className="tx-item">
                    <div className="loading-spinner loading-small">
                        <div className="spinner"></div>
                    </div>
                    <span className="tx-description">{tx.description}</span>
                    <a 
                        href={`${CONFIG.BLOCK_EXPLORER}/tx/${tx.hash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="tx-link"
                    >
                        View →
                    </a>
                </div>
            ))}
        </div>
    );
}

// ============================================
// GAS ESTIMATE DISPLAY
// ============================================
function GasEstimate({ gasEstimate }) {
    if (!gasEstimate) return null;
    
    return (
        <div className="gas-estimate">
            <div className="gas-estimate-header">
                <span>⛽ Gas Estimate</span>
            </div>
            <div className="gas-details">
                <div className="gas-item">
                    <span className="gas-label">Limit:</span>
                    <span className="gas-value">{gasEstimate.gasLimit}</span>
                </div>
                <div className="gas-item">
                    <span className="gas-label">Price:</span>
                    <span className="gas-value">{gasEstimate.gasPrice} Gwei</span>
                </div>
                <div className="gas-item">
                    <span className="gas-label">Estimated Cost:</span>
                    <span className="gas-value">{parseFloat(gasEstimate.estimatedCost).toFixed(6)} ETH</span>
                </div>
            </div>
        </div>
    );
}

// ============================================
// IPFS METADATA DISPLAY
// ============================================
function MetadataDisplay({ cid, showNotification }) {
    const [metadata, setMetadata] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    
    useEffect(() => {
        // Create AbortController to cancel fetch if component unmounts
        const abortController = new AbortController();
        let timeoutId;
        
        const fetchMetadata = async () => {
            try {
                setLoading(true);
                setError(false);
                
                // Set a 10-second timeout for the fetch
                timeoutId = setTimeout(() => {
                    abortController.abort();
                }, 10000);
                
                const response = await fetch(`${CONFIG.IPFS_GATEWAY}${cid}`, {
                    signal: abortController.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) throw new Error('Failed to fetch metadata');
                const data = await response.json();
                setMetadata(data);
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.warn('Metadata fetch aborted or timed out');
                    setError(true);
                    if (showNotification) {
                        showNotification('Metadata loading timed out', 'warning');
                    }
                } else {
                    console.error('Failed to fetch IPFS data:', error);
                    setError(true);
                    if (showNotification) {
                        showNotification('Failed to load metadata', 'error');
                    }
                }
            } finally {
                setLoading(false);
            }
        };
        
        if (cid) {
            fetchMetadata();
        }
        
        // Cleanup: abort fetch if component unmounts
        return () => {
            abortController.abort();
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [cid, showNotification]);
    
    if (loading) return <LoadingSpinner />;
    if (error || !metadata) {
        return (
            <div className="metadata-error">
                <p>Failed to load metadata</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    IPFS gateway may be slow or unavailable
                </p>
            </div>
        );
    }
    
    return (
        <div className="metadata-display">
            <h4>Profile Information</h4>
            {metadata.name && (
                <div className="metadata-item">
                    <strong>Name:</strong> {metadata.name}
                </div>
            )}
            {metadata.bio && (
                <div className="metadata-item">
                    <strong>Bio:</strong> {metadata.bio}
                </div>
            )}
            {metadata.email && (
                <div className="metadata-item">
                    <strong>Email:</strong> {metadata.email}
                </div>
            )}
            {metadata.location && (
                <div className="metadata-item">
                    <strong>Location:</strong> {metadata.location}
                </div>
            )}
            {metadata.image && (
                <div className="metadata-image-container">
                    <img 
                        src={`${CONFIG.IPFS_GATEWAY}${metadata.image}`} 
                        alt="Profile" 
                        className="metadata-image"
                    />
                </div>
            )}
        </div>
    );
}


// Styled Components
const Card = ({ children, className = '', style = {} }) => (
    <div className={`card ${className}`} style={style}>
        {children}
    </div>
);

const Button = ({ children, onClick, disabled = false, variant = 'primary', className = '', style = {} }) => (
    <button
        className={`btn btn-${variant} ${className}`}
        onClick={onClick}
        disabled={disabled}
        style={style}
    >
        {children}
    </button>
);

const Input = ({ label, value, onChange, type = 'text', placeholder = '', required = false }) => (
    <div className="input-group">
        {label && <label className="input-label">{label}{required && ' *'}</label>}
        <input
            className="input-field"
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
        />
    </div>
);

const Select = ({ label, value, onChange, options, required = false }) => (
    <div className="input-group">
        {label && <label className="input-label">{label}{required && ' *'}</label>}
        <select className="input-field" value={value} onChange={(e) => onChange(e.target.value)} required={required}>
            <option value="">Select...</option>
            {options.map((opt, idx) => (
                <option key={idx} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);

const TextArea = ({ label, value, onChange, placeholder = '', rows = 4 }) => (
    <div className="input-group">
        {label && <label className="input-label">{label}</label>}
        <textarea
            className="input-field"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
        />
    </div>
);

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{title}</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

const LoadingSpinner = () => (
    <div className="loading-spinner">
        <div className="spinner"></div>
    </div>
);

// Main App Component
function App() {
    const [account, setAccount] = useState(null);
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [contracts, setContracts] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('identity');
    const [userTokens, setUserTokens] = useState([]);
    const [selectedToken, setSelectedToken] = useState(null);
    const [notification, setNotification] = useState(null);
    const [pendingTxs, setPendingTxs] = useState([]);
    const [gasEstimate, setGasEstimate] = useState(null);
    
    // Use enhanced context hooks
    const { addToast } = useToast();
    const { theme, toggleTheme } = useTheme();

    // Connect Wallet
    const connectWallet = async () => {
        try {
            if (!window.ethereum) {
                showNotification('Please install MetaMask!', 'error');
                return;
            }

            setLoading(true);

            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            const account = accounts[0];

            // Check if on correct network
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            if (parseInt(chainId, 16) !== CONFIG.CHAIN_ID) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: `0x${CONFIG.CHAIN_ID.toString(16)}` }],
                    });
                } catch (switchError) {
                    if (switchError.code === 4902) {
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

            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const web3Signer = web3Provider.getSigner();

            setAccount(account);
            setProvider(web3Provider);
            setSigner(web3Signer);

            // Initialize contracts
            const soulboundContract = new ethers.Contract(CONFIG.CONTRACTS.SOULBOUND_IDENTITY, SOULBOUND_IDENTITY_ABI, web3Signer);
            const credentialsContract = new ethers.Contract(CONFIG.CONTRACTS.CREDENTIALS_HUB, CREDENTIALS_HUB_ABI, web3Signer);
            const socialContract = new ethers.Contract(CONFIG.CONTRACTS.SOCIAL_HUB, SOCIAL_HUB_ABI, web3Signer);

            setContracts({
                soulbound: soulboundContract,
                credentials: credentialsContract,
                social: socialContract
            });

            // Load user tokens
            await loadUserTokens(soulboundContract, account);

            showNotification('Wallet connected successfully!', 'success');
            setLoading(false);
        } catch (error) {
            console.error('Error connecting wallet:', error);
            showNotification('Failed to connect wallet', 'error');
            setLoading(false);
        }
    };

    const loadUserTokens = async (contract, addr) => {
        try {
            // Use the efficient paginated function directly - fetches all data in one call
            const result = await contract.getOwnedTokensPaginated(addr, 0, 100);
            const tokenData = result.tokenIds.map((tokenId, index) => ({
                id: tokenId.toNumber(),
                cid: result.metadataCIDs[index]
            }));
            
            setUserTokens(tokenData);
            if (tokenData.length > 0 && !selectedToken) {
                setSelectedToken(tokenData[0]);
            }
        } catch (error) {
            console.error('Error loading tokens:', error);
            showNotification('Failed to load tokens', 'error');
        }
    };

    const showNotification = (message, type = 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    };

    // Track transaction with status
    const trackTransaction = useCallback(async (tx, description) => {
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
            handleError(error, description);
            throw error;
        }
    }, [addToast]);

    // Enhanced error handling
    const handleError = useCallback((error, context) => {
        console.error(`Error in ${context}:`, error);
        
        let message = 'Transaction failed';
        
        if (error.code === 'ACTION_REJECTED') {
            message = 'Transaction rejected by user';
        } else if (error.code === 'INSUFFICIENT_FUNDS') {
            message = 'Insufficient funds for transaction';
        } else if (error.message?.includes('execution reverted')) {
            const reason = error.message.match(/reason="(.+?)"/)?.[1] || 'Contract execution reverted';
            message = reason;
        } else if (error.message?.includes('nonce')) {
            message = 'Nonce too low - please reset your MetaMask account';
        } else if (error.message) {
            message = error.message;
        }
        
        addToast(message, 'error');
        showNotification(message, 'error');
    }, [addToast]);

    // Estimate gas for transaction
    const estimateGas = useCallback(async (contractMethod, ...args) => {
        try {
            const estimate = await contractMethod.estimateGas(...args);
            const gasPrice = await provider.getGasPrice();
            const costInWei = estimate.mul(gasPrice);
            const costInEth = ethers.utils.formatEther(costInWei);
            
            setGasEstimate({
                gasLimit: estimate.toString(),
                gasPrice: ethers.utils.formatUnits(gasPrice, 'gwei'),
                estimatedCost: costInEth
            });
        } catch (error) {
            console.error('Gas estimation failed:', error);
            setGasEstimate(null);
        }
    }, [provider]);

    // Account change listener
    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    setAccount(null);
                    setContracts(null);
                } else {
                    connectWallet();
                }
            });

            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });
        }
    }, []);

    // Setup Event Listeners for Real-time Updates
    useEffect(() => {
        if (!contracts || !selectedToken) return;

        const { soulbound, credentials, social } = contracts;
        const tokenId = selectedToken.id;

        // Identity Events - no need to check tokenId since filters handle it
        const handleMinted = (to, tid, ipfsCID, burnAuth) => {
            console.log('🎉 Token Minted!', { to, tokenId: tid.toString(), ipfsCID });
            addToast(`Token #${tid} minted successfully!`, 'success');
            if (soulbound) loadUserTokens(soulbound, account);
        };

        const handleAccessRequested = (tid, requester) => {
            console.log('🔔 Access Requested', { tokenId: tid.toString(), requester });
            addToast(`New access request from ${shortenAddress(requester)}`, 'info');
        };

        const handleAccessApproved = (tid, requester, duration) => {
            console.log('✅ Access Approved', { tokenId: tid.toString(), requester });
            addToast(`Access approved for ${shortenAddress(requester)}`, 'success');
        };

        const handleAccessRevoked = (tid, requester, reason) => {
            console.log('❌ Access Revoked', { tokenId: tid.toString(), requester, reason });
            addToast(`Access revoked: ${reason}`, 'warning');
        };

        // Credentials Events
        const handleCredentialIssued = (tid, credentialId, credType, issuer) => {
            console.log('📜 Credential Issued', { 
                tokenId: tid.toString(), 
                credentialId: credentialId.toString(), 
                credType 
            });
            const credTypeName = credentialTypes[credType] || 'Unknown';
            addToast(`New ${credTypeName} credential issued!`, 'success');
        };

        const handleCredentialRevoked = (tid, credentialId) => {
            console.log('🚫 Credential Revoked', { 
                tokenId: tid.toString(), 
                credentialId: credentialId.toString() 
            });
            addToast(`Credential #${credentialId} revoked`, 'warning');
        };

        // Social Events
        const handleReviewSubmitted = (subjectTokenId, reviewerTokenId, reviewId, score) => {
            console.log('⭐ Review Submitted', { 
                subjectTokenId: subjectTokenId.toString(), 
                reviewId: reviewId.toString(), 
                score 
            });
            addToast(`New review received (${score}/100)`, 'success');
        };

        const handleProjectCreated = (tid, projectId) => {
            console.log('🚀 Project Created', { 
                tokenId: tid.toString(), 
                projectId: projectId.toString() 
            });
            addToast(`Project #${projectId} created!`, 'success');
        };

        const handleSkillEndorsed = (subjectTokenId, endorserTokenId, skillHash) => {
            console.log('👍 Skill Endorsed', { 
                subjectTokenId: subjectTokenId.toString(), 
                endorserTokenId: endorserTokenId.toString() 
            });
            addToast(`New skill endorsement received!`, 'success');
        };

        // Register FILTERED event listeners - only for user's tokens and account
        // Minted events filtered by recipient (user's account)
        const mintedFilter = soulbound.filters.Minted(account, null);
        soulbound.on(mintedFilter, handleMinted);
        
        // Access events filtered by tokenId
        const accessRequestedFilter = soulbound.filters.AccessRequested(tokenId);
        const accessApprovedFilter = soulbound.filters.AccessApproved(tokenId);
        const accessRevokedFilter = soulbound.filters.AccessRevoked(tokenId);
        soulbound.on(accessRequestedFilter, handleAccessRequested);
        soulbound.on(accessApprovedFilter, handleAccessApproved);
        soulbound.on(accessRevokedFilter, handleAccessRevoked);
        
        // Credential events filtered by tokenId
        const credentialIssuedFilter = credentials.filters.CredentialIssued(tokenId);
        const credentialRevokedFilter = credentials.filters.CredentialRevoked(tokenId);
        credentials.on(credentialIssuedFilter, handleCredentialIssued);
        credentials.on(credentialRevokedFilter, handleCredentialRevoked);
        
        // Social events filtered by tokenId
        const reviewFilter = social.filters.ReviewSubmitted(tokenId);
        const projectFilter = social.filters.ProjectCreated(tokenId);
        const endorseFilter = social.filters.SkillEndorsed(tokenId);
        social.on(reviewFilter, handleReviewSubmitted);
        social.on(projectFilter, handleProjectCreated);
        social.on(endorseFilter, handleSkillEndorsed);

        // Cleanup function - remove all listeners when component unmounts
        return () => {
            soulbound.removeAllListeners();
            credentials.removeAllListeners();
            social.removeAllListeners();
        };
    }, [contracts, selectedToken, account, addToast]);

    return (
        <div className="app-container">
            <TransactionStatus pendingTxs={pendingTxs} />
            
            <Header 
                account={account} 
                onConnect={connectWallet}
                loading={loading}
                theme={theme}
                toggleTheme={toggleTheme}
            />
            
            {notification && (
                <Notification 
                    message={notification.message} 
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}

            {!account ? (
                <WelcomeScreen onConnect={connectWallet} loading={loading} />
            ) : (
                <>
                    <TabNavigation 
                        activeTab={activeTab} 
                        setActiveTab={setActiveTab}
                        userTokens={userTokens}
                    />
                    
                    <main className="main-content">
                        {activeTab === 'identity' && (
                            <IdentityTab
                                contracts={contracts}
                                account={account}
                                userTokens={userTokens}
                                selectedToken={selectedToken}
                                setSelectedToken={setSelectedToken}
                                onTokenCreated={() => loadUserTokens(contracts.soulbound, account)}
                                showNotification={showNotification}
                            />
                        )}
                        
                        {activeTab === 'credentials' && (
                            <CredentialsTab
                                contracts={contracts}
                                selectedToken={selectedToken}
                                userTokens={userTokens}
                                showNotification={showNotification}
                            />
                        )}
                        
                        {activeTab === 'access' && (
                            <AccessControlTab
                                contracts={contracts}
                                selectedToken={selectedToken}
                                userTokens={userTokens}
                                showNotification={showNotification}
                            />
                        )}
                        
                        {activeTab === 'social' && (
                            <SocialTab
                                contracts={contracts}
                                selectedToken={selectedToken}
                                userTokens={userTokens}
                                account={account}
                                showNotification={showNotification}
                            />
                        )}
                        
                        {activeTab === 'analytics' && (
                            <AnalyticsTab
                                contracts={contracts}
                                selectedToken={selectedToken}
                                showNotification={showNotification}
                            />
                        )}
                        
                        {activeTab === 'events' && (
                            <EventsTab
                                contracts={contracts}
                                selectedToken={selectedToken}
                                showNotification={showNotification}
                            />
                        )}
                    </main>
                </>
            )}

            <style jsx>{`
                .app-container {
                    min-height: 100vh;
                    padding-bottom: 50px;
                }

                .main-content {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 30px 20px;
                }

                .card {
                    background: rgba(45, 62, 80, 0.7);
                    backdrop-filter: blur(10px);
                    border-radius: 16px;
                    padding: 24px;
                    margin-bottom: 20px;
                    border: 1px solid rgba(14, 116, 144, 0.3);
                    transition: all 0.3s ease;
                }

                .card:hover {
                    transform: translateY(-2px);
                    border-color: var(--teal);
                    box-shadow: 0 8px 24px rgba(14, 116, 144, 0.2);
                }

                .btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    font-family: 'Work Sans', sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .btn-primary {
                    background: linear-gradient(135deg, var(--teal) 0%, var(--teal-light) 100%);
                    color: white;
                }

                .btn-primary:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(14, 116, 144, 0.4);
                }

                .btn-secondary {
                    background: transparent;
                    color: var(--teal-light);
                    border: 2px solid var(--teal);
                }

                .btn-secondary:hover:not(:disabled) {
                    background: var(--teal);
                    color: white;
                }

                .btn-danger {
                    background: var(--error);
                    color: white;
                }

                .input-group {
                    margin-bottom: 20px;
                }

                .input-label {
                    display: block;
                    margin-bottom: 8px;
                    color: var(--beige);
                    font-size: 14px;
                    font-weight: 500;
                }

                .input-field {
                    width: 100%;
                    padding: 12px 16px;
                    background: rgba(26, 35, 50, 0.5);
                    border: 1px solid rgba(14, 116, 144, 0.3);
                    border-radius: 8px;
                    color: var(--beige);
                    font-family: 'Work Sans', sans-serif;
                    font-size: 14px;
                    transition: all 0.3s ease;
                }

                .input-field:focus {
                    outline: none;
                    border-color: var(--teal);
                    box-shadow: 0 0 0 3px rgba(14, 116, 144, 0.2);
                }

                .input-field::placeholder {
                    color: var(--gray);
                }

                textarea.input-field {
                    resize: vertical;
                    min-height: 100px;
                }

                select.input-field {
                    cursor: pointer;
                }

                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(5px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    animation: fadeIn 0.3s ease-out;
                }

                .modal-content {
                    background: var(--navy);
                    border-radius: 16px;
                    max-width: 600px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    border: 1px solid var(--teal);
                    animation: slideIn 0.3s ease-out;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 24px;
                    border-bottom: 1px solid rgba(14, 116, 144, 0.3);
                }

                .modal-header h2 {
                    color: var(--teal-light);
                    font-size: 24px;
                }

                .modal-close {
                    background: none;
                    border: none;
                    color: var(--beige);
                    font-size: 32px;
                    cursor: pointer;
                    line-height: 1;
                    padding: 0;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: color 0.3s ease;
                }

                .modal-close:hover {
                    color: var(--teal-light);
                }

                .modal-body {
                    padding: 24px;
                }

                .loading-spinner {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 40px;
                }

                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid rgba(14, 116, 144, 0.3);
                    border-top-color: var(--teal);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

// Header Component
function Header({ account, onConnect, loading, theme, toggleTheme }) {
    const [showAccountMenu, setShowAccountMenu] = useState(false);
    
    const copyAddress = () => {
        navigator.clipboard.writeText(account);
        alert('Address copied to clipboard!');
    };
    
    const switchAccount = async () => {
        try {
            await window.ethereum.request({
                method: 'wallet_requestPermissions',
                params: [{ eth_accounts: {} }]
            });
            // This will trigger MetaMask to let user choose account
            window.location.reload();
        } catch (error) {
            console.error('Error switching account:', error);
        }
    };
    
    return (
        <header className="header">
            <div className="header-content">
                <div className="header-left">
                    <h1 className="logo">
                        <span className="logo-icon">⬡</span>
                        SoulBound Identity
                    </h1>
                    <p className="tagline">Decentralized Professional Network</p>
                </div>
                <div className="header-right">
                    <button 
                        className="theme-toggle" 
                        onClick={toggleTheme}
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    
                    {account ? (
                        <div className="account-info">
                            <div className="account-badge" onClick={() => setShowAccountMenu(!showAccountMenu)}>
                                <div className="account-dot"></div>
                                <span>{shortenAddress(account)}</span>
                                <span className="dropdown-arrow">▼</span>
                            </div>
                            {showAccountMenu && (
                                <div className="account-menu">
                                    <button className="menu-item" onClick={copyAddress}>
                                        📋 Copy Address
                                    </button>
                                    <button className="menu-item" onClick={switchAccount}>
                                        🔄 Switch Account
                                    </button>
                                    <div className="menu-divider"></div>
                                    <div className="menu-address">{account}</div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Button onClick={onConnect} disabled={loading}>
                            {loading ? 'Connecting...' : 'Connect Wallet'}
                        </Button>
                    )}
                </div>
            </div>

            <style jsx>{`
                .header {
                    background: rgba(26, 35, 50, 0.95);
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid rgba(14, 116, 144, 0.3);
                    padding: 20px 0;
                    position: sticky;
                    top: 0;
                    z-index: 100;
                }

                .header-content {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .header-left {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .logo {
                    font-family: 'Playfair Display', serif;
                    font-size: 28px;
                    font-weight: 700;
                    color: var(--teal-light);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .logo-icon {
                    font-size: 32px;
                    color: var(--sky);
                }

                .tagline {
                    font-size: 13px;
                    color: var(--gray);
                    font-weight: 300;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    margin-left: 44px;
                }

                .account-info {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .account-badge {
                    background: rgba(14, 116, 144, 0.2);
                    border: 1px solid var(--teal);
                    border-radius: 24px;
                    padding: 10px 20px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .account-badge:hover {
                    background: rgba(14, 116, 144, 0.3);
                    transform: translateY(-1px);
                }

                .account-dot {
                    width: 8px;
                    height: 8px;
                    background: var(--success);
                    border-radius: 50%;
                    animation: pulse 2s ease-in-out infinite;
                }

                .dropdown-arrow {
                    font-size: 10px;
                    color: var(--gray);
                    transition: transform 0.3s ease;
                }

                .account-menu {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 8px;
                    background: rgba(26, 35, 50, 0.98);
                    border: 1px solid var(--teal);
                    border-radius: 12px;
                    padding: 8px;
                    min-width: 250px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
                    animation: slideIn 0.2s ease-out;
                    z-index: 1000;
                }

                .menu-item {
                    width: 100%;
                    background: transparent;
                    border: none;
                    color: var(--beige);
                    padding: 12px 16px;
                    text-align: left;
                    cursor: pointer;
                    border-radius: 6px;
                    font-size: 14px;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .menu-item:hover {
                    background: rgba(14, 116, 144, 0.3);
                }

                .menu-divider {
                    height: 1px;
                    background: rgba(14, 116, 144, 0.3);
                    margin: 8px 0;
                }

                .menu-address {
                    padding: 12px 16px;
                    font-size: 11px;
                    color: var(--gray);
                    font-family: monospace;
                    word-break: break-all;
                    background: rgba(14, 116, 144, 0.1);
                    border-radius: 6px;
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @media (max-width: 768px) {
                    .header-content {
                        flex-direction: column;
                        gap: 16px;
                    }

                    .tagline {
                        margin-left: 0;
                    }
                }
            `}</style>
        </header>
    );
}

// Welcome Screen Component
function WelcomeScreen({ onConnect, loading }) {
    return (
        <div className="welcome-screen">
            <div className="welcome-content slide-in">
                <div className="welcome-icon">⬡</div>
                <h1>Welcome to SoulBound Identity</h1>
                <p className="welcome-description">
                    A decentralized professional identity system built on blockchain technology.
                    Create your soulbound token, manage credentials, and build your professional reputation.
                </p>
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">🔐</div>
                        <h3>Soulbound Tokens</h3>
                        <p>Non-transferable identity credentials that stay with you forever</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">📜</div>
                        <h3>Professional Credentials</h3>
                        <p>Manage degrees, certifications, work experience, and skills</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🤝</div>
                        <h3>Social Features</h3>
                        <p>Build reputation, showcase projects, and receive endorsements</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🔒</div>
                        <h3>Privacy Control</h3>
                        <p>Control who can view your information with granular access control</p>
                    </div>
                </div>
                <Button onClick={onConnect} disabled={loading} style={{ padding: '16px 48px', fontSize: '16px' }}>
                    {loading ? 'Connecting...' : 'Connect Wallet to Get Started'}
                </Button>
            </div>

            <style jsx>{`
                .welcome-screen {
                    min-height: calc(100vh - 120px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                }

                .welcome-content {
                    max-width: 900px;
                    text-align: center;
                }

                .welcome-icon {
                    font-size: 80px;
                    color: var(--teal-light);
                    margin-bottom: 24px;
                }

                .welcome-content h1 {
                    font-size: 48px;
                    color: var(--beige);
                    margin-bottom: 16px;
                }

                .welcome-description {
                    font-size: 18px;
                    color: var(--gray-light);
                    margin-bottom: 48px;
                    line-height: 1.6;
                }

                .features-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 24px;
                    margin-bottom: 48px;
                }

                .feature-card {
                    background: rgba(45, 62, 80, 0.5);
                    border: 1px solid rgba(14, 116, 144, 0.3);
                    border-radius: 12px;
                    padding: 24px;
                    transition: all 0.3s ease;
                }

                .feature-card:hover {
                    transform: translateY(-4px);
                    border-color: var(--teal);
                    box-shadow: 0 8px 24px rgba(14, 116, 144, 0.2);
                }

                .feature-icon {
                    font-size: 40px;
                    margin-bottom: 16px;
                }

                .feature-card h3 {
                    font-size: 18px;
                    color: var(--teal-light);
                    margin-bottom: 8px;
                }

                .feature-card p {
                    font-size: 14px;
                    color: var(--gray-light);
                    line-height: 1.5;
                }

                @media (max-width: 768px) {
                    .welcome-content h1 {
                        font-size: 32px;
                    }

                    .welcome-description {
                        font-size: 16px;
                    }
                }
            `}</style>
        </div>
    );
}

// Tab Navigation Component
function TabNavigation({ activeTab, setActiveTab, userTokens }) {
    const tabs = [
        { id: 'identity', label: 'Identity', icon: '👤' },
        { id: 'credentials', label: 'Credentials', icon: '📜', disabled: userTokens.length === 0 },
        { id: 'access', label: 'Access Control', icon: '🔐', disabled: userTokens.length === 0 },
        { id: 'social', label: 'Social', icon: '🤝', disabled: userTokens.length === 0 },
        { id: 'analytics', label: 'Analytics', icon: '📊', disabled: userTokens.length === 0 },
        { id: 'events', label: 'Activity', icon: '📡', disabled: userTokens.length === 0 },
    ];

    return (
        <nav className="tab-navigation">
            <div className="tab-container">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`tab ${activeTab === tab.id ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
                        onClick={() => !tab.disabled && setActiveTab(tab.id)}
                        disabled={tab.disabled}
                    >
                        <span className="tab-icon">{tab.icon}</span>
                        <span className="tab-label">{tab.label}</span>
                    </button>
                ))}
            </div>

            <style jsx>{`
                .tab-navigation {
                    background: rgba(26, 35, 50, 0.8);
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid rgba(14, 116, 144, 0.3);
                    position: sticky;
                    top: 90px;
                    z-index: 90;
                }

                .tab-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 20px;
                    display: flex;
                    gap: 8px;
                    overflow-x: auto;
                }

                .tab {
                    background: transparent;
                    border: none;
                    color: var(--gray-light);
                    padding: 16px 24px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-family: 'Work Sans', sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.3s ease;
                    border-bottom: 3px solid transparent;
                    white-space: nowrap;
                }

                .tab:hover:not(.disabled) {
                    color: var(--teal-light);
                }

                .tab.active {
                    color: var(--teal-light);
                    border-bottom-color: var(--teal);
                }

                .tab.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .tab-icon {
                    font-size: 20px;
                }

                .tab-label {
                    font-weight: 500;
                }

                @media (max-width: 768px) {
                    .tab {
                        padding: 12px 16px;
                        font-size: 13px;
                    }

                    .tab-icon {
                        font-size: 18px;
                    }
                }
            `}</style>
        </nav>
    );
}

// Notification Component
function Notification({ message, type, onClose }) {
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    return (
        <div className={`notification notification-${type} slide-in`}>
            <span className="notification-icon">{icons[type]}</span>
            <span className="notification-message">{message}</span>
            <button className="notification-close" onClick={onClose}>&times;</button>

            <style jsx>{`
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--navy);
                    border-radius: 12px;
                    padding: 16px 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
                    z-index: 2000;
                    border: 2px solid;
                    max-width: 400px;
                }

                .notification-success {
                    border-color: var(--success);
                }

                .notification-error {
                    border-color: var(--error);
                }

                .notification-warning {
                    border-color: var(--warning);
                }

                .notification-info {
                    border-color: var(--sky);
                }

                .notification-icon {
                    font-size: 20px;
                    font-weight: bold;
                }

                .notification-success .notification-icon {
                    color: var(--success);
                }

                .notification-error .notification-icon {
                    color: var(--error);
                }

                .notification-warning .notification-icon {
                    color: var(--warning);
                }

                .notification-info .notification-icon {
                    color: var(--sky);
                }

                .notification-message {
                    flex: 1;
                    color: var(--beige);
                    font-size: 14px;
                }

                .notification-close {
                    background: none;
                    border: none;
                    color: var(--gray);
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                }

                .notification-close:hover {
                    color: var(--beige);
                }

                @media (max-width: 768px) {
                    .notification {
                        left: 20px;
                        right: 20px;
                        max-width: none;
                    }
                }
            `}</style>
        </div>
    );
}

// Continue in next part due to length...

// Render App
ReactDOM.render(<App />, document.getElementById('root'));
// Identity Tab Component
function IdentityTab({ contracts, account, userTokens, selectedToken, setSelectedToken, onTokenCreated, showNotification }) {
    const [showMintModal, setShowMintModal] = useState(false);
    const [minting, setMinting] = useState(false);
    const [mintData, setMintData] = useState({
        name: '',
        bio: '',
        profileImage: '',
        burnAuth: '0'
    });

    const handleMint = async () => {
        try {
            setMinting(true);

            // Create metadata object
            const metadata = {
                name: mintData.name,
                bio: mintData.bio,
                profileImage: mintData.profileImage,
                createdAt: Date.now()
            };

            // In production, upload to IPFS via Pinata
            // For demo, using a valid mock CID (CIDv0 format: Qm + 44 base58 chars)
            // Generate a valid base58 string (using valid characters: 1-9, A-H, J-N, P-Z, a-k, m-z)
            const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
            let mockCID = 'Qm';
            for (let i = 0; i < 44; i++) {
                mockCID += base58Chars.charAt(Math.floor(Math.random() * base58Chars.length));
            }
            
            // Mint token
            const tx = await contracts.soulbound.mint(mockCID, parseInt(mintData.burnAuth));
            showNotification('Transaction submitted. Waiting for confirmation...', 'info');
            
            await tx.wait();
            showNotification('Identity token minted successfully!', 'success');
            
            setShowMintModal(false);
            setMintData({ name: '', bio: '', profileImage: '', burnAuth: '0' });
            onTokenCreated();
        } catch (error) {
            console.error('Error minting token:', error);
            showNotification(error.message || 'Failed to mint token', 'error');
        } finally {
            setMinting(false);
        }
    };

    return (
        <div className="identity-tab">
            <div className="tab-header">
                <div>
                    <h2>My Identity Tokens</h2>
                    <p className="tab-description">Create and manage your soulbound identity tokens</p>
                </div>
                <Button onClick={() => setShowMintModal(true)}>
                    <span style={{ marginRight: '8px' }}>+</span>
                    Mint New Token
                </Button>
            </div>

            {userTokens.length === 0 ? (
                <Card>
                    <div className="empty-state">
                        <div className="empty-icon">🪪</div>
                        <h3>No Identity Tokens Yet</h3>
                        <p>Create your first soulbound identity token to get started</p>
                        <Button onClick={() => setShowMintModal(true)} style={{ marginTop: '20px' }}>
                            Create Identity Token
                        </Button>
                    </div>
                </Card>
            ) : (
                <div className="tokens-grid">
                    {userTokens.map((token) => (
                        <TokenCard
                            key={token.id}
                            token={token}
                            isSelected={selectedToken === token.id}
                            onSelect={() => setSelectedToken(token.id)}
                            contracts={contracts}
                        />
                    ))}
                </div>
            )}

            <Modal isOpen={showMintModal} onClose={() => setShowMintModal(false)} title="Mint Identity Token">
                <div className="mint-form">
                    <Input
                        label="Full Name"
                        value={mintData.name}
                        onChange={(val) => setMintData({ ...mintData, name: val })}
                        placeholder="Enter your full name"
                        required
                    />
                    
                    <TextArea
                        label="Bio"
                        value={mintData.bio}
                        onChange={(val) => setMintData({ ...mintData, bio: val })}
                        placeholder="Tell us about yourself..."
                        rows={4}
                    />
                    
                    <Input
                        label="Profile Image URL (Optional)"
                        value={mintData.profileImage}
                        onChange={(val) => setMintData({ ...mintData, profileImage: val })}
                        placeholder="https://..."
                    />
                    
                    <Select
                        label="Burn Authorization"
                        value={mintData.burnAuth}
                        onChange={(val) => setMintData({ ...mintData, burnAuth: val })}
                        options={[
                            { value: '0', label: 'Neither (Permanent)' },
                            { value: '1', label: 'Owner Only' },
                            { value: '2', label: 'Issuer Only' },
                            { value: '3', label: 'Both' }
                        ]}
                        required
                    />

                    <div className="info-box">
                        <strong>Note:</strong> This metadata will be stored on IPFS. Your identity token is soulbound (non-transferable).
                    </div>

                    <div className="modal-actions">
                        <Button variant="secondary" onClick={() => setShowMintModal(false)} disabled={minting}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleMint} 
                            disabled={minting || !mintData.name}
                        >
                            {minting ? 'Minting...' : 'Mint Token'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <style jsx>{`
                .identity-tab {
                    animation: fadeIn 0.5s ease-out;
                }

                .tab-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 30px;
                }

                .tab-header h2 {
                    font-size: 32px;
                    color: var(--teal-light);
                    margin-bottom: 8px;
                }

                .tab-description {
                    color: var(--gray-light);
                    font-size: 14px;
                }

                .empty-state {
                    text-align: center;
                    padding: 60px 20px;
                }

                .empty-icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }

                .empty-state h3 {
                    font-size: 24px;
                    color: var(--beige);
                    margin-bottom: 12px;
                }

                .empty-state p {
                    color: var(--gray-light);
                    font-size: 16px;
                }

                .tokens-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 20px;
                }

                .mint-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .info-box {
                    background: rgba(56, 189, 248, 0.1);
                    border: 1px solid var(--sky);
                    border-radius: 8px;
                    padding: 16px;
                    color: var(--beige);
                    font-size: 13px;
                    line-height: 1.5;
                }

                .modal-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 24px;
                }

                @media (max-width: 768px) {
                    .tab-header {
                        flex-direction: column;
                        gap: 16px;
                    }

                    .tokens-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}

// Token Card Component
function TokenCard({ token, isSelected, onSelect, contracts }) {
    const [metadata, setMetadata] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);

    useEffect(() => {
        loadMetadata();
    }, [token.cid]);

    const loadMetadata = async () => {
        try {
            // In production, fetch from IPFS
            // For demo, using mock data
            setMetadata({
                name: `Token #${token.id}`,
                bio: 'This is a soulbound identity token representing a unique professional identity.',
                profileImage: ''
            });
        } catch (error) {
            console.error('Error loading metadata:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCardClick = (e) => {
        // Open details modal when clicking anywhere on the card
        setShowDetails(true);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    if (loading) {
        return (
            <Card className={`token-card ${isSelected ? 'selected' : ''}`}>
                <LoadingSpinner />
            </Card>
        );
    }

    return (
        <>
            <Card className={`token-card ${isSelected ? 'selected' : ''}`}>
                <div className="token-header" onClick={onSelect} style={{ cursor: 'pointer' }}>
                    <div className="token-avatar">
                        {metadata?.profileImage ? (
                            <img src={metadata.profileImage} alt="Profile" />
                        ) : (
                            <div className="avatar-placeholder">👤</div>
                        )}
                    </div>
                    <div className="token-info">
                        <h3>{metadata?.name || `Token #${token.id}`}</h3>
                        <span className="token-id">ID: {token.id}</span>
                    </div>
                </div>
                
                {metadata?.bio && (
                    <p className="token-bio">{metadata.bio}</p>
                )}

                <div className="token-cid">
                    <span className="cid-label">IPFS CID:</span>
                    <code className="cid-value">{token.cid.substring(0, 20)}...</code>
                </div>

                <div className="token-actions">
                    <button 
                        className="view-details-btn"
                        onClick={() => setShowDetails(true)}
                    >
                        👁️ View Full Details
                    </button>
                </div>

                {isSelected && (
                    <div className="selected-badge">
                        ✓ Selected
                    </div>
                )}
            </Card>

            <Modal isOpen={showDetails} onClose={() => setShowDetails(false)} title={`Token #${token.id} Details`}>
                <div className="token-details">
                    <div className="detail-section">
                        <h4>Token Information</h4>
                        <div className="detail-row">
                            <span className="detail-label">Token ID:</span>
                            <span className="detail-value">{token.id}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Name:</span>
                            <span className="detail-value">{metadata?.name}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Type:</span>
                            <span className="detail-value">Soulbound Token (Non-transferable)</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Status:</span>
                            <span className="detail-value" style={{ color: isSelected ? 'var(--teal-light)' : 'var(--gray)' }}>
                                {isSelected ? '✓ Currently Selected' : 'Not Selected'}
                            </span>
                        </div>
                    </div>

                    <div className="detail-section">
                        <h4>Biography</h4>
                        <p className="bio-full">{metadata?.bio}</p>
                    </div>

                    <div className="detail-section">
                        <h4>IPFS Metadata</h4>
                        <div className="cid-display">
                            <code className="full-cid">{token.cid}</code>
                            <button 
                                className="copy-btn"
                                onClick={() => copyToClipboard(token.cid)}
                            >
                                📋 Copy
                            </button>
                        </div>
                        <a 
                            href={`https://gateway.pinata.cloud/ipfs/${token.cid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ipfs-link"
                        >
                            🔗 View on IPFS Gateway
                        </a>
                    </div>

                    <div className="detail-section">
                        <h4>Blockchain Information</h4>
                        <div className="detail-row">
                            <span className="detail-label">Contract:</span>
                            <code className="detail-value">{CONFIG.CONTRACTS.SOULBOUND_IDENTITY}</code>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Network:</span>
                            <span className="detail-value">{CONFIG.NETWORK_NAME}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Chain ID:</span>
                            <span className="detail-value">{CONFIG.CHAIN_ID}</span>
                        </div>
                    </div>

                    {!isSelected && (
                        <div className="modal-actions" style={{ marginTop: '24px' }}>
                            <Button 
                                onClick={() => {
                                    onSelect();
                                    setShowDetails(false);
                                }}
                            >
                                Select This Token
                            </Button>
                        </div>
                    )}
                </div>

                <style jsx>{`
                    .token-details {
                        display: flex;
                        flex-direction: column;
                        gap: 24px;
                    }

                    .detail-section {
                        border-bottom: 1px solid rgba(14, 116, 144, 0.2);
                        padding-bottom: 20px;
                    }

                    .detail-section:last-child {
                        border-bottom: none;
                        padding-bottom: 0;
                    }

                    .detail-section h4 {
                        color: var(--teal-light);
                        font-size: 16px;
                        margin-bottom: 12px;
                    }

                    .detail-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 0;
                        gap: 16px;
                    }

                    .detail-label {
                        color: var(--gray);
                        font-size: 14px;
                        font-weight: 500;
                    }

                    .detail-value {
                        color: var(--beige);
                        font-size: 14px;
                        text-align: right;
                        word-break: break-word;
                    }

                    code.detail-value {
                        color: var(--teal-light);
                        font-family: monospace;
                        font-size: 12px;
                    }

                    .bio-full {
                        color: var(--gray-light);
                        font-size: 14px;
                        line-height: 1.6;
                    }

                    .cid-display {
                        display: flex;
                        gap: 12px;
                        align-items: center;
                        background: rgba(26, 35, 50, 0.5);
                        padding: 12px;
                        border-radius: 8px;
                        margin-bottom: 12px;
                    }

                    .full-cid {
                        flex: 1;
                        color: var(--teal-light);
                        font-family: monospace;
                        font-size: 12px;
                        word-break: break-all;
                    }

                    .copy-btn {
                        background: var(--teal);
                        border: none;
                        color: white;
                        padding: 6px 12px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 12px;
                        white-space: nowrap;
                        transition: all 0.3s ease;
                    }

                    .copy-btn:hover {
                        background: var(--teal-light);
                        transform: translateY(-1px);
                    }

                    .ipfs-link {
                        display: inline-block;
                        color: var(--sky);
                        text-decoration: none;
                        font-size: 14px;
                        transition: color 0.3s ease;
                    }

                    .ipfs-link:hover {
                        color: var(--sky-light);
                        text-decoration: underline;
                    }
                `}</style>
            </Modal>

            <style jsx>{`
                .token-card {
                    cursor: default;
                    position: relative;
                    transition: all 0.3s ease;
                }

                .token-card.selected {
                    border-color: var(--teal-light);
                    box-shadow: 0 0 0 2px rgba(14, 116, 144, 0.3);
                }

                .token-header {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 16px;
                }

                .token-avatar {
                    width: 60px;
                    height: 60px;
                    border-radius: 12px;
                    overflow: hidden;
                    background: rgba(14, 116, 144, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .token-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .avatar-placeholder {
                    font-size: 32px;
                }

                .token-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }

                .token-info h3 {
                    font-size: 18px;
                    color: var(--beige);
                    margin-bottom: 4px;
                }

                .token-id {
                    font-size: 12px;
                    color: var(--gray);
                    font-family: monospace;
                }

                .token-bio {
                    color: var(--gray-light);
                    font-size: 14px;
                    line-height: 1.5;
                    margin-bottom: 16px;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .token-cid {
                    background: rgba(26, 35, 50, 0.5);
                    border-radius: 6px;
                    padding: 8px 12px;
                    font-size: 12px;
                }

                .cid-label {
                    color: var(--gray);
                    margin-right: 8px;
                }

                .cid-value {
                    color: var(--teal-light);
                    font-family: monospace;
                }

                .token-actions {
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid rgba(14, 116, 144, 0.2);
                }

                .view-details-btn {
                    width: 100%;
                    padding: 12px;
                    background: var(--teal);
                    border: none;
                    color: white;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                }

                .view-details-btn:hover {
                    background: var(--teal-light);
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(14, 116, 144, 0.4);
                }

                .selected-badge {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    background: var(--teal);
                    color: white;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                }
            `}</style>
        </>
    );
}
// Credentials Tab Component
function CredentialsTab({ contracts, selectedToken, userTokens, showNotification }) {
    const [credentials, setCredentials] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedType, setSelectedType] = useState(0);
    const [credentialData, setCredentialData] = useState({
        credType: '0',
        institution: '',
        title: '',
        description: '',
        issueDate: '',
        expiryDate: '',
        category: '0'
    });

    useEffect(() => {
        if (selectedToken && contracts) {
            loadCredentials();
            loadSummary();
        }
    }, [selectedToken, contracts]);

    const loadCredentials = async () => {
        if (!selectedToken) return;
        
        setLoading(true);
        try {
            const allCreds = [];
            for (let type = 0; type < 5; type++) {
                const creds = await contracts.credentials.getCredentialsByType(selectedToken, type);
                allCreds.push(...creds.map(c => ({ ...c, credType: type })));
            }
            setCredentials(allCreds);
        } catch (error) {
            console.error('Error loading credentials:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSummary = async () => {
        if (!selectedToken) return;
        
        try {
            const sum = await contracts.credentials.getCredentialSummary(selectedToken);
            setSummary({
                degrees: sum.degrees.toNumber(),
                certifications: sum.certifications.toNumber(),
                workExperience: sum.workExperience.toNumber(),
                identityProofs: sum.identityProofs.toNumber(),
                skills: sum.skills.toNumber()
            });
        } catch (error) {
            console.error('Error loading summary:', error);
        }
    };

    const handleAddCredential = async () => {
        try {
            setLoading(true);

            // Create metadata object
            const metadata = {
                institution: credentialData.institution,
                title: credentialData.title,
                description: credentialData.description,
                issuedBy: 'Self-Reported'
            };

            // In production, upload to IPFS
            const metadataHash = ethers.utils.id(JSON.stringify(metadata));
            
            const issueDate = credentialData.issueDate ? Math.floor(new Date(credentialData.issueDate).getTime() / 1000) : Math.floor(Date.now() / 1000);
            const expiryDate = credentialData.expiryDate ? Math.floor(new Date(credentialData.expiryDate).getTime() / 1000) : 0;

            // Validate dates
            if (expiryDate !== 0 && expiryDate <= issueDate) {
                showNotification('Expiry date must be after issue date!', 'error');
                setLoading(false);
                return;
            }

            const tx = await contracts.credentials.addCredential(
                selectedToken,
                parseInt(credentialData.credType),
                metadataHash,
                issueDate,
                expiryDate,
                parseInt(credentialData.category)
            );

            showNotification('Transaction submitted...', 'info');
            await tx.wait();
            showNotification('Credential added successfully!', 'success');

            setShowAddModal(false);
            setCredentialData({
                credType: '0',
                institution: '',
                title: '',
                description: '',
                issueDate: '',
                expiryDate: '',
                category: '0'
            });
            loadCredentials();
            loadSummary();
        } catch (error) {
            console.error('Error adding credential:', error);
            showNotification(error.message || 'Failed to add credential', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (credId) => {
        try {
            const tx = await contracts.credentials.revokeCredential(selectedToken, credId);
            showNotification('Revoking credential...', 'info');
            await tx.wait();
            showNotification('Credential revoked', 'success');
            loadCredentials();
        } catch (error) {
            console.error('Error revoking credential:', error);
            showNotification('Failed to revoke credential', 'error');
        }
    };

    if (!selectedToken) {
        return (
            <Card>
                <div className="empty-state">
                    <div className="empty-icon">📜</div>
                    <h3>Select an Identity Token</h3>
                    <p>Choose a token from the Identity tab to manage credentials</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="credentials-tab">
            <div className="tab-header">
                <div>
                    <h2>Professional Credentials</h2>
                    <p className="tab-description">Manage your degrees, certifications, work experience, and skills</p>
                </div>
                <Button onClick={() => setShowAddModal(true)}>
                    <span style={{ marginRight: '8px' }}>+</span>
                    Add Credential
                </Button>
            </div>

            {summary && (
                <div className="summary-cards">
                    <SummaryCard icon="🎓" label="Degrees" count={summary.degrees} color="var(--teal)" />
                    <SummaryCard icon="📜" label="Certifications" count={summary.certifications} color="var(--sky)" />
                    <SummaryCard icon="💼" label="Work Experience" count={summary.workExperience} color="var(--teal-light)" />
                    <SummaryCard icon="🆔" label="Identity Proofs" count={summary.identityProofs} color="var(--sky-light)" />
                    <SummaryCard icon="⚡" label="Skills" count={summary.skills} color="var(--teal-dark)" />
                </div>
            )}

            <div className="credentials-filter">
                <div className="filter-buttons">
                    <button
                        className={`filter-btn ${selectedType === null ? 'active' : ''}`}
                        onClick={() => setSelectedType(null)}
                    >
                        All ({credentials.length})
                    </button>
                    {credentialTypes.map((type, idx) => (
                        <button
                            key={idx}
                            className={`filter-btn ${selectedType === idx ? 'active' : ''}`}
                            onClick={() => setSelectedType(idx)}
                        >
                            {type} ({credentials.filter(c => c.credType === idx).length})
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <Card>
                    <LoadingSpinner />
                </Card>
            ) : credentials.length === 0 ? (
                <Card>
                    <div className="empty-state">
                        <div className="empty-icon">📄</div>
                        <h3>No Credentials Yet</h3>
                        <p>Start adding your professional credentials</p>
                    </div>
                </Card>
            ) : (
                <div className="credentials-list">
                    {credentials
                        .filter(c => selectedType === null || c.credType === selectedType)
                        .map((cred, idx) => (
                            <CredentialCard
                                key={idx}
                                credential={cred}
                                onRevoke={() => handleRevoke(cred.credentialId)}
                            />
                        ))}
                </div>
            )}

            <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Credential">
                <div className="credential-form">
                    <Select
                        label="Credential Type"
                        value={credentialData.credType}
                        onChange={(val) => setCredentialData({ ...credentialData, credType: val })}
                        options={credentialTypes.map((type, idx) => ({ value: idx.toString(), label: type }))}
                        required
                    />

                    <Input
                        label="Institution / Organization"
                        value={credentialData.institution}
                        onChange={(val) => setCredentialData({ ...credentialData, institution: val })}
                        placeholder="e.g., MIT, Google, AWS"
                        required
                    />

                    <Input
                        label="Title / Name"
                        value={credentialData.title}
                        onChange={(val) => setCredentialData({ ...credentialData, title: val })}
                        placeholder="e.g., Bachelor of Science, AWS Certified Developer"
                        required
                    />

                    <TextArea
                        label="Description"
                        value={credentialData.description}
                        onChange={(val) => setCredentialData({ ...credentialData, description: val })}
                        placeholder="Add details about this credential..."
                        rows={3}
                    />

                    <div className="date-fields">
                        <Input
                            label="Issue Date"
                            value={credentialData.issueDate}
                            onChange={(val) => setCredentialData({ ...credentialData, issueDate: val })}
                            type="date"
                        />

                        <Input
                            label="Expiry Date (Optional)"
                            value={credentialData.expiryDate}
                            onChange={(val) => setCredentialData({ ...credentialData, expiryDate: val })}
                            type="date"
                        />
                    </div>
                    
                    <div className="info-box" style={{ background: 'rgba(56, 189, 248, 0.1)', borderColor: 'var(--sky)' }}>
                        <strong>💡 Tip:</strong> Leave expiry date empty if the credential never expires. If set, expiry date must be after issue date.
                    </div>

                    {credentialData.credType === '4' && (
                        <Select
                            label="Skill Category"
                            value={credentialData.category}
                            onChange={(val) => setCredentialData({ ...credentialData, category: val })}
                            options={skillCategories.map((cat, idx) => ({ value: idx.toString(), label: cat }))}
                        />
                    )}

                    <div className="info-box">
                        <strong>Note:</strong> This credential will be marked as unverified. Contact an authorized issuer for verification.
                    </div>

                    <div className="modal-actions">
                        <Button variant="secondary" onClick={() => setShowAddModal(false)} disabled={loading}>
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleAddCredential}
                            disabled={loading || !credentialData.institution || !credentialData.title}
                        >
                            {loading ? 'Adding...' : 'Add Credential'}
                        </Button>
                    </div>
                </div>
            </Modal>

            <style jsx>{`
                .credentials-tab {
                    animation: fadeIn 0.5s ease-out;
                }

                .tab-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 30px;
                }

                .tab-header h2 {
                    font-size: 32px;
                    color: var(--teal-light);
                    margin-bottom: 8px;
                }

                .tab-description {
                    color: var(--gray-light);
                    font-size: 14px;
                }

                .summary-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                    margin-bottom: 30px;
                }

                .credentials-filter {
                    margin-bottom: 20px;
                }

                .filter-buttons {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .filter-btn {
                    background: rgba(45, 62, 80, 0.5);
                    border: 1px solid rgba(14, 116, 144, 0.3);
                    color: var(--gray-light);
                    padding: 8px 16px;
                    border-radius: 20px;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .filter-btn:hover {
                    border-color: var(--teal);
                    color: var(--teal-light);
                }

                .filter-btn.active {
                    background: var(--teal);
                    border-color: var(--teal);
                    color: white;
                }

                .credentials-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .credential-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .date-fields {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }

                .empty-state {
                    text-align: center;
                    padding: 60px 20px;
                }

                .empty-icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }

                .empty-state h3 {
                    font-size: 24px;
                    color: var(--beige);
                    margin-bottom: 12px;
                }

                .empty-state p {
                    color: var(--gray-light);
                    font-size: 16px;
                }

                .info-box {
                    background: rgba(245, 158, 11, 0.1);
                    border: 1px solid var(--warning);
                    border-radius: 8px;
                    padding: 16px;
                    color: var(--beige);
                    font-size: 13px;
                    line-height: 1.5;
                }

                .modal-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 24px;
                }

                @media (max-width: 768px) {
                    .tab-header {
                        flex-direction: column;
                        gap: 16px;
                    }

                    .date-fields {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}

// Summary Card Component
function SummaryCard({ icon, label, count, color }) {
    return (
        <div className="summary-card" style={{ borderColor: color }}>
            <div className="summary-icon" style={{ color }}>{icon}</div>
            <div className="summary-info">
                <div className="summary-count" style={{ color }}>{count}</div>
                <div className="summary-label">{label}</div>
            </div>

            <style jsx>{`
                .summary-card {
                    background: rgba(45, 62, 80, 0.5);
                    border: 2px solid;
                    border-radius: 12px;
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    transition: all 0.3s ease;
                }

                .summary-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
                }

                .summary-icon {
                    font-size: 36px;
                }

                .summary-info {
                    flex: 1;
                }

                .summary-count {
                    font-size: 32px;
                    font-weight: 700;
                    font-family: 'Playfair Display', serif;
                    line-height: 1;
                    margin-bottom: 4px;
                }

                .summary-label {
                    font-size: 13px;
                    color: var(--gray-light);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
            `}</style>
        </div>
    );
}

// Credential Card Component
function CredentialCard({ credential, onRevoke }) {
    const [showDetails, setShowDetails] = useState(false);
    
    const statusColors = {
        0: 'var(--success)', // Active
        1: 'var(--error)',   // Revoked
        2: 'var(--warning)'  // Expired
    };

    const statusLabels = ['Active', 'Revoked', 'Expired'];
    const typeIcons = ['🎓', '📜', '💼', '🆔', '⚡'];

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    return (
        <>
            <Card className="credential-card">
                <div className="credential-header">
                    <div className="credential-type-badge">
                        <span className="type-icon">{typeIcons[credential.credType]}</span>
                        <span className="type-label">{credentialTypes[credential.credType]}</span>
                    </div>
                    <div className="credential-status" style={{ color: statusColors[credential.status] }}>
                        {statusLabels[credential.status]}
                    </div>
                </div>

                <div className="credential-body">
                    <h3 className="credential-title">Credential ID: {credential.credentialId.toString()}</h3>
                    <div className="credential-meta">
                        <div className="meta-item">
                            <span className="meta-label">Issuer:</span>
                            <code className="meta-value">{shortenAddress(credential.issuer)}</code>
                        </div>
                        <div className="meta-item">
                            <span className="meta-label">Issue Date:</span>
                            <span className="meta-value">{formatDate(credential.issueDate)}</span>
                        </div>
                        {credential.expiryDate > 0 && (
                            <div className="meta-item">
                                <span className="meta-label">Expiry Date:</span>
                                <span className="meta-value">{formatDate(credential.expiryDate)}</span>
                            </div>
                        )}
                        <div className="meta-item">
                            <span className="meta-label">Verified:</span>
                            <span className="meta-value">{credential.verified ? '✓ Yes' : '✗ No'}</span>
                        </div>
                    </div>
                </div>

                <div className="credential-actions">
                    <button 
                        className="view-credential-btn"
                        onClick={() => setShowDetails(true)}
                    >
                        👁️ View Details
                    </button>
                    {credential.status === 0 && (
                        <Button variant="danger" onClick={onRevoke} style={{ fontSize: '12px', padding: '8px 16px' }}>
                            Revoke
                        </Button>
                    )}
                </div>
            </Card>

            <Modal isOpen={showDetails} onClose={() => setShowDetails(false)} title={`Credential #${credential.credentialId.toString()} Details`}>
                <div className="credential-details">
                    <div className="detail-section">
                        <h4>Credential Information</h4>
                        <div className="detail-row">
                            <span className="detail-label">Credential ID:</span>
                            <span className="detail-value">{credential.credentialId.toString()}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Type:</span>
                            <span className="detail-value">{typeIcons[credential.credType]} {credentialTypes[credential.credType]}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Status:</span>
                            <span className="detail-value" style={{ color: statusColors[credential.status] }}>
                                {statusLabels[credential.status]}
                            </span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Verified:</span>
                            <span className="detail-value" style={{ color: credential.verified ? 'var(--success)' : 'var(--warning)' }}>
                                {credential.verified ? '✓ Verified by Issuer' : '✗ Self-Reported (Unverified)'}
                            </span>
                        </div>
                        {credential.credType === 4 && (
                            <div className="detail-row">
                                <span className="detail-label">Category:</span>
                                <span className="detail-value">{skillCategories[credential.category]}</span>
                            </div>
                        )}
                    </div>

                    <div className="detail-section">
                        <h4>Issuer Information</h4>
                        <div className="detail-row">
                            <span className="detail-label">Issuer Address:</span>
                            <code className="detail-value">{credential.issuer}</code>
                        </div>
                        <button 
                            className="copy-btn"
                            onClick={() => copyToClipboard(credential.issuer)}
                            style={{ marginTop: '8px' }}
                        >
                            📋 Copy Issuer Address
                        </button>
                    </div>

                    <div className="detail-section">
                        <h4>Dates</h4>
                        <div className="detail-row">
                            <span className="detail-label">Issue Date:</span>
                            <span className="detail-value">{formatDate(credential.issueDate)}</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Expiry Date:</span>
                            <span className="detail-value">
                                {credential.expiryDate > 0 ? formatDate(credential.expiryDate) : 'Never Expires'}
                            </span>
                        </div>
                        {credential.expiryDate > 0 && (
                            <div className="detail-row">
                                <span className="detail-label">Days Until Expiry:</span>
                                <span className="detail-value">
                                    {Math.max(0, Math.floor((credential.expiryDate - Date.now() / 1000) / 86400))} days
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="detail-section">
                        <h4>Metadata</h4>
                        <div className="cid-display">
                            <code className="full-cid">{credential.metadataHash}</code>
                            <button 
                                className="copy-btn"
                                onClick={() => copyToClipboard(credential.metadataHash)}
                            >
                                📋 Copy
                            </button>
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--gray)', marginTop: '12px' }}>
                            This hash represents the IPFS metadata containing detailed information about this credential.
                        </p>
                    </div>

                    <div className="detail-section">
                        <h4>Blockchain Information</h4>
                        <div className="detail-row">
                            <span className="detail-label">Contract:</span>
                            <code className="detail-value">{CONFIG.CONTRACTS.CREDENTIALS_HUB}</code>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">Network:</span>
                            <span className="detail-value">{CONFIG.NETWORK_NAME}</span>
                        </div>
                    </div>
                </div>

                <style jsx>{`
                    .credential-details {
                        display: flex;
                        flex-direction: column;
                        gap: 24px;
                    }

                    .detail-section {
                        border-bottom: 1px solid rgba(14, 116, 144, 0.2);
                        padding-bottom: 20px;
                    }

                    .detail-section:last-child {
                        border-bottom: none;
                        padding-bottom: 0;
                    }

                    .detail-section h4 {
                        color: var(--teal-light);
                        font-size: 16px;
                        margin-bottom: 12px;
                    }

                    .detail-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 0;
                        gap: 16px;
                    }

                    .detail-label {
                        color: var(--gray);
                        font-size: 14px;
                        font-weight: 500;
                    }

                    .detail-value {
                        color: var(--beige);
                        font-size: 14px;
                        text-align: right;
                        word-break: break-word;
                    }

                    code.detail-value {
                        color: var(--teal-light);
                        font-family: monospace;
                        font-size: 12px;
                    }

                    .cid-display {
                        display: flex;
                        gap: 12px;
                        align-items: center;
                        background: rgba(26, 35, 50, 0.5);
                        padding: 12px;
                        border-radius: 8px;
                    }

                    .full-cid {
                        flex: 1;
                        color: var(--teal-light);
                        font-family: monospace;
                        font-size: 12px;
                        word-break: break-all;
                    }

                    .copy-btn {
                        background: var(--teal);
                        border: none;
                        color: white;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 12px;
                        white-space: nowrap;
                        transition: all 0.3s ease;
                    }

                    .copy-btn:hover {
                        background: var(--teal-light);
                        transform: translateY(-1px);
                    }
                `}</style>
            </Modal>

            <style jsx>{`
                .credential-card {
                    border-left: 4px solid ${statusColors[credential.status]};
                }

                .credential-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .credential-type-badge {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(14, 116, 144, 0.2);
                    padding: 6px 12px;
                    border-radius: 16px;
                }

                .type-icon {
                    font-size: 18px;
                }

                .type-label {
                    font-size: 13px;
                    color: var(--teal-light);
                    font-weight: 500;
                }

                .credential-status {
                    font-size: 13px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .credential-body {
                    margin-bottom: 16px;
                }

                .credential-title {
                    font-size: 16px;
                    color: var(--beige);
                    margin-bottom: 12px;
                    font-family: monospace;
                }

                .credential-meta {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 12px;
                }

                .meta-item {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .meta-label {
                    font-size: 12px;
                    color: var(--gray);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .meta-value {
                    font-size: 14px;
                    color: var(--beige);
                }

                code.meta-value {
                    font-family: monospace;
                    color: var(--teal-light);
                }

                .credential-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 12px;
                    padding-top: 16px;
                    border-top: 1px solid rgba(14, 116, 144, 0.2);
                }

                .view-credential-btn {
                    flex: 1;
                    padding: 10px 16px;
                    background: var(--teal);
                    border: none;
                    color: white;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }

                .view-credential-btn:hover {
                    background: var(--teal-light);
                    transform: translateY(-1px);
                }
            `}</style>
        </>
    );
}
// Access Control Tab Component
function AccessControlTab({ contracts, selectedToken, userTokens, showNotification }) {
    const [pendingRequests, setPendingRequests] = useState([]);
    const [grantedAccess, setGrantedAccess] = useState([]);
    const [tokensICanAccess, setTokensICanAccess] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestTokenId, setRequestTokenId] = useState('');
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewingToken, setViewingToken] = useState(null);

    useEffect(() => {
        if (selectedToken && contracts) {
            loadAccessData();
        }
        if (contracts) {
            loadTokensICanAccess();
        }
    }, [selectedToken, contracts]);

    const loadAccessData = async () => {
        if (!selectedToken) return;
        
        setLoading(true);
        try {
            // Load pending requests
            const requests = await contracts.soulbound.getPendingRequests(selectedToken, 0, 50);
            setPendingRequests(requests.requesters);
            
            // Load granted access by checking stored addresses
            // Note: Your contract doesn't have a getGrantedAccess function
            // So we'll track addresses we've approved
            const storedGrantedAddresses = JSON.parse(
                localStorage.getItem(`grantedAccess_${selectedToken}`) || '[]'
            );
            
            // Verify each address still has access
            const stillActive = [];
            for (const address of storedGrantedAddresses) {
                try {
                    const [hasAccess, expiresAt] = await contracts.soulbound.checkAccess(selectedToken, address);
                    if (hasAccess) {
                        stillActive.push({
                            address,
                            expiresAt: expiresAt.toNumber()
                        });
                    }
                } catch (err) {
                    // Address no longer has access, skip it
                    continue;
                }
            }
            
            // Update localStorage with only active addresses
            localStorage.setItem(
                `grantedAccess_${selectedToken}`,
                JSON.stringify(stillActive.map(item => item.address))
            );
            
            setGrantedAccess(stillActive);
        } catch (error) {
            console.error('Error loading access data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTokensICanAccess = async () => {
        if (!contracts) return;
        
        try {
            const accessibleTokens = [];
            // Check a range of token IDs
            // For demo purposes, checking first 10 tokens (adjust based on your needs)
            const maxTokenId = 10;
            
            for (let tokenId = 1; tokenId <= maxTokenId; tokenId++) {
                try {
                    // First check if token exists
                    const owner = await contracts.soulbound.ownerOf(tokenId);
                    const myAddress = await contracts.soulbound.signer.getAddress();
                    
                    // Skip if I'm the owner
                    if (owner.toLowerCase() === myAddress.toLowerCase()) {
                        continue;
                    }
                    
                    // Check if I have access
                    const hasAccess = await contracts.soulbound.canView(tokenId, myAddress);
                    
                    // Only include if I have access
                    if (hasAccess) {
                        const [, expiresAt] = await contracts.soulbound.checkAccess(tokenId, myAddress);
                        
                        // Try to get metadata, but don't fail if we can't
                        let metadataCID = '';
                        try {
                            metadataCID = await contracts.soulbound.getMetadata(tokenId);
                        } catch (metadataError) {
                            console.log(`Could not fetch metadata for token ${tokenId}:`, metadataError.message);
                            // Continue without CID
                        }
                        
                        accessibleTokens.push({
                            tokenId,
                            owner,
                            expiresAt: expiresAt.toNumber(),
                            cid: metadataCID || 'N/A'
                        });
                    }
                } catch (err) {
                    // Token doesn't exist or other error, skip it
                    continue;
                }
            }
            setTokensICanAccess(accessibleTokens);
        } catch (error) {
            console.error('Error loading accessible tokens:', error);
        }
    };

    const handleRequestAccess = async () => {
        try {
            if (!requestTokenId) return;
            
            const tx = await contracts.soulbound.requestAccess(parseInt(requestTokenId));
            showNotification('Requesting access...', 'info');
            await tx.wait();
            showNotification('Access request sent!', 'success');
            setShowRequestModal(false);
            setRequestTokenId('');
        } catch (error) {
            console.error('Error requesting access:', error);
            showNotification(error.message || 'Failed to request access', 'error');
        }
    };

    const handleApproveAccess = async (requester) => {
        try {
            // Grant access for 30 days
            const duration = 30 * 24 * 60 * 60;
            const tx = await contracts.soulbound.approveAccess(selectedToken, requester, duration);
            showNotification('Approving access...', 'info');
            await tx.wait();
            
            // Track granted address in localStorage
            const storedGranted = JSON.parse(
                localStorage.getItem(`grantedAccess_${selectedToken}`) || '[]'
            );
            if (!storedGranted.includes(requester)) {
                storedGranted.push(requester);
                localStorage.setItem(`grantedAccess_${selectedToken}`, JSON.stringify(storedGranted));
            }
            
            showNotification('Access approved!', 'success');
            loadAccessData();
        } catch (error) {
            console.error('Error approving access:', error);
            showNotification('Failed to approve access', 'error');
        }
    };

    const handleDenyAccess = async (requester) => {
        try {
            const tx = await contracts.soulbound.denyAccess(selectedToken, requester);
            showNotification('Denying access...', 'info');
            await tx.wait();
            showNotification('Access denied', 'success');
            loadAccessData();
        } catch (error) {
            console.error('Error denying access:', error);
            showNotification('Failed to deny access', 'error');
        }
    };

    const handleRevokeAccess = async (requester) => {
        try {
            const reason = "Access revoked by token owner";
            const tx = await contracts.soulbound.revokeAccess(selectedToken, requester, reason);
            showNotification('Revoking access...', 'info');
            await tx.wait();
            
            // Remove from localStorage
            const storedGranted = JSON.parse(
                localStorage.getItem(`grantedAccess_${selectedToken}`) || '[]'
            );
            const updated = storedGranted.filter(addr => addr.toLowerCase() !== requester.toLowerCase());
            localStorage.setItem(`grantedAccess_${selectedToken}`, JSON.stringify(updated));
            
            showNotification('Access revoked!', 'success');
            loadAccessData();
        } catch (error) {
            console.error('Error revoking access:', error);
            showNotification('Failed to revoke access', 'error');
        }
    };

    if (!selectedToken) {
        return (
            <Card>
                <div className="empty-state">
                    <div className="empty-icon">🔐</div>
                    <h3>Select an Identity Token</h3>
                    <p>Choose a token from the Identity tab to manage access</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="access-tab">
            <div className="tab-header">
                <div>
                    <h2>Access Control</h2>
                    <p className="tab-description">Manage who can view your identity and credentials</p>
                </div>
                <Button onClick={() => setShowRequestModal(true)}>
                    Request Access to Token
                </Button>
            </div>

            <div className="access-sections">
                <Card>
                    <div className="section-header">
                        <h3>Pending Access Requests</h3>
                        <span className="badge">{pendingRequests.length}</span>
                    </div>
                    
                    {loading ? (
                        <LoadingSpinner />
                    ) : pendingRequests.length === 0 ? (
                        <div className="empty-message">
                            <p>No pending access requests</p>
                        </div>
                    ) : (
                        <div className="requests-list">
                            {pendingRequests.map((requester, idx) => (
                                <div key={idx} className="request-item">
                                    <div className="requester-info">
                                        <div className="requester-avatar">👤</div>
                                        <div>
                                            <div className="requester-address">{shortenAddress(requester)}</div>
                                            <div className="requester-label">Wallet Address</div>
                                        </div>
                                    </div>
                                    <div className="request-actions">
                                        <Button 
                                            onClick={() => handleApproveAccess(requester)}
                                            style={{ padding: '8px 16px', fontSize: '13px' }}
                                        >
                                            Approve
                                        </Button>
                                        <Button 
                                            variant="danger"
                                            onClick={() => handleDenyAccess(requester)}
                                            style={{ padding: '8px 16px', fontSize: '13px' }}
                                        >
                                            Deny
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <Card>
                    <div className="section-header">
                        <h3>Granted Access</h3>
                        <span className="badge">{grantedAccess.length}</span>
                    </div>
                    
                    {loading ? (
                        <LoadingSpinner />
                    ) : grantedAccess.length === 0 ? (
                        <div className="empty-message">
                            <p>You haven't granted access to anyone yet</p>
                        </div>
                    ) : (
                        <div className="requests-list">
                            {grantedAccess.map((item, idx) => (
                                <div key={idx} className="request-item">
                                    <div className="requester-info">
                                        <div className="requester-avatar">✓</div>
                                        <div>
                                            <div className="requester-address">{shortenAddress(item.address)}</div>
                                            <div className="requester-label">
                                                Access expires: {formatDate(item.expiresAt)}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="request-actions">
                                        <Button 
                                            variant="danger"
                                            onClick={() => handleRevokeAccess(item.address)}
                                            style={{ padding: '8px 16px', fontSize: '13px' }}
                                        >
                                            Revoke Access
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <Card>
                    <div className="section-header">
                        <h3>Tokens I Can Access</h3>
                        <span className="badge">{tokensICanAccess.length}</span>
                    </div>
                    
                    {tokensICanAccess.length === 0 ? (
                        <div className="empty-message">
                            <p>No access granted yet. Request access to view other identities.</p>
                        </div>
                    ) : (
                        <div className="requests-list">
                            {tokensICanAccess.map((item, idx) => (
                                <div key={idx} className="request-item">
                                    <div className="requester-info">
                                        <div className="requester-avatar">🪪</div>
                                        <div>
                                            <div className="requester-address">Token #{item.tokenId}</div>
                                            <div className="requester-label">
                                                Owner: {shortenAddress(item.owner)}
                                            </div>
                                            <div className="requester-label" style={{ color: 'var(--teal-light)', marginTop: '4px' }}>
                                                {item.expiresAt > 0 && item.expiresAt < Date.now() / 1000 
                                                    ? '⚠️ Access Expired' 
                                                    : `✓ Access until ${formatDate(item.expiresAt)}`
                                                }
                                            </div>
                                        </div>
                                    </div>
                                    <div className="request-actions">
                                        <Button 
                                            onClick={async () => {
                                                try {
                                                    const summary = await contracts.credentials.getCredentialSummary(item.tokenId);
                                                    setViewingToken({
                                                        ...item,
                                                        summary: {
                                                            degrees: summary.degrees.toNumber(),
                                                            certifications: summary.certifications.toNumber(),
                                                            workExperience: summary.workExperience.toNumber(),
                                                            identityProofs: summary.identityProofs.toNumber(),
                                                            skills: summary.skills.toNumber()
                                                        }
                                                    });
                                                    setShowViewModal(true);
                                                } catch (error) {
                                                    showNotification('Failed to load token details', 'error');
                                                }
                                            }}
                                            style={{ padding: '8px 16px', fontSize: '13px' }}
                                        >
                                            👁️ View Details
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                <Card>
                    <div className="section-header">
                        <h3>Privacy Settings</h3>
                    </div>
                    <div className="privacy-info">
                        <div className="info-item">
                            <div className="info-icon">🔒</div>
                            <div>
                                <h4>Default Privacy</h4>
                                <p>Your identity and credentials are private by default. Only you can view them unless you grant access.</p>
                            </div>
                        </div>
                        <div className="info-item">
                            <div className="info-icon">⏱️</div>
                            <div>
                                <h4>Time-Limited Access</h4>
                                <p>When you approve access, it's granted for 30 days by default. You can revoke access at any time.</p>
                            </div>
                        </div>
                        <div className="info-item">
                            <div className="info-icon">🛡️</div>
                            <div>
                                <h4>Request Tracking</h4>
                                <p>All access requests are tracked on-chain for transparency and security.</p>
                            </div>
                        </div>
                        <div className="info-item">
                            <div className="info-icon">ℹ️</div>
                            <div>
                                <h4>Full Access Grant</h4>
                                <p>Currently, approving access grants view permission to all credentials (degrees, certifications, work experience, skills, and identity proofs). Granular per-type access control is planned for future versions.</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            <Modal isOpen={showRequestModal} onClose={() => setShowRequestModal(false)} title="Request Access">
                <div className="request-form">
                    <Input
                        label="Token ID"
                        value={requestTokenId}
                        onChange={setRequestTokenId}
                        placeholder="Enter token ID"
                        type="number"
                        required
                    />
                    
                    <div className="info-box">
                        <strong>Note:</strong> You're requesting access to view another user's identity and credentials. The owner will need to approve your request.
                    </div>

                    <div className="modal-actions">
                        <Button variant="secondary" onClick={() => setShowRequestModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleRequestAccess} disabled={!requestTokenId}>
                            Send Request
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title={viewingToken ? `Token #${viewingToken.tokenId} Details` : 'Token Details'}>
                {viewingToken && (
                    <div className="token-view-details">
                        <div className="detail-section">
                            <h4>Token Information</h4>
                            <div className="detail-row">
                                <span className="detail-label">Token ID:</span>
                                <span className="detail-value">{viewingToken.tokenId}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Owner:</span>
                                <code className="detail-value">{viewingToken.owner}</code>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Access Expires:</span>
                                <span className="detail-value">
                                    {viewingToken.expiresAt > 0 ? formatDate(viewingToken.expiresAt) : 'Never'}
                                </span>
                            </div>
                        </div>

                        {viewingToken.cid && (
                            <div className="detail-section">
                                <h4>IPFS Metadata</h4>
                                <div className="cid-display">
                                    <code className="full-cid">{viewingToken.cid}</code>
                                    <button 
                                        className="copy-btn"
                                        onClick={() => {
                                            navigator.clipboard.writeText(viewingToken.cid);
                                            alert('CID copied to clipboard!');
                                        }}
                                    >
                                        📋 Copy
                                    </button>
                                </div>
                            </div>
                        )}

                        {viewingToken.summary && (
                            <div className="detail-section">
                                <h4>Credentials Summary</h4>
                                <div className="credentials-grid">
                                    <div className="cred-item">
                                        <span className="cred-icon">🎓</span>
                                        <span className="cred-count">{viewingToken.summary.degrees}</span>
                                        <span className="cred-label">{viewingToken.summary.degrees === 1 ? 'Degree' : 'Degrees'}</span>
                                    </div>
                                    <div className="cred-item">
                                        <span className="cred-icon">📜</span>
                                        <span className="cred-count">{viewingToken.summary.certifications}</span>
                                        <span className="cred-label">{viewingToken.summary.certifications === 1 ? 'Certification' : 'Certifications'}</span>
                                    </div>
                                    <div className="cred-item">
                                        <span className="cred-icon">💼</span>
                                        <span className="cred-count">{viewingToken.summary.workExperience}</span>
                                        <span className="cred-label">Work Experience</span>
                                    </div>
                                    <div className="cred-item">
                                        <span className="cred-icon">🆔</span>
                                        <span className="cred-count">{viewingToken.summary.identityProofs}</span>
                                        <span className="cred-label">{viewingToken.summary.identityProofs === 1 ? 'Identity Proof' : 'Identity Proofs'}</span>
                                    </div>
                                    <div className="cred-item">
                                        <span className="cred-icon">⚡</span>
                                        <span className="cred-count">{viewingToken.summary.skills}</span>
                                        <span className="cred-label">{viewingToken.summary.skills === 1 ? 'Skill' : 'Skills'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <style jsx>{`
                .access-tab {
                    animation: fadeIn 0.5s ease-out;
                }

                .tab-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 30px;
                }

                .tab-header h2 {
                    font-size: 32px;
                    color: var(--teal-light);
                    margin-bottom: 8px;
                }

                .tab-description {
                    color: var(--gray-light);
                    font-size: 14px;
                }

                .access-sections {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid rgba(14, 116, 144, 0.3);
                }

                .section-header h3 {
                    font-size: 20px;
                    color: var(--beige);
                }

                .badge {
                    background: var(--teal);
                    color: white;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 13px;
                    font-weight: 600;
                }

                .empty-message {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--gray-light);
                }

                .requests-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .request-item {
                    background: rgba(26, 35, 50, 0.5);
                    border-radius: 8px;
                    padding: 16px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                }

                .requester-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .requester-avatar {
                    width: 40px;
                    height: 40px;
                    background: rgba(14, 116, 144, 0.2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                }

                .requester-address {
                    font-family: monospace;
                    color: var(--teal-light);
                    font-size: 14px;
                }

                .requester-label {
                    font-size: 12px;
                    color: var(--gray);
                    margin-top: 2px;
                }

                .request-actions {
                    display: flex;
                    gap: 8px;
                }

                .privacy-info {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .info-item {
                    display: flex;
                    gap: 16px;
                    align-items: flex-start;
                }

                .info-icon {
                    font-size: 32px;
                    flex-shrink: 0;
                }

                .info-item h4 {
                    font-size: 16px;
                    color: var(--beige);
                    margin-bottom: 8px;
                }

                .info-item p {
                    font-size: 14px;
                    color: var(--gray-light);
                    line-height: 1.6;
                }

                .request-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .info-box {
                    background: rgba(56, 189, 248, 0.1);
                    border: 1px solid var(--sky);
                    border-radius: 8px;
                    padding: 16px;
                    color: var(--beige);
                    font-size: 13px;
                    line-height: 1.5;
                }

                .modal-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 24px;
                }

                .empty-state {
                    text-align: center;
                    padding: 60px 20px;
                }

                .empty-icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }

                .empty-state h3 {
                    font-size: 24px;
                    color: var(--beige);
                    margin-bottom: 12px;
                }

                .empty-state p {
                    color: var(--gray-light);
                    font-size: 16px;
                }

                @media (max-width: 768px) {
                    .tab-header {
                        flex-direction: column;
                        gap: 16px;
                    }

                    .request-item {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .request-actions {
                        width: 100%;
                    }

                    .request-actions button {
                        flex: 1;
                    }
                }
            `}</style>
        </div>
    );
}

// Social Tab Component
function SocialTab({ contracts, selectedToken, userTokens, account, showNotification }) {
    const [activeSection, setActiveSection] = useState('reputation');
    const [reputation, setReputation] = useState(null);
    const [reviews, setReviews] = useState([]);
    const [reviewsWritten, setReviewsWritten] = useState([]);
    const [projects, setProjects] = useState([]);
    const [myProjects, setMyProjects] = useState([]);
    const [collaboratingOn, setCollaboratingOn] = useState([]);
    const [endorsements, setEndorsements] = useState([]);
    const [endorsementCounts, setEndorsementCounts] = useState({});
    const [loading, setLoading] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showEndorseModal, setShowEndorseModal] = useState(false);

    useEffect(() => {
        if (selectedToken && contracts) {
            loadSocialData();
            loadMyActivity();
        }
    }, [selectedToken, contracts]);

    const loadSocialData = async () => {
        if (!selectedToken) return;
        
        setLoading(true);
        try {
            // Load reputation
            const rep = await contracts.social.getReputationSummary(selectedToken);
            setReputation({
                averageScore: rep.averageScore.toNumber(),
                totalReviews: rep.totalReviews.toNumber(),
                verifiedReviews: rep.verifiedReviews.toNumber()
            });

            // Load reviews received
            const revs = await contracts.social.getReviews(selectedToken);
            setReviews(revs);

            // Load projects
            const projs = await contracts.social.getProjects(selectedToken);
            setProjects(projs);
            setMyProjects(projs); // These are projects on my token

            // Load endorsements received
            const ends = await contracts.social.getEndorsements(selectedToken);
            setEndorsements(ends);
            
            // Count endorsements per skill
            const counts = {};
            ends.forEach(end => {
                const skillHash = end.skillHash;
                counts[skillHash] = (counts[skillHash] || 0) + 1;
            });
            setEndorsementCounts(counts);
        } catch (error) {
            console.error('Error loading social data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMyActivity = async () => {
        if (!selectedToken) return;
        
        try {
            // Load reviews I've written
            const writtenReviews = [];
            const storedReviews = JSON.parse(localStorage.getItem(`reviews_written_${selectedToken}`) || '[]');
            console.log(`Loading reviews for token ${selectedToken}, found ${storedReviews.length} stored reviews`);
            
            for (const item of storedReviews) {
                try {
                    const tokenReviews = await contracts.social.getReviews(item.targetTokenId);
                    console.log(`Checking token ${item.targetTokenId}, found ${tokenReviews.length} reviews`);
                    // Find my review in their reviews
                    const myReview = tokenReviews.find(r => 
                        r.reviewerTokenId.toString() === selectedToken.toString()
                    );
                    if (myReview) {
                        console.log('Found my review!', myReview);
                        writtenReviews.push({
                            ...myReview,
                            targetTokenId: item.targetTokenId
                        });
                    } else {
                        console.log('My review not found in their reviews');
                    }
                } catch (err) {
                    console.log('Could not load review for token', item.targetTokenId, err);
                }
            }
            console.log(`Total reviews written: ${writtenReviews.length}`);
            setReviewsWritten(writtenReviews);

            // Load projects I'm collaborating on (other people's projects)
            const collaborations = [];
            const storedCollabs = JSON.parse(localStorage.getItem(`collaborations_${selectedToken}`) || '[]');
            
            for (const item of storedCollabs) {
                try {
                    const tokenProjects = await contracts.social.getProjects(item.ownerTokenId);
                    const project = tokenProjects.find(p => 
                        p.projectId.toString() === item.projectId.toString()
                    );
                    if (project) {
                        collaborations.push({
                            ...project,
                            ownerTokenId: item.ownerTokenId
                        });
                    }
                } catch (err) {
                    console.log('Could not load collaboration');
                }
            }
            setCollaboratingOn(collaborations);
        } catch (error) {
            console.error('Error loading my activity:', error);
        }
    };

    if (!selectedToken) {
        return (
            <Card>
                <div className="empty-state">
                    <div className="empty-icon">🤝</div>
                    <h3>Select an Identity Token</h3>
                    <p>Choose a token from the Identity tab to view social features</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="social-tab">
            <div className="tab-header">
                <div>
                    <h2>Social Hub</h2>
                    <p className="tab-description">Build reputation, showcase projects, and receive endorsements</p>
                </div>
            </div>

            <div className="social-nav">
                <button
                    className={`social-nav-btn ${activeSection === 'reputation' ? 'active' : ''}`}
                    onClick={() => setActiveSection('reputation')}
                >
                    ⭐ Reputation
                </button>
                <button
                    className={`social-nav-btn ${activeSection === 'projects' ? 'active' : ''}`}
                    onClick={() => setActiveSection('projects')}
                >
                    📁 Projects
                </button>
                <button
                    className={`social-nav-btn ${activeSection === 'endorsements' ? 'active' : ''}`}
                    onClick={() => setActiveSection('endorsements')}
                >
                    👍 Endorsements
                </button>
            </div>

            {activeSection === 'reputation' && (
                <ReputationSection
                    reputation={reputation}
                    reviews={reviews}
                    reviewsWritten={reviewsWritten}
                    loading={loading}
                    contracts={contracts}
                    selectedToken={selectedToken}
                    userTokens={userTokens}
                    showNotification={showNotification}
                    onReload={loadSocialData}
                />
            )}

            {activeSection === 'projects' && (
                <ProjectsSection
                    projects={projects}
                    collaboratingOn={collaboratingOn}
                    loading={loading}
                    contracts={contracts}
                    selectedToken={selectedToken}
                    showNotification={showNotification}
                    onReload={loadSocialData}
                />
            )}

            {activeSection === 'endorsements' && (
                <EndorsementsSection
                    endorsements={endorsements}
                    loading={loading}
                    contracts={contracts}
                    selectedToken={selectedToken}
                    userTokens={userTokens}
                    showNotification={showNotification}
                    onReload={loadSocialData}
                />
            )}

            <style jsx>{`
                .social-tab {
                    animation: fadeIn 0.5s ease-out;
                }

                .tab-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 30px;
                }

                .tab-header h2 {
                    font-size: 32px;
                    color: var(--teal-light);
                    margin-bottom: 8px;
                }

                .tab-description {
                    color: var(--gray-light);
                    font-size: 14px;
                }

                .social-nav {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 30px;
                    border-bottom: 2px solid rgba(14, 116, 144, 0.3);
                }

                .social-nav-btn {
                    background: transparent;
                    border: none;
                    color: var(--gray-light);
                    padding: 12px 24px;
                    font-family: 'Work Sans', sans-serif;
                    font-size: 15px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border-bottom: 3px solid transparent;
                    margin-bottom: -2px;
                }

                .social-nav-btn:hover {
                    color: var(--teal-light);
                }

                .social-nav-btn.active {
                    color: var(--teal-light);
                    border-bottom-color: var(--teal);
                }

                .empty-state {
                    text-align: center;
                    padding: 60px 20px;
                }

                .empty-icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }

                .empty-state h3 {
                    font-size: 24px;
                    color: var(--beige);
                    margin-bottom: 12px;
                }

                .empty-state p {
                    color: var(--gray-light);
                    font-size: 16px;
                }

                @media (max-width: 768px) {
                    .social-nav {
                        overflow-x: auto;
                    }

                    .social-nav-btn {
                        white-space: nowrap;
                        padding: 12px 16px;
                        font-size: 14px;
                    }
                }
            `}</style>
        </div>
    );
}

// Reputation Section Component
function ReputationSection({ reputation, reviews, reviewsWritten, loading, contracts, selectedToken, userTokens, showNotification, onReload }) {
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewData, setReviewData] = useState({
        targetTokenId: '',
        reviewerTokenId: '',
        score: '75',
        verified: false,
        isAnonymous: false,
        comment: ''
    });

    const handleSubmitReview = async () => {
        try {
            if (!reviewData.targetTokenId || !reviewData.reviewerTokenId) {
                showNotification('Please fill in all required fields', 'error');
                return;
            }

            const targetId = parseInt(reviewData.targetTokenId);
            const reviewerId = parseInt(reviewData.reviewerTokenId);

            // Validation 1: Can't review yourself
            if (targetId === reviewerId) {
                showNotification('You cannot review yourself!', 'error');
                return;
            }

            // Validation 2: Check if target token exists
            try {
                await contracts.soulbound.ownerOf(targetId);
            } catch (err) {
                showNotification(`Token #${targetId} does not exist!`, 'error');
                return;
            }

            // Validation 3: Check if you own the reviewer token
            try {
                const owner = await contracts.soulbound.ownerOf(reviewerId);
                const myAddress = await contracts.soulbound.signer.getAddress();
                if (owner.toLowerCase() !== myAddress.toLowerCase()) {
                    showNotification(`You don't own Token #${reviewerId}!`, 'error');
                    return;
                }
            } catch (err) {
                showNotification(`Token #${reviewerId} does not exist!`, 'error');
                return;
            }

            const tx = await contracts.social.submitReview(
                targetId,
                reviewerId,
                parseInt(reviewData.score),
                reviewData.verified,
                reviewData.isAnonymous,
                reviewData.comment
            );
            showNotification('Submitting review...', 'info');
            await tx.wait();
            
            // Track this review in localStorage
            const storedReviews = JSON.parse(localStorage.getItem(`reviews_written_${reviewerId}`) || '[]');
            storedReviews.push({
                targetTokenId: targetId,
                timestamp: Date.now()
            });
            localStorage.setItem(`reviews_written_${reviewerId}`, JSON.stringify(storedReviews));
            
            showNotification('Review submitted successfully!', 'success');
            setShowReviewModal(false);
            setReviewData({ targetTokenId: '', reviewerTokenId: '', score: '75', verified: false, isAnonymous: false, comment: '' });
            onReload();
        } catch (error) {
            console.error('Error submitting review:', error);
            showNotification(error.message || 'Failed to submit review', 'error');
        }
    };

    return (
        <div className="reputation-section">
            {reputation && (
                <div className="reputation-summary">
                    <Card className="rep-card">
                        <div className="rep-metric">
                            <div className="rep-value">{reputation.averageScore}</div>
                            <div className="rep-label">Average Score</div>
                        </div>
                    </Card>
                    <Card className="rep-card">
                        <div className="rep-metric">
                            <div className="rep-value">{reputation.totalReviews}</div>
                            <div className="rep-label">Total Reviews</div>
                        </div>
                    </Card>
                    <Card className="rep-card">
                        <div className="rep-metric">
                            <div className="rep-value">{reputation.verifiedReviews}</div>
                            <div className="rep-label">Verified Reviews</div>
                        </div>
                    </Card>
                </div>
            )}

            <Card>
                <div className="section-header">
                    <h3>Reviews</h3>
                    <Button onClick={() => setShowReviewModal(true)}>
                        Write Review
                    </Button>
                </div>

                {loading ? (
                    <LoadingSpinner />
                ) : reviews.length === 0 ? (
                    <div className="empty-message">
                        <p>No reviews yet</p>
                    </div>
                ) : (
                    <div className="reviews-list">
                        {reviews.map((review, idx) => (
                            <div key={idx} className="review-item">
                                <div className="review-header">
                                    <div className="reviewer-info">
                                        {review.isAnonymous ? (
                                            <span>Anonymous</span>
                                        ) : (
                                            <span>Token #{review.reviewerTokenId.toString()}</span>
                                        )}
                                        {review.verified && <span className="verified-badge">✓ Verified</span>}
                                    </div>
                                    <div className="review-score">{review.score}/100</div>
                                </div>
                                {review.comment && <p className="review-comment">{review.comment}</p>}
                                <div className="review-date">{formatDate(review.createdAt)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Card>
                <div className="section-header">
                    <h3>Reviews I've Written</h3>
                    <span className="badge">{reviewsWritten?.length || 0}</span>
                </div>

                <div className="info-box" style={{ background: 'rgba(56, 189, 248, 0.1)', fontSize: '12px', marginBottom: '16px' }}>
                    <strong>Debug:</strong> Checking localStorage key: reviews_written_{selectedToken}
                    {(() => {
                        const stored = localStorage.getItem(`reviews_written_${selectedToken}`);
                        return stored ? ` - Found ${JSON.parse(stored).length} stored reviews` : ' - No stored reviews found';
                    })()}
                </div>

                {loading ? (
                    <LoadingSpinner />
                ) : !reviewsWritten || reviewsWritten.length === 0 ? (
                    <div className="empty-message">
                        <p>You haven't written any reviews yet</p>
                        <button 
                            onClick={() => {
                                console.log('All localStorage keys:', Object.keys(localStorage).filter(k => k.startsWith('reviews_written_')));
                                alert('Check browser console for all review keys');
                            }}
                            style={{ 
                                marginTop: '12px', 
                                padding: '8px 16px', 
                                background: 'var(--teal)', 
                                border: 'none', 
                                borderRadius: '6px', 
                                color: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            Show All Review Keys (Debug)
                        </button>
                    </div>
                ) : (
                    <div className="reviews-list">
                        {reviewsWritten.map((review, idx) => (
                            <div key={idx} className="review-item">
                                <div className="review-header">
                                    <div className="reviewer-info">
                                        <span>For Token #{review.targetTokenId}</span>
                                        {review.verified && <span className="verified-badge">✓ Verified</span>}
                                    </div>
                                    <div className="review-score">{review.score}/100</div>
                                </div>
                                {review.comment && <p className="review-comment">{review.comment}</p>}
                                <div className="review-date">{formatDate(review.createdAt)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Modal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} title="Write Review">
                <div className="review-form">
                    <Input
                        label="Token ID to Review"
                        value={reviewData.targetTokenId || ''}
                        onChange={(val) => setReviewData({ ...reviewData, targetTokenId: val })}
                        placeholder="Enter token ID you want to review"
                        type="number"
                        required
                    />

                    <Select
                        label="Your Token ID (Reviewer)"
                        value={reviewData.reviewerTokenId}
                        onChange={(val) => setReviewData({ ...reviewData, reviewerTokenId: val })}
                        options={userTokens.map(t => ({ value: t.id.toString(), label: `Token #${t.id}` }))}
                        required
                    />

                    <div className="input-group">
                        <label className="input-label">Score (0-100) *</label>
                        <input
                            className="input-field"
                            type="range"
                            min="0"
                            max="100"
                            value={reviewData.score}
                            onChange={(e) => setReviewData({ ...reviewData, score: e.target.value })}
                        />
                        <div style={{ textAlign: 'center', color: 'var(--teal-light)', fontSize: '24px', fontWeight: '600' }}>
                            {reviewData.score}
                        </div>
                    </div>

                    <TextArea
                        label="Comment (Optional)"
                        value={reviewData.comment}
                        onChange={(val) => setReviewData({ ...reviewData, comment: val })}
                        placeholder="Share your experience..."
                        rows={3}
                    />

                    <div className="checkbox-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={reviewData.verified}
                                onChange={(e) => setReviewData({ ...reviewData, verified: e.target.checked })}
                            />
                            <span>We worked together</span>
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={reviewData.isAnonymous}
                                onChange={(e) => setReviewData({ ...reviewData, isAnonymous: e.target.checked })}
                            />
                            <span>Submit anonymously</span>
                        </label>
                    </div>

                    <div className="modal-actions">
                        <Button variant="secondary" onClick={() => setShowReviewModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmitReview} disabled={!reviewData.reviewerTokenId}>
                            Submit Review
                        </Button>
                    </div>
                </div>
            </Modal>

            <style jsx>{`
                .reputation-summary {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .rep-card {
                    text-align: center;
                }

                .rep-metric {
                    padding: 20px;
                }

                .rep-value {
                    font-size: 48px;
                    font-weight: 700;
                    color: var(--teal-light);
                    font-family: 'Playfair Display', serif;
                    margin-bottom: 8px;
                }

                .rep-label {
                    font-size: 14px;
                    color: var(--gray-light);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .section-header h3 {
                    font-size: 20px;
                    color: var(--beige);
                }

                .empty-message {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--gray-light);
                }

                .reviews-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .review-item {
                    background: rgba(26, 35, 50, 0.5);
                    border-radius: 8px;
                    padding: 16px;
                    border-left: 4px solid var(--teal);
                }

                .review-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                }

                .reviewer-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--beige);
                    font-size: 14px;
                    font-weight: 500;
                }

                .verified-badge {
                    background: var(--success);
                    color: white;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                }

                .review-score {
                    font-size: 20px;
                    font-weight: 700;
                    color: var(--teal-light);
                }

                .review-comment {
                    color: var(--gray-light);
                    font-size: 14px;
                    line-height: 1.6;
                    margin-bottom: 12px;
                }

                .review-date {
                    font-size: 12px;
                    color: var(--gray);
                }

                .review-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .checkbox-group {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .checkbox-group label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--beige);
                    font-size: 14px;
                    cursor: pointer;
                }

                .checkbox-group input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                }

                .modal-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 24px;
                }
            `}</style>
        </div>
    );
}

// Projects Section - Simplified placeholder
function ProjectsSection({ projects, collaboratingOn, loading, contracts, selectedToken, showNotification, onReload }) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCollabModal, setShowCollabModal] = useState(false);
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectData, setProjectData] = useState({
        title: '',
        description: '',
        url: ''
    });
    const [collabData, setCollabData] = useState('');

    const handleCreateProject = async () => {
        try {
            if (!projectData.title) {
                showNotification('Please enter a project title', 'error');
                return;
            }

            if (!selectedToken) {
                showNotification('Please select a token first', 'error');
                return;
            }

            // Validation: Check if you own the selected token
            try {
                const owner = await contracts.soulbound.ownerOf(selectedToken);
                const myAddress = await contracts.soulbound.signer.getAddress();
                if (owner.toLowerCase() !== myAddress.toLowerCase()) {
                    showNotification(`You don't own Token #${selectedToken}!`, 'error');
                    return;
                }
            } catch (err) {
                showNotification(`Token #${selectedToken} does not exist!`, 'error');
                return;
            }

            // Create metadata hash
            const metadata = {
                title: projectData.title,
                description: projectData.description,
                url: projectData.url,
                createdAt: Date.now()
            };
            const metadataHash = ethers.utils.id(JSON.stringify(metadata));

            console.log('Creating project with:', {
                tokenId: selectedToken,
                metadataHash,
                metadata
            });

            const tx = await contracts.social.createProject(selectedToken, metadataHash);
            showNotification('Creating project...', 'info');
            await tx.wait();
            showNotification('Project created successfully!', 'success');
            setShowCreateModal(false);
            setProjectData({ title: '', description: '', url: '' });
            onReload();
        } catch (error) {
            console.error('Error creating project:', error);
            showNotification(error.message || 'Failed to create project', 'error');
        }
    };

    const handleUpdateStatus = async (projectId, newStatus) => {
        try {
            const tx = await contracts.social.updateProjectStatus(selectedToken, projectId, newStatus);
            showNotification('Updating project status...', 'info');
            await tx.wait();
            showNotification('Project status updated!', 'success');
            onReload();
        } catch (error) {
            console.error('Error updating status:', error);
            showNotification(error.message || 'Failed to update status', 'error');
        }
    };

    const handleAddCollaborator = async () => {
        try {
            if (!collabData || !selectedProject) {
                showNotification('Please enter a collaborator token ID', 'error');
                return;
            }

            const collabTokenId = parseInt(collabData);

            // Validation: Check if collaborator token exists
            try {
                await contracts.soulbound.ownerOf(collabTokenId);
            } catch (err) {
                showNotification(`Token #${collabTokenId} does not exist!`, 'error');
                return;
            }

            // Validation: Check if you own the selected token (project owner)
            try {
                const owner = await contracts.soulbound.ownerOf(selectedToken);
                const myAddress = await contracts.soulbound.signer.getAddress();
                if (owner.toLowerCase() !== myAddress.toLowerCase()) {
                    showNotification(`You don't own Token #${selectedToken}!`, 'error');
                    return;
                }
            } catch (err) {
                showNotification(`Token #${selectedToken} does not exist!`, 'error');
                return;
            }

            const tx = await contracts.social.addCollaborator(
                selectedToken,
                selectedProject.projectId,
                collabTokenId
            );
            showNotification('Adding collaborator...', 'info');
            await tx.wait();
            
            // Track this collaboration for the collaborator
            const storedCollabs = JSON.parse(localStorage.getItem(`collaborations_${collabTokenId}`) || '[]');
            storedCollabs.push({
                ownerTokenId: selectedToken,
                projectId: selectedProject.projectId.toString(),
                addedAt: Date.now()
            });
            localStorage.setItem(`collaborations_${collabTokenId}`, JSON.stringify(storedCollabs));
            
            showNotification('Collaborator added successfully!', 'success');
            setShowCollabModal(false);
            setCollabData('');
            setSelectedProject(null);
            onReload();
        } catch (error) {
            console.error('Error adding collaborator:', error);
            showNotification(error.message || 'Failed to add collaborator', 'error');
        }
    };

    return (
        <>
            <Card>
                <div className="section-header">
                    <h3>Projects Portfolio</h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="badge">{projects?.length || 0}</span>
                        <Button onClick={() => setShowCreateModal(true)} style={{ padding: '8px 16px', fontSize: '13px' }}>
                            + Create Project
                        </Button>
                    </div>
                </div>
                {loading ? (
                    <LoadingSpinner />
                ) : !projects || projects.length === 0 ? (
                    <div className="empty-message">
                        <p>No projects yet. Start showcasing your work!</p>
                    </div>
                ) : (
                    <div className="projects-grid">
                        {projects.map((project, idx) => (
                            <div key={idx} className="project-card">
                                <h4>Project #{project.projectId.toString()}</h4>
                                <div className="project-status" style={{ 
                                    color: project.status === 2 ? 'var(--success)' : 
                                          project.status === 3 ? 'var(--error)' : 'var(--sky)'
                                }}>
                                    Status: {projectStatuses[project.status]}
                                </div>
                                <p>Created: {formatDate(project.createdAt)}</p>
                                {project.completedAt > 0 && (
                                    <p>Completed: {formatDate(project.completedAt)}</p>
                                )}
                                {project.collaborators && project.collaborators.length > 0 && (
                                    <p>Collaborators: {project.collaborators.length}</p>
                                )}
                                
                                <div className="project-actions">
                                    <select
                                        className="status-select"
                                        value={project.status}
                                        onChange={(e) => handleUpdateStatus(project.projectId, parseInt(e.target.value))}
                                    >
                                        {projectStatuses.map((status, idx) => (
                                            <option key={idx} value={idx}>{status}</option>
                                        ))}
                                    </select>
                                    <button
                                        className="collab-btn"
                                        onClick={() => {
                                            setSelectedProject(project);
                                            setShowCollabModal(true);
                                        }}
                                    >
                                        + Collaborator
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Card>
                <div className="section-header">
                    <h3>Projects I'm Collaborating On</h3>
                    <span className="badge">{collaboratingOn?.length || 0}</span>
                </div>

                <div className="info-box" style={{ background: 'rgba(56, 189, 248, 0.1)', fontSize: '12px', marginBottom: '16px' }}>
                    <strong>Debug:</strong> Checking localStorage key: collaborations_{selectedToken}
                    {(() => {
                        const stored = localStorage.getItem(`collaborations_${selectedToken}`);
                        return stored ? ` - Found ${JSON.parse(stored).length} stored collaborations` : ' - No stored collaborations found';
                    })()}
                </div>

                {loading ? (
                    <LoadingSpinner />
                ) : !collaboratingOn || collaboratingOn.length === 0 ? (
                    <div className="empty-message">
                        <p>You're not collaborating on any projects yet</p>
                        <button 
                            onClick={() => {
                                console.log('All localStorage keys:', Object.keys(localStorage).filter(k => k.startsWith('collaborations_')));
                                alert('Check browser console for all collaboration keys');
                            }}
                            style={{ 
                                marginTop: '12px', 
                                padding: '8px 16px', 
                                background: 'var(--teal)', 
                                border: 'none', 
                                borderRadius: '6px', 
                                color: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            Show All Collaboration Keys (Debug)
                        </button>
                    </div>
                ) : (
                    <div className="projects-grid">
                        {collaboratingOn.map((project, idx) => (
                            <div key={idx} className="project-card" style={{ borderLeft: '4px solid var(--sky)' }}>
                                <h4>Project #{project.projectId.toString()}</h4>
                                <div className="project-owner">
                                    Owner: Token #{project.ownerTokenId}
                                </div>
                                <div className="project-status" style={{ 
                                    color: project.status === 2 ? 'var(--success)' : 
                                          project.status === 3 ? 'var(--error)' : 'var(--sky)'
                                }}>
                                    Status: {projectStatuses[project.status]}
                                </div>
                                <p>Created: {formatDate(project.createdAt)}</p>
                                {project.completedAt > 0 && (
                                    <p>Completed: {formatDate(project.completedAt)}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Project">
                <div className="project-form">
                    <Input
                        label="Project Title"
                        value={projectData.title}
                        onChange={(val) => setProjectData({ ...projectData, title: val })}
                        placeholder="My Awesome Project"
                        required
                    />
                    
                    <TextArea
                        label="Description"
                        value={projectData.description}
                        onChange={(val) => setProjectData({ ...projectData, description: val })}
                        placeholder="Describe your project..."
                        rows={4}
                    />
                    
                    <Input
                        label="Project URL (Optional)"
                        value={projectData.url}
                        onChange={(val) => setProjectData({ ...projectData, url: val })}
                        placeholder="https://github.com/..."
                    />

                    <div className="modal-actions">
                        <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateProject}>
                            Create Project
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showCollabModal} onClose={() => setShowCollabModal(false)} title="Add Collaborator">
                <div className="collab-form">
                    <Input
                        label="Collaborator Token ID"
                        value={collabData}
                        onChange={setCollabData}
                        placeholder="Enter token ID"
                        type="number"
                        required
                    />
                    
                    <div className="info-box" style={{ marginTop: '16px' }}>
                        Adding collaborators to <strong>Project #{selectedProject?.projectId.toString()}</strong>
                    </div>

                    <div className="modal-actions">
                        <Button variant="secondary" onClick={() => setShowCollabModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAddCollaborator}>
                            Add Collaborator
                        </Button>
                    </div>
                </div>
            </Modal>

            <style jsx>{`
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .section-header h3 {
                    font-size: 20px;
                    color: var(--beige);
                }

                .badge {
                    background: var(--teal);
                    color: white;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 13px;
                    font-weight: 600;
                }

                .empty-message {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--gray-light);
                }

                .projects-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 16px;
                }

                .project-card {
                    background: rgba(26, 35, 50, 0.5);
                    border-radius: 8px;
                    padding: 20px;
                    border: 1px solid rgba(14, 116, 144, 0.3);
                }

                .project-card h4 {
                    color: var(--teal-light);
                    margin-bottom: 8px;
                }

                .project-status {
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 8px;
                }

                .project-card p {
                    color: var(--gray-light);
                    font-size: 13px;
                    margin: 4px 0;
                }

                .project-actions {
                    margin-top: 16px;
                    padding-top: 16px;
                    border-top: 1px solid rgba(14, 116, 144, 0.2);
                    display: flex;
                    gap: 8px;
                }

                .status-select {
                    flex: 1;
                    background: rgba(14, 116, 144, 0.2);
                    border: 1px solid var(--teal);
                    color: var(--beige);
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    cursor: pointer;
                }

                .collab-btn {
                    background: var(--sky);
                    border: none;
                    color: white;
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.3s ease;
                }

                .collab-btn:hover {
                    background: var(--sky-light);
                    transform: translateY(-1px);
                }
            `}</style>
        </>
    );
}

// Endorsements Section - Simplified placeholder
function EndorsementsSection({ endorsements, loading, contracts, selectedToken, userTokens, showNotification, onReload }) {
    const [showEndorseModal, setShowEndorseModal] = useState(false);
    const [endorseData, setEndorseData] = useState({
        targetTokenId: '',
        endorserTokenId: '',
        skillName: '',
        comment: ''
    });

    // Group endorsements by skill hash
    const endorsementsBySkill = {};
    if (endorsements && endorsements.length > 0) {
        endorsements.forEach(end => {
            const skillHash = end.skillHash;
            if (!endorsementsBySkill[skillHash]) {
                endorsementsBySkill[skillHash] = [];
            }
            endorsementsBySkill[skillHash].push(end);
        });
    }

    const handleEndorseSkill = async () => {
        try {
            if (!endorseData.targetTokenId || !endorseData.endorserTokenId || !endorseData.skillName) {
                showNotification('Please fill in all required fields', 'error');
                return;
            }

            const targetId = parseInt(endorseData.targetTokenId);
            const endorserId = parseInt(endorseData.endorserTokenId);

            // Validation 1: Can't endorse yourself
            if (targetId === endorserId) {
                showNotification('You cannot endorse yourself!', 'error');
                return;
            }

            // Validation 2: Check if target token exists
            try {
                await contracts.soulbound.ownerOf(targetId);
            } catch (err) {
                showNotification(`Token #${targetId} does not exist!`, 'error');
                return;
            }

            // Validation 3: Check if you own the endorser token
            try {
                const owner = await contracts.soulbound.ownerOf(endorserId);
                const myAddress = await contracts.soulbound.signer.getAddress();
                if (owner.toLowerCase() !== myAddress.toLowerCase()) {
                    showNotification(`You don't own Token #${endorserId}!`, 'error');
                    return;
                }
            } catch (err) {
                showNotification(`Token #${endorserId} does not exist!`, 'error');
                return;
            }

            const skillHash = ethers.utils.id(endorseData.skillName);
            
            const tx = await contracts.social.endorseSkill(
                targetId,
                endorserId,
                skillHash,
                endorseData.comment
            );
            showNotification('Endorsing skill...', 'info');
            await tx.wait();
            showNotification('Skill endorsed successfully!', 'success');
            setShowEndorseModal(false);
            setEndorseData({ targetTokenId: '', endorserTokenId: '', skillName: '', comment: '' });
            onReload();
        } catch (error) {
            console.error('Error endorsing skill:', error);
            showNotification(error.message || 'Failed to endorse skill', 'error');
        }
    };

    return (
        <>
            <Card>
                <div className="section-header">
                    <h3>Skill Endorsements</h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span className="badge">{endorsements?.length || 0}</span>
                        <Button onClick={() => setShowEndorseModal(true)} style={{ padding: '8px 16px', fontSize: '13px' }}>
                            + Endorse Skill
                        </Button>
                    </div>
                </div>
                {loading ? (
                    <LoadingSpinner />
                ) : !endorsements || endorsements.length === 0 ? (
                <div className="empty-message">
                    <p>No endorsements yet</p>
                </div>
            ) : (
                <div className="endorsements-grouped">
                    {Object.entries(endorsementsBySkill).map(([skillHash, skillEndorsements]) => (
                        <div key={skillHash} className="skill-group">
                            <div className="skill-header">
                                <span className="skill-name">Skill Hash: {skillHash.substring(0, 10)}...</span>
                                <span className="endorsement-count">
                                    ⚡ {skillEndorsements.length} {skillEndorsements.length === 1 ? 'person' : 'people'} endorsed this
                                </span>
                            </div>
                            <div className="endorsements-list">
                                {skillEndorsements.map((endorsement, idx) => (
                                    <div key={idx} className="endorsement-item">
                                        <div>From Token #{endorsement.endorserId.toString()}</div>
                                        <div className="endorsement-date">{formatDate(endorsement.endorsedAt)}</div>
                                        {endorsement.comment && <p>{endorsement.comment}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style jsx>{`
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .section-header h3 {
                    font-size: 20px;
                    color: var(--beige);
                }

                .badge {
                    background: var(--teal);
                    color: white;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 13px;
                    font-weight: 600;
                }

                .empty-message {
                    text-align: center;
                    padding: 40px 20px;
                    color: var(--gray-light);
                }

                .endorsements-grouped {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                }

                .skill-group {
                    background: rgba(14, 116, 144, 0.1);
                    border-radius: 12px;
                    padding: 16px;
                    border: 1px solid rgba(14, 116, 144, 0.3);
                }

                .skill-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 12px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid rgba(14, 116, 144, 0.3);
                }

                .skill-name {
                    font-size: 14px;
                    color: var(--teal-light);
                    font-weight: 600;
                    font-family: monospace;
                }

                .endorsement-count {
                    font-size: 13px;
                    color: var(--sky-light);
                    font-weight: 600;
                }

                .endorsements-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .endorsement-item {
                    background: rgba(26, 35, 50, 0.5);
                    border-radius: 8px;
                    padding: 12px;
                    border-left: 4px solid var(--sky);
                    color: var(--beige);
                }

                .endorsement-date {
                    font-size: 12px;
                    color: var(--gray);
                    margin-top: 4px;
                }

                .endorsement-item p {
                    color: var(--gray-light);
                    font-size: 14px;
                    margin-top: 8px;
                }
            `}</style>
        </Card>

        <Modal isOpen={showEndorseModal} onClose={() => setShowEndorseModal(false)} title="Endorse Skill">
            <div className="endorse-form">
                <Input
                    label="Token ID to Endorse"
                    value={endorseData.targetTokenId}
                    onChange={(val) => setEndorseData({ ...endorseData, targetTokenId: val })}
                    placeholder="Enter token ID"
                    type="number"
                    required
                />

                <Select
                    label="Your Token ID (Endorser)"
                    value={endorseData.endorserTokenId}
                    onChange={(val) => setEndorseData({ ...endorseData, endorserTokenId: val })}
                    options={userTokens.map(t => ({ value: t.id.toString(), label: `Token #${t.id}` }))}
                    required
                />

                <Input
                    label="Skill Name"
                    value={endorseData.skillName}
                    onChange={(val) => setEndorseData({ ...endorseData, skillName: val })}
                    placeholder="e.g., Solidity, Project Management, Python"
                    required
                />

                <TextArea
                    label="Comment (Optional)"
                    value={endorseData.comment}
                    onChange={(val) => setEndorseData({ ...endorseData, comment: val })}
                    placeholder="Add a comment about this skill..."
                    rows={3}
                />

                <div className="info-box">
                    <strong>💡 Tip:</strong> Skill names are hashed on-chain. Use consistent naming (e.g., "Solidity" not "solidity programming") so endorsements group together.
                </div>

                <div className="modal-actions">
                    <Button variant="secondary" onClick={() => setShowEndorseModal(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleEndorseSkill}>
                        Endorse Skill
                    </Button>
                </div>
            </div>
        </Modal>
        </>
    );
}

// ============================================
// ANALYTICS TAB COMPONENT
// ============================================
function AnalyticsTab({ contracts, selectedToken, showNotification }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!selectedToken || !contracts) return;
        loadAnalytics();
    }, [selectedToken, contracts]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const tokenId = selectedToken.id;

            const credSummary = await contracts.credentials.getCredentialSummary(tokenId);
            const repSummary = await contracts.social.getReputationSummary(tokenId);
            const endorsements = await contracts.social.getEndorsements(tokenId);
            const projects = await contracts.social.getProjects(tokenId);

            setStats({
                credentials: {
                    degrees: credSummary.degrees.toNumber(),
                    certifications: credSummary.certifications.toNumber(),
                    workExperience: credSummary.workExperience.toNumber(),
                    identityProofs: credSummary.identityProofs.toNumber(),
                    skills: credSummary.skills.toNumber(),
                    total: credSummary.degrees.add(credSummary.certifications)
                        .add(credSummary.workExperience)
                        .add(credSummary.identityProofs)
                        .add(credSummary.skills).toNumber()
                },
                reputation: {
                    average: repSummary.averageScore.toNumber(),
                    total: repSummary.totalReviews.toNumber(),
                    verified: repSummary.verifiedReviews.toNumber()
                },
                social: {
                    endorsements: endorsements.length,
                    projects: projects.length,
                    completedProjects: projects.filter(p => p.status === 2).length,
                    activeProjects: projects.filter(p => p.status === 1).length
                }
            });
        } catch (error) {
            console.error('Error loading analytics:', error);
            showNotification('Failed to load analytics', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!selectedToken) {
        return (
            <Card>
                <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <h3>No Token Selected</h3>
                    <p>Select a token to view analytics</p>
                </div>
            </Card>
        );
    }

    if (loading) {
        return <Card><LoadingSpinner /></Card>;
    }

    if (!stats) {
        return <Card><div className="empty-message">Failed to load analytics</div></Card>;
    }

    return (
        <div className="analytics-container">
            <h2 style={{ marginBottom: '24px', color: 'var(--beige, #e8dfca)' }}>Analytics Dashboard</h2>
            
            <div className="analytics-dashboard" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                <Card className="stat-card" style={{ padding: '24px' }}>
                    <div className="stat-card-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <span className="stat-icon" style={{ fontSize: '2rem' }}>📜</span>
                        <h3 style={{ margin: 0 }}>Credentials</h3>
                    </div>
                    <div className="big-number" style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--teal-light, #06b6d4)', marginBottom: '8px' }}>
                        {stats.credentials.total}
                    </div>
                    <div className="stat-label" style={{ color: 'var(--gray, #6b7589)', marginBottom: '16px' }}>Total Credentials</div>
                    <div className="stat-breakdown" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-color, rgba(168, 178, 193, 0.1))' }}>
                        <div className="breakdown-item">
                            <span>🎓 Degrees: {stats.credentials.degrees}</span>
                        </div>
                        <div className="breakdown-item">
                            <span>📋 Certifications: {stats.credentials.certifications}</span>
                        </div>
                        <div className="breakdown-item">
                            <span>💼 Work Experience: {stats.credentials.workExperience}</span>
                        </div>
                        <div className="breakdown-item">
                            <span>⚡ Skills: {stats.credentials.skills}</span>
                        </div>
                    </div>
                </Card>

                <Card className="stat-card" style={{ padding: '24px' }}>
                    <div className="stat-card-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <span className="stat-icon" style={{ fontSize: '2rem' }}>⭐</span>
                        <h3 style={{ margin: 0 }}>Reputation</h3>
                    </div>
                    <div className="big-number" style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--teal-light, #06b6d4)', marginBottom: '8px' }}>
                        {stats.reputation.average}
                        <span style={{ fontSize: '1.5rem', color: 'var(--gray, #6b7589)' }}>/100</span>
                    </div>
                    <div className="stat-label" style={{ color: 'var(--gray, #6b7589)', marginBottom: '16px' }}>Average Score</div>
                    <div className="stat-breakdown" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-color, rgba(168, 178, 193, 0.1))' }}>
                        <div className="breakdown-item">
                            <span>Total Reviews: {stats.reputation.total}</span>
                        </div>
                        <div className="breakdown-item">
                            <span>✓ Verified: {stats.reputation.verified}</span>
                        </div>
                        <div className="breakdown-item">
                            <span>
                                Verification Rate: {stats.reputation.total > 0 
                                    ? Math.round((stats.reputation.verified / stats.reputation.total) * 100)
                                    : 0}%
                            </span>
                        </div>
                    </div>
                </Card>

                <Card className="stat-card" style={{ padding: '24px' }}>
                    <div className="stat-card-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <span className="stat-icon" style={{ fontSize: '2rem' }}>🤝</span>
                        <h3 style={{ margin: 0 }}>Social</h3>
                    </div>
                    <div className="stat-breakdown" style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '16px' }}>
                        <div className="breakdown-item" style={{ fontSize: '1.1rem' }}>
                            <span>👍 Endorsements: <strong>{stats.social.endorsements}</strong></span>
                        </div>
                        <div className="breakdown-item" style={{ fontSize: '1.1rem' }}>
                            <span>🚀 Total Projects: <strong>{stats.social.projects}</strong></span>
                        </div>
                        <div className="breakdown-item" style={{ fontSize: '1.1rem' }}>
                            <span>✅ Completed: <strong>{stats.social.completedProjects}</strong></span>
                        </div>
                        <div className="breakdown-item" style={{ fontSize: '1.1rem' }}>
                            <span>⚡ Active: <strong>{stats.social.activeProjects}</strong></span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}

// ============================================
// EVENTS TAB COMPONENT
// ============================================
function EventsTab({ contracts, selectedToken, showNotification }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        if (!selectedToken || !contracts) return;
        loadEventHistory();
    }, [selectedToken, contracts, filter]);

    const loadEventHistory = async () => {
        setLoading(true);
        try {
            const allEvents = [];
            const tokenId = selectedToken.id;
            
            // Fetch identity events
            try {
                const mintFilter = contracts.soulbound.filters.Minted(null, tokenId);
                const mintEvents = await contracts.soulbound.queryFilter(mintFilter);
                mintEvents.forEach(e => allEvents.push({
                    type: 'identity',
                    action: 'Token Minted',
                    timestamp: e.blockNumber,
                    data: { tokenId: e.args.tokenId.toString() },
                    icon: '🎉',
                    txHash: e.transactionHash
                }));
            } catch (err) {
                console.log('No mint events');
            }

            try {
                const accessReqFilter = contracts.soulbound.filters.AccessRequested(tokenId);
                const accessEvents = await contracts.soulbound.queryFilter(accessReqFilter);
                accessEvents.forEach(e => allEvents.push({
                    type: 'identity',
                    action: 'Access Requested',
                    timestamp: e.blockNumber,
                    data: { requester: shortenAddress(e.args.requester) },
                    icon: '🔔',
                    txHash: e.transactionHash
                }));
            } catch (err) {
                console.log('No access request events');
            }

            // Fetch credential events
            try {
                const credFilter = contracts.credentials.filters.CredentialIssued(tokenId);
                const credEvents = await contracts.credentials.queryFilter(credFilter);
                credEvents.forEach(e => allEvents.push({
                    type: 'credentials',
                    action: 'Credential Issued',
                    timestamp: e.blockNumber,
                    data: { 
                        type: credentialTypes[e.args.credType],
                        id: e.args.credentialId.toString()
                    },
                    icon: '📜',
                    txHash: e.transactionHash
                }));
            } catch (err) {
                console.log('No credential events');
            }

            // Fetch social events
            try {
                const reviewFilter = contracts.social.filters.ReviewSubmitted(tokenId);
                const reviewEvents = await contracts.social.queryFilter(reviewFilter);
                reviewEvents.forEach(e => allEvents.push({
                    type: 'social',
                    action: 'Review Received',
                    timestamp: e.blockNumber,
                    data: { 
                        score: e.args.score.toString(),
                        reviewer: e.args.reviewerTokenId.toString()
                    },
                    icon: '⭐',
                    txHash: e.transactionHash
                }));
            } catch (err) {
                console.log('No review events');
            }

            try {
                const projectFilter = contracts.social.filters.ProjectCreated(tokenId);
                const projectEvents = await contracts.social.queryFilter(projectFilter);
                projectEvents.forEach(e => allEvents.push({
                    type: 'social',
                    action: 'Project Created',
                    timestamp: e.blockNumber,
                    data: { 
                        projectId: e.args.projectId.toString()
                    },
                    icon: '🚀',
                    txHash: e.transactionHash
                }));
            } catch (err) {
                console.log('No project events');
            }

            try {
                const endorseFilter = contracts.social.filters.SkillEndorsed(tokenId);
                const endorseEvents = await contracts.social.queryFilter(endorseFilter);
                endorseEvents.forEach(e => allEvents.push({
                    type: 'social',
                    action: 'Skill Endorsed',
                    timestamp: e.blockNumber,
                    data: { 
                        endorser: e.args.endorserTokenId.toString()
                    },
                    icon: '👍',
                    txHash: e.transactionHash
                }));
            } catch (err) {
                console.log('No endorsement events');
            }

            // Sort by block number (most recent first)
            allEvents.sort((a, b) => b.timestamp - a.timestamp);
            setEvents(allEvents);
        } catch (error) {
            console.error('Error loading events:', error);
            showNotification('Failed to load event history', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!selectedToken) {
        return (
            <Card>
                <div className="empty-state">
                    <div className="empty-icon" style={{ fontSize: '4rem', marginBottom: '16px' }}>📡</div>
                    <h3>No Token Selected</h3>
                    <p>Select a token to view activity history</p>
                </div>
            </Card>
        );
    }

    const filteredEvents = filter === 'all' ? events : events.filter(e => e.type === filter);

    return (
        <div className="events-container">
            <h2 style={{ marginBottom: '24px', color: 'var(--beige, #e8dfca)' }}>Activity History</h2>
            
            <Card>
                <div className="events-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3>Events</h3>
                    <div className="filter-buttons" style={{ display: 'flex', gap: '8px' }}>
                        <Button 
                            variant={filter === 'all' ? 'primary' : 'secondary'}
                            onClick={() => setFilter('all')}
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                        >
                            All
                        </Button>
                        <Button 
                            variant={filter === 'identity' ? 'primary' : 'secondary'}
                            onClick={() => setFilter('identity')}
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                        >
                            Identity
                        </Button>
                        <Button 
                            variant={filter === 'credentials' ? 'primary' : 'secondary'}
                            onClick={() => setFilter('credentials')}
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                        >
                            Credentials
                        </Button>
                        <Button 
                            variant={filter === 'social' ? 'primary' : 'secondary'}
                            onClick={() => setFilter('social')}
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                        >
                            Social
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <LoadingSpinner />
                ) : (
                    <div className="events-timeline" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {filteredEvents.length === 0 ? (
                            <div className="empty-message" style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-light, #a8b2c1)' }}>
                                <p>No events yet</p>
                            </div>
                        ) : (
                            filteredEvents.map((event, idx) => (
                                <div key={idx} className="event-item" style={{ display: 'flex', gap: '16px', padding: '16px', background: 'var(--bg-tertiary, #2a3547)', borderRadius: '12px', border: '1px solid var(--border-color, rgba(168, 178, 193, 0.1))' }}>
                                    <div className="event-icon" style={{ fontSize: '1.5rem', flexShrink: 0 }}>{event.icon}</div>
                                    <div className="event-content" style={{ flex: 1 }}>
                                        <div className="event-action" style={{ fontWeight: 600, color: 'var(--text-primary, #e8dfca)', marginBottom: '8px' }}>{event.action}</div>
                                        <div className="event-data" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
                                            {Object.entries(event.data).map(([key, value]) => (
                                                <span key={key} className="event-detail" style={{ fontSize: '14px', color: 'var(--text-secondary, #a8b2c1)' }}>
                                                    {key}: <strong style={{ color: 'var(--text-primary, #e8dfca)' }}>{value}</strong>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="event-meta" style={{ fontSize: '13px', color: 'var(--text-muted, #6b7589)' }}>
                                            Block: {event.timestamp} • 
                                            <a 
                                                href={`${CONFIG.BLOCK_EXPLORER}/tx/${event.txHash}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                style={{ color: 'var(--accent-sky-light, #38bdf8)', textDecoration: 'none', marginLeft: '8px' }}
                                            >
                                                View TX →
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
}

// ============================================

// ============================================
// ROOT APP WRAPPER WITH PROVIDERS  
// ============================================
function AppRoot() {
    const [isReady, setIsReady] = React.useState(false);
    
    React.useEffect(() => {
        // Wait one tick to ensure providers are mounted
        const timer = setTimeout(() => setIsReady(true), 0);
        return () => clearTimeout(timer);
    }, []);
    
    if (!isReady) {
        return React.createElement('div', {
            style: {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: '#0a0e1a',
                color: '#06b6d4',
                fontSize: '1.2rem',
                fontFamily: 'Arial, sans-serif'
            }
        }, 'Initializing...');
    }
    
    return React.createElement(
        ThemeProvider, 
        null,
        React.createElement(
            ToastProvider, 
            null,
            React.createElement(App, null)
        )
    );
}

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(AppRoot, null));

