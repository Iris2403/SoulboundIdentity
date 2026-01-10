// All React components and providers
// Destructure React hooks for easier use
const { useState, useEffect, useCallback, useMemo } = React;

// ============================================
// THEME PROVIDER & CONTEXT
// ============================================
ThemeContext = React.createContext({
    theme: 'dark'
});

ThemeProvider = function ({ children }) {
    // Always use dark mode
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
    }, []);

    const value = useMemo(() => ({ theme: 'dark' }), []);

    return React.createElement(
        ThemeContext.Provider,
        { value: value },
        children
    );
}

useTheme = () => {
    return React.useContext(ThemeContext);
};


// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================
ToastContext = React.createContext({
    addToast: () => { }
});

Toast = function ({ message, type, onClose }) {
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

ToastProvider = function ({ children }) {
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

useToast = () => {
    return React.useContext(ToastContext);
};


// ============================================
// IMPROVED CHECKBOX COMPONENT
// ============================================
Checkbox = ({
    label,
    checked,
    onChange,
    disabled = false,
    id,
    name
}) => {
    // Generate unique ID if not provided (for accessibility)
    const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <label
            htmlFor={checkboxId}
            className={`checkbox-label ${disabled ? 'disabled' : ''}`}
        >
            <input
                id={checkboxId}
                name={name}
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                className="checkbox-input"
                aria-checked={checked}
            />
            <span className="checkbox-custom" aria-hidden="true"></span>
            <span className="checkbox-text">{label}</span>
        </label>
    );
};

// ============================================
// TRANSACTION STATUS WIDGET
// ============================================
TransactionStatus = function ({ pendingTxs }) {
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
GasEstimate = function ({ gasEstimate }) {
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
MetadataDisplay = function ({ cid, showNotification }) {
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
Card = ({ children, className = '', style = {} }) => (
    <div className={`card ${className}`} style={style}>
        {children}
    </div>
);

Button = ({ children, onClick, disabled = false, variant = 'primary', className = '', style = {} }) => (
    <button
        className={`btn btn-${variant} ${className}`}
        onClick={onClick}
        disabled={disabled}
        style={style}
    >
        {children}
    </button>
);

Input = ({ label, value, onChange, type = 'text', placeholder = '', required = false, id, name }) => {
    // Generate unique ID if not provided
    const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-') || Math.random().toString(36).substr(2, 9)}`;
    const inputName = name || inputId;

    return (
        <div className="input-group">
            {label && (
                <label className="input-label" htmlFor={inputId}>
                    {label}{required && ' *'}
                </label>
            )}
            <input
                id={inputId}
                name={inputName}
                className="input-field"
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                autoComplete={type === 'email' ? 'email' : type === 'text' ? 'on' : 'off'}
            />
        </div>
    );
};

Select = ({ label, value, onChange, options, required = false, id, name }) => {
    // Generate unique ID if not provided
    const selectId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-') || Math.random().toString(36).substr(2, 9)}`;
    const selectName = name || selectId;

    return (
        <div className="input-group">
            {label && (
                <label className="input-label" htmlFor={selectId}>
                    {label}{required && ' *'}
                </label>
            )}
            <select
                id={selectId}
                name={selectName}
                className="input-field"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
            >
                <option value="">Select...</option>
                {options.map((opt, idx) => (
                    <option key={idx} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
};

TextArea = ({ label, value, onChange, placeholder = '', rows = 4, id, name }) => {
    // Generate unique ID if not provided
    const textareaId = id || `textarea-${label?.toLowerCase().replace(/\s+/g, '-') || Math.random().toString(36).substr(2, 9)}`;
    const textareaName = name || textareaId;

    return (
        <div className="input-group">
            {label && (
                <label className="input-label" htmlFor={textareaId}>
                    {label}
                </label>
            )}
            <textarea
                id={textareaId}
                name={textareaName}
                className="input-field"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
            />
        </div>
    );
};

Modal = function ({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return React.createElement('div', {
        className: 'modal-overlay',
        onClick: handleOverlayClick,
        style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        }
    },
        React.createElement('div', {
            className: 'modal-content',
            onClick: (e) => e.stopPropagation()
        },
            React.createElement('div', { className: 'modal-header' },
                React.createElement('h2', null, title),
                React.createElement('button', {
                    className: 'modal-close',
                    onClick: onClose
                }, '×')
            ),
            React.createElement('div', { className: 'modal-body' }, children)
        )
    );
};

LoadingSpinner = () => (
    <div className="loading-spinner">
        <div className="spinner"></div>
    </div>
);

// Main App Component
App = function () {
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
                setSelectedToken(tokenData[0].id);
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
        // selectedToken is already the ID number
        const tokenId = selectedToken;

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
                            <ViewIdentitiesTab
                                contracts={contracts}
                                account={account}
                                showNotification={showNotification}
                            />
                        )}
                    </main>
                </>
            )}

            <style>{`
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
Header = function ({ account, onConnect, loading }) {
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

            <style>{`
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
WelcomeScreen = function ({ onConnect, loading }) {
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

            <style>{`
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
TabNavigation = function ({ activeTab, setActiveTab, userTokens }) {
    const tabs = [
        { id: 'identity', label: 'Identity', icon: '👤' },
        { id: 'credentials', label: 'Credentials', icon: '📜', disabled: userTokens.length === 0 },
        { id: 'access', label: 'Access Control', icon: '🔐', disabled: userTokens.length === 0 },
        { id: 'social', label: 'Social', icon: '🤝', disabled: userTokens.length === 0 },
        { id: 'analytics', label: 'Analytics', icon: '📊', disabled: userTokens.length === 0 },
        { id: 'events', label: 'View Identities', icon: '🔍', disabled: false },
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

            <style>{`
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
Notification = function ({ message, type, onClose }) {
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

            <style>{`
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
IdentityTab = function ({ contracts, account, userTokens, selectedToken, setSelectedToken, onTokenCreated, showNotification }) {
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
                    <p className="tab-description">
                        Create and manage your soulbound identity tokens
                        {userTokens.length > 0 && (
                            <span style={{
                                marginLeft: '12px',
                                padding: '4px 12px',
                                background: 'var(--gradient-teal)',
                                borderRadius: '12px',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                color: 'white'
                            }}>
                                {userTokens.length} {userTokens.length === 1 ? 'Token' : 'Tokens'}
                            </span>
                        )}
                    </p>
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

            <style>{`
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
TokenCard = function ({ token, isSelected, onSelect, contracts }) {
    const [metadata, setMetadata] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);
    const [showBurnConfirm, setShowBurnConfirm] = useState(false);
    const [burning, setBurning] = useState(false);

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

    const handleBurnToken = async () => {
        try {
            console.log('🔥 Burning token:', token.id);
            setBurning(true);

            const tx = await contracts.soulbound.burn(token.id);
            console.log('⏳ Burn transaction hash:', tx.hash);

            await tx.wait();
            console.log('✅ Token burned successfully');

            setShowBurnConfirm(false);
            setShowDetails(false);

            // Reload page to refresh token list
            window.location.reload();
        } catch (error) {
            console.error('❌ Error burning token:', error);
            alert('Failed to burn token: ' + (error.message || 'Unknown error'));
        } finally {
            setBurning(false);
        }
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
                        onClick={(e) => {
                            e.stopPropagation();
                            console.log('👁️ View Details clicked for token', token.id);
                            setShowDetails(true);
                        }}
                        style={{ position: 'relative', zIndex: 100 }}
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

                    <div className="danger-zone" style={{
                        marginTop: '32px',
                        padding: '20px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderRadius: '12px',
                        border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}>
                        <h4 style={{ color: 'var(--error)', marginBottom: '12px', fontSize: '1rem' }}>
                            ⚠️ Danger Zone
                        </h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                            Permanently delete this identity token and all associated access data. This action cannot be undone.
                        </p>
                        <Button
                            variant="danger"
                            onClick={() => setShowBurnConfirm(true)}
                            disabled={burning}
                        >
                            🔥 Delete Identity Token
                        </Button>
                    </div>
                </div>

                <style>{`
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

            <style>{`
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

            {/* Burn Confirmation Modal */}
            <Modal
                isOpen={showBurnConfirm}
                onClose={() => setShowBurnConfirm(false)}
                title="⚠️ Confirm Identity Deletion"
            >
                <div style={{ padding: '20px 0' }}>
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        padding: '16px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}>
                        <p style={{ color: 'var(--error)', fontWeight: '600', marginBottom: '8px' }}>
                            ⚠️ WARNING: This action is PERMANENT and IRREVERSIBLE
                        </p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            You are about to permanently delete Token #{token.id}. This will:
                        </p>
                    </div>

                    <ul style={{
                        color: 'var(--text-secondary)',
                        marginLeft: '20px',
                        marginBottom: '24px',
                        lineHeight: '1.8'
                    }}>
                        <li>Delete the identity token from the blockchain</li>
                        <li>Remove all associated access permissions</li>
                        <li>Clear all pending access requests</li>
                        <li>Remove the token from your wallet permanently</li>
                    </ul>

                    <p style={{
                        color: 'var(--text-primary)',
                        fontWeight: '600',
                        marginBottom: '24px',
                        fontSize: '1.1rem'
                    }}>
                        Are you absolutely sure you want to delete this identity?
                    </p>

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                        <Button
                            variant="secondary"
                            onClick={() => setShowBurnConfirm(false)}
                            disabled={burning}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleBurnToken}
                            disabled={burning}
                        >
                            {burning ? '🔥 Deleting...' : '🔥 Yes, Delete Forever'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
CredentialsTab = function ({ contracts, selectedToken, userTokens, showNotification }) {
    // State management
    const [credentials, setCredentials] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showIssueModal, setShowIssueModal] = useState(false);
    const [selectedType, setSelectedType] = useState(0);
    const [showActiveOnly, setShowActiveOnly] = useState(false);
    const [credentialCounts, setCredentialCounts] = useState({});
    const [validationStatus, setValidationStatus] = useState({});

    const [credentialData, setCredentialData] = useState({
        credType: '0',
        institution: '',
        title: '',
        description: '',
        issueDate: '',
        expiryDate: '',
        category: '0'
    });

    const [issueData, setIssueData] = useState({
        targetTokenId: selectedToken || '',
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
            loadCredentialCounts();
        }
    }, [selectedToken, contracts, selectedType, showActiveOnly]);

    // Helper function to get credential status info
    const getCredentialStatusInfo = (status) => {
        const statusMap = {
            0: { label: 'Active', color: 'var(--success)', icon: '🟢', bg: 'rgba(16, 185, 129, 0.1)' },
            1: { label: 'Revoked', color: 'var(--error)', icon: '🔴', bg: 'rgba(239, 68, 68, 0.1)' },
            2: { label: 'Expired', color: 'var(--text-muted)', icon: '⚫', bg: 'rgba(107, 117, 137, 0.1)' }
        };
        return statusMap[status] || statusMap[0];
    };

    // Load credential counts per type
    const loadCredentialCounts = async () => {
        if (!selectedToken || !contracts) return;

        try {
            const counts = {};
            for (let i = 0; i < credentialTypes.length; i++) {
                const count = await contracts.credentials.getCredentialCount(selectedToken, i);
                counts[i] = count.toNumber();
            }
            setCredentialCounts(counts);
        } catch (error) {
            console.error('Error loading credential counts:', error);
        }
    };

    // Load credentials with active filter
    const loadCredentials = async () => {
        if (!selectedToken || !contracts) return;

        setLoading(true);
        try {
            let creds;

            if (showActiveOnly) {
                // Load only active credentials
                creds = await contracts.credentials.getActiveCredentials(selectedToken, selectedType);
            } else {
                // Load all credentials
                creds = await contracts.credentials.getCredentialsByType(selectedToken, selectedType);
            }

            // Validate each credential
            const validationStatuses = {};
            for (const cred of creds) {
                try {
                    const isValid = await contracts.credentials.isCredentialValid(
                        selectedToken,
                        cred.credentialId
                    );
                    validationStatuses[cred.credentialId.toString()] = isValid;
                } catch (err) {
                    validationStatuses[cred.credentialId.toString()] = false;
                }
            }

            setValidationStatus(validationStatuses);
            setCredentials(creds);
        } catch (error) {
            console.error('Error loading credentials:', error);
            setCredentials([]);
        } finally {
            setLoading(false);
        }
    };

    const loadSummary = async () => {
        if (!selectedToken || !contracts) return;

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

    // Add self-reported credential (unverified)
    const handleAddCredential = async () => {
        try {
            console.log('🔵 Starting credential add...', { selectedToken, credentialData });

            if (!credentialData.institution || !credentialData.title) {
                showNotification('Please fill in all required fields', 'error');
                return;
            }

            setLoading(true);

            const metadata = {
                institution: credentialData.institution,
                title: credentialData.title,
                description: credentialData.description,
                issuedBy: 'Self-Reported'
            };

            const metadataHash = ethers.utils.id(JSON.stringify(metadata));
            const issueDate = credentialData.issueDate ?
                Math.floor(new Date(credentialData.issueDate).getTime() / 1000) :
                Math.floor(Date.now() / 1000);
            const expiryDate = credentialData.expiryDate ?
                Math.floor(new Date(credentialData.expiryDate).getTime() / 1000) : 0;

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
            showNotification('Self-reported credential added! (Unverified)', 'success');

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
            loadCredentialCounts();
        } catch (error) {
            console.error('❌ Error adding credential:', error);
            showNotification(error.message || 'Failed to add credential', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Issue verified credential (for authorized issuers)
    const handleIssueCredential = async () => {
        try {
            console.log('✅ Issuing verified credential...', issueData);

            if (!issueData.institution || !issueData.title || !issueData.targetTokenId) {
                showNotification('Please fill in all required fields', 'error');
                return;
            }

            setLoading(true);

            const metadata = {
                institution: issueData.institution,
                title: issueData.title,
                description: issueData.description,
                issuedBy: 'Authorized Issuer'
            };

            const metadataHash = ethers.utils.id(JSON.stringify(metadata));
            const issueDate = issueData.issueDate ?
                Math.floor(new Date(issueData.issueDate).getTime() / 1000) :
                Math.floor(Date.now() / 1000);
            const expiryDate = issueData.expiryDate ?
                Math.floor(new Date(issueData.expiryDate).getTime() / 1000) : 0;

            if (expiryDate !== 0 && expiryDate <= issueDate) {
                showNotification('Expiry date must be after issue date!', 'error');
                setLoading(false);
                return;
            }

            const tx = await contracts.credentials.issueCredential(
                parseInt(issueData.targetTokenId),
                parseInt(issueData.credType),
                metadataHash,
                issueDate,
                expiryDate,
                parseInt(issueData.category)
            );

            showNotification('Issuing verified credential...', 'info');
            await tx.wait();
            showNotification('✅ Verified credential issued successfully!', 'success');

            setShowIssueModal(false);
            setIssueData({
                targetTokenId: selectedToken || '',
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
            loadCredentialCounts();
        } catch (error) {
            console.error('❌ Error issuing credential:', error);

            if (error.message.includes('NotAuthorizedIssuer')) {
                showNotification('❌ You are not authorized to issue this credential type', 'error');
            } else {
                showNotification(error.message || 'Failed to issue credential', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    // Update expired credential status
    const handleUpdateStatus = async (credentialId) => {
        try {
            const tx = await contracts.credentials.updateCredentialStatus(selectedToken, credentialId);
            showNotification('Updating credential status...', 'info');
            await tx.wait();
            showNotification('Status updated!', 'success');
            loadCredentials();
            loadSummary();
        } catch (error) {
            console.error('Error updating status:', error);
            showNotification('Failed to update status', 'error');
        }
    };

    const handleRevoke = async (credId) => {
        try {
            const tx = await contracts.credentials.revokeCredential(selectedToken, credId);
            showNotification('Revoking credential...', 'info');
            await tx.wait();
            showNotification('Credential revoked', 'success');
            loadCredentials();
            loadSummary();
            loadCredentialCounts();
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
                    <h3>No Token Selected</h3>
                    <p>Select a token from the Identity tab to manage credentials</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="credentials-tab">
            {/* Header with action buttons */}
            <div className="tab-header">
                <div>
                    <h2>Credentials</h2>
                    <p className="tab-description">Manage your professional credentials and achievements</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Button onClick={() => setShowAddModal(true)} variant="secondary">
                        ➕ Add Self-Reported
                    </Button>
                    <Button onClick={() => setShowIssueModal(true)}>
                        ✅ Issue Verified
                    </Button>
                </div>
            </div>

            {/* Credential Counts Dashboard */}
            {summary && (
                <Card style={{ marginBottom: '24px' }}>
                    <h3 style={{ marginBottom: '16px', color: 'var(--teal-light)' }}>
                        📊 Credential Summary
                    </h3>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: '16px'
                    }}>
                        <div style={{
                            textAlign: 'center',
                            padding: '16px',
                            background: 'rgba(102, 126, 234, 0.1)',
                            borderRadius: '12px'
                        }}>
                            <div style={{ fontSize: '2rem' }}>🎓</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--teal-light)' }}>
                                {summary.degrees}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                Degrees
                            </div>
                        </div>
                        <div style={{
                            textAlign: 'center',
                            padding: '16px',
                            background: 'rgba(14, 165, 233, 0.1)',
                            borderRadius: '12px'
                        }}>
                            <div style={{ fontSize: '2rem' }}>📜</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--teal-light)' }}>
                                {summary.certifications}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                Certifications
                            </div>
                        </div>
                        <div style={{
                            textAlign: 'center',
                            padding: '16px',
                            background: 'rgba(6, 182, 212, 0.1)',
                            borderRadius: '12px'
                        }}>
                            <div style={{ fontSize: '2rem' }}>💼</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--teal-light)' }}>
                                {summary.workExperience}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                Work Experience
                            </div>
                        </div>
                        <div style={{
                            textAlign: 'center',
                            padding: '16px',
                            background: 'rgba(240, 147, 251, 0.1)',
                            borderRadius: '12px'
                        }}>
                            <div style={{ fontSize: '2rem' }}>🆔</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--teal-light)' }}>
                                {summary.identityProofs}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                Identity Proofs
                            </div>
                        </div>
                        <div style={{
                            textAlign: 'center',
                            padding: '16px',
                            background: 'rgba(42, 245, 152, 0.1)',
                            borderRadius: '12px'
                        }}>
                            <div style={{ fontSize: '2rem' }}>⚡</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--teal-light)' }}>
                                {summary.skills}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                Skills
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Filters and Credentials List */}
            <Card>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                    gap: '16px'
                }}>
                    {/* Type filter */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {credentialTypes.map((type, idx) => (
                            <button
                                key={idx}
                                className={`filter-btn ${selectedType === idx ? 'active' : ''}`}
                                onClick={() => setSelectedType(idx)}
                                style={{
                                    position: 'relative',
                                    padding: '8px 16px',
                                    border: selectedType === idx ? '2px solid var(--teal)' : '1px solid var(--border-color)',
                                    background: selectedType === idx ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                                    color: selectedType === idx ? 'var(--teal-light)' : 'var(--text-secondary)',
                                    borderRadius: '20px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    fontWeight: selectedType === idx ? '600' : '400',
                                    transition: 'all 0.3s'
                                }}
                            >
                                {type}
                                {credentialCounts[idx] !== undefined && (
                                    <span style={{
                                        marginLeft: '6px',
                                        background: selectedType === idx ? 'rgba(255,255,255,0.3)' : 'var(--teal)',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        color: selectedType === idx ? 'var(--teal-light)' : 'white'
                                    }}>
                                        {credentialCounts[idx]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Active/All toggle */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        background: 'var(--bg-tertiary)',
                        padding: '8px 16px',
                        borderRadius: '24px'
                    }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Show:
                        </span>
                        <button
                            onClick={() => setShowActiveOnly(false)}
                            style={{
                                background: !showActiveOnly ? 'var(--gradient-teal)' : 'transparent',
                                border: 'none',
                                color: !showActiveOnly ? 'white' : 'var(--text-secondary)',
                                padding: '6px 16px',
                                borderRadius: '16px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                transition: 'all 0.3s'
                            }}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setShowActiveOnly(true)}
                            style={{
                                background: showActiveOnly ? 'var(--gradient-teal)' : 'transparent',
                                border: 'none',
                                color: showActiveOnly ? 'white' : 'var(--text-secondary)',
                                padding: '6px 16px',
                                borderRadius: '16px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                transition: 'all 0.3s'
                            }}
                        >
                            🟢 Active Only
                        </button>
                    </div>
                </div>

                {/* Credentials list */}
                {loading ? (
                    <LoadingSpinner />
                ) : credentials.length === 0 ? (
                    <div className="empty-message" style={{ textAlign: 'center', padding: '40px' }}>
                        <p>No {showActiveOnly ? 'active ' : ''}{credentialTypes[selectedType].toLowerCase()} credentials yet</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {credentials.map((cred, idx) => {
                            const statusInfo = getCredentialStatusInfo(cred.status);
                            const isValid = validationStatus[cred.credentialId.toString()];
                            const isExpired = cred.expiryDate > 0 &&
                                Math.floor(Date.now() / 1000) >= cred.expiryDate.toNumber();

                            return (
                                <div
                                    key={idx}
                                    style={{
                                        background: 'var(--bg-tertiary)',
                                        padding: '20px',
                                        borderRadius: '12px',
                                        borderLeft: `4px solid ${statusInfo.color}`
                                    }}
                                >
                                    {/* Header with status badges */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: '12px',
                                        flexWrap: 'wrap',
                                        gap: '12px'
                                    }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontSize: '1.1rem',
                                                fontWeight: '600',
                                                color: 'var(--teal-light)',
                                                marginBottom: '8px'
                                            }}>
                                                {credentialTypes[cred.credType]}
                                            </div>
                                            <div style={{
                                                fontSize: '0.85rem',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                ID: {cred.credentialId.toString()}
                                            </div>
                                        </div>

                                        {/* Badges */}
                                        <div style={{
                                            display: 'flex',
                                            gap: '8px',
                                            flexWrap: 'wrap'
                                        }}>
                                            {/* Verified badge */}
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '0.8rem',
                                                fontWeight: '600',
                                                background: cred.verified ?
                                                    'rgba(16, 185, 129, 0.2)' :
                                                    'rgba(245, 158, 11, 0.2)',
                                                color: cred.verified ? 'var(--success)' : 'var(--warning)'
                                            }}>
                                                {cred.verified ? '✅ Verified' : '⚠️ Self-Reported'}
                                            </span>

                                            {/* Status badge */}
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '0.8rem',
                                                fontWeight: '600',
                                                background: statusInfo.bg,
                                                color: statusInfo.color
                                            }}>
                                                {statusInfo.icon} {statusInfo.label}
                                            </span>

                                            {/* Validation badge */}
                                            {isValid !== undefined && (
                                                <span style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '600',
                                                    background: isValid ?
                                                        'rgba(16, 185, 129, 0.2)' :
                                                        'rgba(239, 68, 68, 0.2)',
                                                    color: isValid ? 'var(--success)' : 'var(--error)'
                                                }}>
                                                    {isValid ? '✓ Valid' : '✗ Invalid'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: '12px',
                                        marginTop: '16px',
                                        paddingTop: '16px',
                                        borderTop: '1px solid rgba(6, 182, 212, 0.2)'
                                    }}>
                                        <div>
                                            <div style={{
                                                fontSize: '0.8rem',
                                                color: 'var(--text-muted)',
                                                marginBottom: '4px'
                                            }}>
                                                Issuer
                                            </div>
                                            <code style={{ fontSize: '0.85rem', color: 'var(--teal-light)' }}>
                                                {shortenAddress(cred.issuer)}
                                            </code>
                                        </div>
                                        <div>
                                            <div style={{
                                                fontSize: '0.8rem',
                                                color: 'var(--text-muted)',
                                                marginBottom: '4px'
                                            }}>
                                                Issue Date
                                            </div>
                                            <div style={{ fontSize: '0.9rem' }}>
                                                {formatDate(cred.issueDate)}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{
                                                fontSize: '0.8rem',
                                                color: 'var(--text-muted)',
                                                marginBottom: '4px'
                                            }}>
                                                Expiry
                                            </div>
                                            <div style={{
                                                fontSize: '0.9rem',
                                                color: isExpired ? 'var(--error)' : 'inherit'
                                            }}>
                                                {cred.expiryDate.toNumber() === 0 ?
                                                    'Never' :
                                                    formatDate(cred.expiryDate)
                                                }
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{
                                                fontSize: '0.8rem',
                                                color: 'var(--text-muted)',
                                                marginBottom: '4px'
                                            }}>
                                                Metadata Hash
                                            </div>
                                            <code style={{
                                                fontSize: '0.75rem',
                                                color: 'var(--teal-light)',
                                                wordBreak: 'break-all'
                                            }}>
                                                {cred.metadataHash.slice(0, 20)}...
                                            </code>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{
                                        display: 'flex',
                                        gap: '8px',
                                        marginTop: '16px',
                                        flexWrap: 'wrap'
                                    }}>
                                        {/* Update status button (if expired but status not updated) */}
                                        {isExpired && cred.status === 0 && (
                                            <Button
                                                variant="secondary"
                                                onClick={() => handleUpdateStatus(cred.credentialId)}
                                                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                            >
                                                🔄 Update to Expired
                                            </Button>
                                        )}

                                        {/* Revoke button (if active) */}
                                        {cred.status === 0 && (
                                            <Button
                                                variant="danger"
                                                onClick={() => handleRevoke(cred.credentialId)}
                                                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                            >
                                                Revoke
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {/* Add Self-Reported Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="➕ Add Self-Reported Credential"
            >
                <div>
                    <div style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        border: '1px solid rgba(245, 158, 11, 0.3)'
                    }}>
                        <p style={{
                            fontSize: '0.9rem',
                            color: 'var(--warning)',
                            margin: 0
                        }}>
                            ⚠️ Self-reported credentials are marked as unverified. Request verification from authorized issuers.
                        </p>
                    </div>

                    <Select
                        label="Credential Type"
                        value={credentialData.credType}
                        onChange={(val) => setCredentialData({ ...credentialData, credType: val })}
                        options={credentialTypes.map((t, i) => ({ value: i.toString(), label: t }))}
                    />

                    <Input
                        label="Institution/Organization"
                        value={credentialData.institution}
                        onChange={(val) => setCredentialData({ ...credentialData, institution: val })}
                        placeholder="e.g., MIT, Google, AWS"
                    />

                    <Input
                        label="Title/Name"
                        value={credentialData.title}
                        onChange={(val) => setCredentialData({ ...credentialData, title: val })}
                        placeholder="e.g., Bachelor of Computer Science"
                    />

                    <TextArea
                        label="Description"
                        value={credentialData.description}
                        onChange={(val) => setCredentialData({ ...credentialData, description: val })}
                        placeholder="Brief description of the credential"
                    />

                    <Input
                        label="Issue Date"
                        type="date"
                        value={credentialData.issueDate}
                        onChange={(val) => setCredentialData({ ...credentialData, issueDate: val })}
                    />

                    <Input
                        label="Expiry Date (optional)"
                        type="date"
                        value={credentialData.expiryDate}
                        onChange={(val) => setCredentialData({ ...credentialData, expiryDate: val })}
                    />

                    {parseInt(credentialData.credType) === 4 && (
                        <Select
                            label="Skill Category"
                            value={credentialData.category}
                            onChange={(val) => setCredentialData({ ...credentialData, category: val })}
                            options={skillCategories.map((c, i) => ({ value: i.toString(), label: c }))}
                        />
                    )}

                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        justifyContent: 'flex-end',
                        marginTop: '24px'
                    }}>
                        <Button
                            variant="secondary"
                            onClick={() => setShowAddModal(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddCredential}
                            disabled={loading}
                        >
                            {loading ? 'Adding...' : '➕ Add Credential'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Issue Verified Credential Modal (for authorized issuers) */}
            <Modal
                isOpen={showIssueModal}
                onClose={() => setShowIssueModal(false)}
                title="✅ Issue Verified Credential"
            >
                <div>
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.1)',
                        padding: '12px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        border: '1px solid rgba(16, 185, 129, 0.3)'
                    }}>
                        <p style={{
                            fontSize: '0.9rem',
                            color: 'var(--success)',
                            margin: 0
                        }}>
                            ✅ You must be an authorized issuer for the selected credential type.
                        </p>
                    </div>

                    <Input
                        label="Target Token ID"
                        type="number"
                        value={issueData.targetTokenId}
                        onChange={(val) => setIssueData({ ...issueData, targetTokenId: val })}
                        placeholder="Token ID to issue credential to"
                    />

                    <Select
                        label="Credential Type"
                        value={issueData.credType}
                        onChange={(val) => setIssueData({ ...issueData, credType: val })}
                        options={credentialTypes.map((t, i) => ({ value: i.toString(), label: t }))}
                    />

                    <Input
                        label="Institution/Organization"
                        value={issueData.institution}
                        onChange={(val) => setIssueData({ ...issueData, institution: val })}
                        placeholder="Your institution name"
                    />

                    <Input
                        label="Title/Name"
                        value={issueData.title}
                        onChange={(val) => setIssueData({ ...issueData, title: val })}
                        placeholder="Credential title"
                    />

                    <TextArea
                        label="Description"
                        value={issueData.description}
                        onChange={(val) => setIssueData({ ...issueData, description: val })}
                        placeholder="Credential description"
                    />

                    <Input
                        label="Issue Date"
                        type="date"
                        value={issueData.issueDate}
                        onChange={(val) => setIssueData({ ...issueData, issueDate: val })}
                    />

                    <Input
                        label="Expiry Date (optional)"
                        type="date"
                        value={issueData.expiryDate}
                        onChange={(val) => setIssueData({ ...issueData, expiryDate: val })}
                    />

                    {parseInt(issueData.credType) === 4 && (
                        <Select
                            label="Skill Category"
                            value={issueData.category}
                            onChange={(val) => setIssueData({ ...issueData, category: val })}
                            options={skillCategories.map((c, i) => ({ value: i.toString(), label: c }))}
                        />
                    )}

                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        justifyContent: 'flex-end',
                        marginTop: '24px'
                    }}>
                        <Button
                            variant="secondary"
                            onClick={() => setShowIssueModal(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleIssueCredential}
                            disabled={loading}
                        >
                            {loading ? 'Issuing...' : '✅ Issue Credential'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// Social Tab Component
SocialTab = function ({ contracts, selectedToken, userTokens, account, showNotification }) {
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

            <style>{`
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
ReputationSection = function ({ reputation, reviews, reviewsWritten, loading, contracts, selectedToken, userTokens, showNotification, onReload }) {
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

            <style>{`
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
ProjectsSection = function ({ projects, collaboratingOn, loading, contracts, selectedToken, showNotification, onReload }) {
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

            <style>{`
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
EndorsementsSection = function ({ endorsements, loading, contracts, selectedToken, userTokens, showNotification, onReload }) {
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

                <style>{`
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
AnalyticsTab = function ({ contracts, selectedToken, showNotification }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!selectedToken || !contracts) return;
        loadAnalytics();
    }, [selectedToken, contracts]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            // selectedToken is already the ID number
            const tokenId = selectedToken;

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
// VIEW IDENTITIES TAB - View tokens you have access to
// ============================================
ViewIdentitiesTab = function ({ contracts, account, showNotification }) {
    const [viewTokenId, setViewTokenId] = useState('');
    const [viewingToken, setViewingToken] = useState(null);
    const [tokenData, setTokenData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);

    const handleViewToken = async () => {
        if (!viewTokenId || !contracts) {
            showNotification('Please enter a token ID', 'warning');
            return;
        }

        setLoading(true);
        try {
            const tokenIdNumber = parseInt(viewTokenId);

            console.log('🔍 Checking access to token:', tokenIdNumber);

            // Check if token exists
            let owner;
            try {
                owner = await contracts.soulbound.ownerOf(tokenIdNumber);
            } catch (err) {
                showNotification('Token does not exist', 'error');
                setLoading(false);
                return;
            }

            // Check if we have access
            const canView = await contracts.soulbound.canView(tokenIdNumber, account);

            if (!canView) {
                showNotification('You do not have access to this token', 'error');
                setHasAccess(false);
                setLoading(false);
                return;
            }

            console.log('✅ Access granted! Loading data...');
            setHasAccess(true);
            setViewingToken(tokenIdNumber);

            // Load token metadata
            let metadata = { name: `Token #${tokenIdNumber}`, bio: 'No bio available' };
            try {
                const cid = await contracts.soulbound.getMetadata(tokenIdNumber);
                // In production, fetch from IPFS
                console.log('📝 Token CID:', cid);
            } catch (err) {
                console.log('Could not fetch metadata');
            }

            // Load credentials
            const allCredentials = [];
            for (let type = 0; type < 5; type++) {
                try {
                    const creds = await contracts.credentials.getCredentialsByType(tokenIdNumber, type);
                    allCredentials.push(...creds.map(c => ({
                        ...c,
                        credType: type,
                        typeName: credentialTypes[type]
                    })));
                } catch (err) {
                    console.log(`No credentials of type ${type}`);
                }
            }

            // Load credentials summary
            let summary = null;
            try {
                const sum = await contracts.credentials.getCredentialSummary(tokenIdNumber);
                summary = {
                    degrees: sum.degrees.toNumber(),
                    certifications: sum.certifications.toNumber(),
                    workExperience: sum.workExperience.toNumber(),
                    identityProofs: sum.identityProofs.toNumber(),
                    skills: sum.skills.toNumber()
                };
            } catch (err) {
                console.log('Could not load credential summary');
            }

            // Load social data
            let reputation = null;
            let reviews = [];
            let projects = [];
            let endorsements = [];

            try {
                const rep = await contracts.social.getReputationSummary(tokenIdNumber);
                reputation = {
                    averageScore: rep.averageScore.toNumber(),
                    totalReviews: rep.totalReviews.toNumber(),
                    verifiedReviews: rep.verifiedReviews.toNumber()
                };
            } catch (err) {
                console.log('Could not load reputation');
            }

            try {
                reviews = await contracts.social.getReviews(tokenIdNumber);
            } catch (err) {
                console.log('Could not load reviews');
            }

            try {
                projects = await contracts.social.getProjects(tokenIdNumber);
            } catch (err) {
                console.log('Could not load projects');
            }

            try {
                endorsements = await contracts.social.getEndorsements(tokenIdNumber);
            } catch (err) {
                console.log('Could not load endorsements');
            }

            setTokenData({
                tokenId: tokenIdNumber,
                owner,
                metadata,
                credentials: allCredentials,
                summary,
                reputation,
                reviews,
                projects,
                endorsements
            });

            showNotification('Token data loaded successfully!', 'success');
        } catch (error) {
            console.error('❌ Error viewing token:', error);
            showNotification(error.message || 'Failed to load token data', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="view-identities-container">
            <h2 style={{ marginBottom: '24px', color: 'var(--beige, #e8dfca)' }}>View Identities</h2>

            <Card>
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ marginBottom: '16px' }}>Enter Token ID</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.95rem' }}>
                        View the identity and credentials of tokens you have access to
                    </p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                        <Input
                            label="Token ID"
                            value={viewTokenId}
                            onChange={setViewTokenId}
                            type="number"
                            placeholder="Enter token ID (e.g., 1, 2, 3...)"
                        />
                        <Button
                            onClick={handleViewToken}
                            disabled={loading || !viewTokenId}
                            style={{ minWidth: '120px', height: '48px' }}
                        >
                            {loading ? 'Loading...' : '🔍 View'}
                        </Button>
                    </div>
                </div>

                {loading && <LoadingSpinner />}

                {!loading && tokenData && (
                    <div className="token-data-display" style={{ marginTop: '32px' }}>
                        {/* Token Info Section */}
                        <div style={{
                            background: 'var(--bg-tertiary)',
                            padding: '20px',
                            borderRadius: '12px',
                            marginBottom: '24px',
                            borderLeft: '4px solid var(--teal)'
                        }}>
                            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>👤</span> Token #{tokenData.tokenId}
                            </h3>
                            <div style={{ display: 'grid', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Owner:</span>
                                    <code style={{ color: 'var(--teal-light)', fontSize: '0.9rem' }}>
                                        {shortenAddress(tokenData.owner)}
                                    </code>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Access Status:</span>
                                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Granted</span>
                                </div>
                            </div>
                        </div>

                        {/* Credentials Summary */}
                        {tokenData.summary && (
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ marginBottom: '16px' }}>📜 Credentials Summary</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🎓</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--teal-light)' }}>
                                            {tokenData.summary.degrees}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Degrees</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📜</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--teal-light)' }}>
                                            {tokenData.summary.certifications}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Certifications</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💼</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--teal-light)' }}>
                                            {tokenData.summary.workExperience}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Work Experience</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚡</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--teal-light)' }}>
                                            {tokenData.summary.skills}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Skills</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Credentials List */}
                        {tokenData.credentials.length > 0 && (
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ marginBottom: '16px' }}>📋 Credentials ({tokenData.credentials.length})</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {tokenData.credentials.map((cred, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                padding: '16px',
                                                borderRadius: '8px',
                                                borderLeft: '4px solid var(--teal)'
                                            }}
                                        >
                                            <div style={{ fontWeight: 600, color: 'var(--teal-light)', marginBottom: '8px' }}>
                                                {cred.typeName}
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                                Credential ID: {cred.credentialId.toString()}
                                            </div>
                                            <div style={{
                                                fontSize: '0.85rem',
                                                color: 'var(--text-muted)',
                                                marginBottom: '8px',
                                                wordBreak: 'break-all'
                                            }}>
                                                <div style={{ marginBottom: '4px', color: 'var(--text-secondary)' }}>
                                                    🔐 Metadata Hash:
                                                </div>
                                                <code style={{
                                                    background: 'var(--bg-secondary)',
                                                    padding: '4px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.8rem',
                                                    color: 'var(--teal-light)'
                                                }}>
                                                    {cred.metadataHash}
                                                </code>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                📅 Issued: {formatDate(cred.issueDate)} •
                                                Expires: {cred.expiryDate.toNumber() === 0 ? 'Never' : formatDate(cred.expiryDate)}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                👤 Issuer: <code style={{ fontSize: '0.8rem' }}>{shortenAddress(cred.issuer)}</code> •
                                                Status: {cred.status === 0 ? '✅ Active' : '❌ Revoked'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Reputation */}
                        {tokenData.reputation && (
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ marginBottom: '16px' }}>⭐ Reputation</h3>
                                <div style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                                Average Score
                                            </div>
                                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--teal-light)' }}>
                                                {tokenData.reputation.averageScore}/10
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                                Total Reviews
                                            </div>
                                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--teal-light)' }}>
                                                {tokenData.reputation.totalReviews}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                                Verified Reviews
                                            </div>
                                            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success)' }}>
                                                {tokenData.reputation.verifiedReviews}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Projects */}
                        {tokenData.projects.length > 0 && (
                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ marginBottom: '16px' }}>🚀 Projects ({tokenData.projects.length})</h3>
                                <div style={{ display: 'grid', gap: '12px' }}>
                                    {tokenData.projects.map((proj, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                padding: '16px',
                                                borderRadius: '8px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    Project #{proj.projectId.toString()}
                                                </div>
                                                <div style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    background: proj.status === 2 ? 'var(--success)' : 'var(--info)',
                                                    color: 'white',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600
                                                }}>
                                                    {projectStatuses[proj.status]}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                                Created: {formatDate(proj.createdAt)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Endorsements */}
                        {tokenData.endorsements.length > 0 && (
                            <div>
                                <h3 style={{ marginBottom: '16px' }}>👍 Skill Endorsements ({tokenData.endorsements.length})</h3>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                    {tokenData.endorsements.map((end, idx) => (
                                        <div
                                            key={idx}
                                            style={{
                                                background: 'var(--bg-tertiary)',
                                                padding: '12px 16px',
                                                borderRadius: '20px',
                                                fontSize: '0.9rem',
                                                color: 'var(--teal-light)',
                                                border: '1px solid var(--teal)'
                                            }}
                                        >
                                            👍 Endorsement #{idx + 1}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {!loading && !tokenData && (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🔍</div>
                        <p>Enter a token ID above to view its identity and credentials</p>
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

console.log('✅ All components loaded globally');
