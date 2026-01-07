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
    "function getOwnedTokensPaginated(address owner, uint256 offset, uint256 limit) external view returns (uint256[] memory tokenIds, string[] memory metadataCIDs, uint256 totalCount)"
];

const CREDENTIALS_HUB_ABI = [
    "function issueCredential(uint256 tokenId, uint8 credType, bytes32 metadataHash, uint64 issueDate, uint64 expiryDate, uint8 category) external returns (uint256)",
    "function addCredential(uint256 tokenId, uint8 credType, bytes32 metadataHash, uint64 issueDate, uint64 expiryDate, uint8 category) external returns (uint256)",
    "function revokeCredential(uint256 tokenId, uint256 credentialId) external",
    "function getCredentialsByType(uint256 tokenId, uint8 credType) external view returns (tuple(uint256 credentialId, uint8 credType, bytes32 metadataHash, address issuer, uint64 issueDate, uint64 expiryDate, uint8 status, uint8 category, bool verified)[] memory)",
    "function getCredentialSummary(uint256 tokenId) external view returns (uint256 degrees, uint256 certifications, uint256 workExperience, uint256 identityProofs, uint256 skills)",
    "function getActiveCredentials(uint256 tokenId, uint8 credType) external view returns (tuple(uint256 credentialId, uint8 credType, bytes32 metadataHash, address issuer, uint64 issueDate, uint64 expiryDate, uint8 status, uint8 category, bool verified)[] memory)",
    "function setIssuerAuthorization(uint8 credType, address issuer, bool authorized) external",
    "function authorizedIssuers(uint8 credType, address issuer) external view returns (bool)"
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
    "function getEndorsementCount(uint256 tokenId, bytes32 skillHash) external view returns (uint256)"
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
    IPFS_GATEWAY: 'https://gateway.pinata.cloud/ipfs/'
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
            const tokens = await contract.tokensOfOwner(addr);
            const tokenData = await Promise.all(tokens.map(async (tokenId) => {
                const result = await contract.getOwnedTokensPaginated(addr, 0, 100);
                return {
                    id: tokenId.toNumber(),
                    cid: result.metadataCIDs[tokens.indexOf(tokenId)]
                };
            }));
            setUserTokens(tokenData);
            if (tokenData.length > 0) {
                setSelectedToken(tokenData[0].id);
            }
        } catch (error) {
            console.error('Error loading tokens:', error);
        }
    };

    const showNotification = (message, type = 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    };

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

    return (
        <div className="app-container">
            <Header 
                account={account} 
                onConnect={connectWallet}
                loading={loading}
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
function Header({ account, onConnect, loading }) {
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
                    {account ? (
                        <div className="account-info">
                            <div className="account-badge">
                                <div className="account-dot"></div>
                                <span>{shortenAddress(account)}</span>
                            </div>
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
                }

                .account-dot {
                    width: 8px;
                    height: 8px;
                    background: var(--success);
                    border-radius: 50%;
                    animation: pulse 2s ease-in-out infinite;
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
        // Don't trigger if clicking the details button
        if (e.target.closest('.view-details-btn')) {
            return;
        }
        onSelect();
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
            <Card className={`token-card ${isSelected ? 'selected' : ''}`} onClick={handleCardClick}>
                <div className="token-header">
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

                <button 
                    className="view-details-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowDetails(true);
                    }}
                >
                    View Details
                </button>

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
                    cursor: pointer;
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

                .view-details-btn {
                    width: 100%;
                    margin-top: 12px;
                    padding: 10px;
                    background: transparent;
                    border: 1px solid var(--teal);
                    color: var(--teal-light);
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.3s ease;
                }

                .view-details-btn:hover {
                    background: var(--teal);
                    color: white;
                    transform: translateY(-1px);
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
    const statusColors = {
        0: 'var(--success)', // Active
        1: 'var(--error)',   // Revoked
        2: 'var(--warning)'  // Expired
    };

    const statusLabels = ['Active', 'Revoked', 'Expired'];
    const typeIcons = ['🎓', '📜', '💼', '🆔', '⚡'];

    return (
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

            {credential.status === 0 && (
                <div className="credential-actions">
                    <Button variant="danger" onClick={onRevoke} style={{ fontSize: '12px', padding: '8px 16px' }}>
                        Revoke
                    </Button>
                </div>
            )}

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
                    justify-content: flex-end;
                    padding-top: 16px;
                    border-top: 1px solid rgba(14, 116, 144, 0.2);
                }
            `}</style>
        </Card>
    );
}
// Access Control Tab Component
function AccessControlTab({ contracts, selectedToken, userTokens, showNotification }) {
    const [pendingRequests, setPendingRequests] = useState([]);
    const [grantedAccess, setGrantedAccess] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestTokenId, setRequestTokenId] = useState('');

    useEffect(() => {
        if (selectedToken && contracts) {
            loadAccessData();
        }
    }, [selectedToken, contracts]);

    const loadAccessData = async () => {
        if (!selectedToken) return;
        
        setLoading(true);
        try {
            // Load pending requests
            const requests = await contracts.soulbound.getPendingRequests(selectedToken, 0, 50);
            setPendingRequests(requests.requesters);
        } catch (error) {
            console.error('Error loading access data:', error);
        } finally {
            setLoading(false);
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
    const [projects, setProjects] = useState([]);
    const [endorsements, setEndorsements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showEndorseModal, setShowEndorseModal] = useState(false);

    useEffect(() => {
        if (selectedToken && contracts) {
            loadSocialData();
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

            // Load reviews
            const revs = await contracts.social.getReviews(selectedToken);
            setReviews(revs);

            // Load projects
            const projs = await contracts.social.getProjects(selectedToken);
            setProjects(projs);

            // Load endorsements
            const ends = await contracts.social.getEndorsements(selectedToken);
            setEndorsements(ends);
        } catch (error) {
            console.error('Error loading social data:', error);
        } finally {
            setLoading(false);
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
function ReputationSection({ reputation, reviews, loading, contracts, selectedToken, userTokens, showNotification, onReload }) {
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [reviewData, setReviewData] = useState({
        reviewerTokenId: '',
        score: '75',
        verified: false,
        isAnonymous: false,
        comment: ''
    });

    const handleSubmitReview = async () => {
        try {
            const tx = await contracts.social.submitReview(
                selectedToken,
                parseInt(reviewData.reviewerTokenId),
                parseInt(reviewData.score),
                reviewData.verified,
                reviewData.isAnonymous,
                reviewData.comment
            );
            showNotification('Submitting review...', 'info');
            await tx.wait();
            showNotification('Review submitted successfully!', 'success');
            setShowReviewModal(false);
            setReviewData({ reviewerTokenId: '', score: '75', verified: false, isAnonymous: false, comment: '' });
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

            <Modal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} title="Write Review">
                <div className="review-form">
                    <Select
                        label="Your Token ID"
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
function ProjectsSection({ projects, loading, contracts, selectedToken, showNotification, onReload }) {
    return (
        <Card>
            <div className="section-header">
                <h3>Projects Portfolio</h3>
                <span className="badge">{projects.length}</span>
            </div>
            {loading ? (
                <LoadingSpinner />
            ) : projects.length === 0 ? (
                <div className="empty-message">
                    <p>No projects yet. Start showcasing your work!</p>
                </div>
            ) : (
                <div className="projects-grid">
                    {projects.map((project, idx) => (
                        <div key={idx} className="project-card">
                            <h4>Project #{project.projectId.toString()}</h4>
                            <p>Status: {projectStatuses[project.status]}</p>
                            <p>Created: {formatDate(project.createdAt)}</p>
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

                .projects-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
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
                    margin-bottom: 12px;
                }

                .project-card p {
                    color: var(--gray-light);
                    font-size: 14px;
                    margin: 4px 0;
                }
            `}</style>
        </Card>
    );
}

// Endorsements Section - Simplified placeholder
function EndorsementsSection({ endorsements, loading, contracts, selectedToken, userTokens, showNotification, onReload }) {
    return (
        <Card>
            <div className="section-header">
                <h3>Skill Endorsements</h3>
                <span className="badge">{endorsements.length}</span>
            </div>
            {loading ? (
                <LoadingSpinner />
            ) : endorsements.length === 0 ? (
                <div className="empty-message">
                    <p>No endorsements yet</p>
                </div>
            ) : (
                <div className="endorsements-list">
                    {endorsements.map((endorsement, idx) => (
                        <div key={idx} className="endorsement-item">
                            <div>From Token #{endorsement.endorserId.toString()}</div>
                            <div className="endorsement-date">{formatDate(endorsement.endorsedAt)}</div>
                            {endorsement.comment && <p>{endorsement.comment}</p>}
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

                .endorsements-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .endorsement-item {
                    background: rgba(26, 35, 50, 0.5);
                    border-radius: 8px;
                    padding: 16px;
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
    );
}
