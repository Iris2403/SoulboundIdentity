TokenCard = function ({ token, isSelected, onSelect, contracts, onBurned }) {
    const [metadata, setMetadata] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);
    const [showBurnConfirm, setShowBurnConfirm] = useState(false);
    const [burning, setBurning] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        loadMetadata();
    }, [token.cid]);

    const loadMetadata = async () => {
        try {
            const response = await fetch(`${CONFIG.IPFS_GATEWAY}${token.cid}`);
            if (!response.ok) throw new Error('Failed to fetch metadata from IPFS');
            const data = await response.json();
            setMetadata(data);
        } catch (error) {
            console.error('Error loading metadata:', error);
            setMetadata({ name: `Token #${token.id}`, bio: '', profileImage: '' });
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
        addToast('Copied to clipboard!', 'success');
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

            if (onBurned) onBurned(token.id);
        } catch (error) {
            console.error('❌ Error burning token:', error);
            addToast('Failed to burn token: ' + (error.message || 'Unknown error'), 'error');
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
                            setShowDetails(true);
                        }}
                        style={{ position: 'relative', zIndex: 100 }}
                    >
                        👁️ View Full Details
                    </button>
                    <button
                        className="invalidate-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowBurnConfirm(true);
                        }}
                        style={{ position: 'relative', zIndex: 100 }}
                    >
                        Invalidate Token
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
                            Permanently invalidate this identity token and all associated access data. This action cannot be undone.
                        </p>
                        <Button
                            variant="danger"
                            onClick={() => setShowBurnConfirm(true)}
                            disabled={burning}
                        >
                            Invalidate Token
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
                    display: flex;
                    gap: 8px;
                }

                .view-details-btn {
                    flex: 1;
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

                .invalidate-btn {
                    padding: 12px 16px;
                    background: transparent;
                    border: 1px solid rgba(239, 68, 68, 0.5);
                    color: var(--error, #ef4444);
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: all 0.3s ease;
                    white-space: nowrap;
                }

                .invalidate-btn:hover {
                    background: rgba(239, 68, 68, 0.1);
                    border-color: var(--error, #ef4444);
                    transform: translateY(-2px);
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
                title="⚠️ Confirm Token Invalidation"
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
                            You are about to permanently invalidate Token #{token.id}. This will:
                        </p>
                    </div>

                    <ul style={{
                        color: 'var(--text-secondary)',
                        marginLeft: '20px',
                        marginBottom: '24px',
                        lineHeight: '1.8'
                    }}>
                        <li>Invalidate the identity token on the blockchain</li>
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
                        Are you absolutely sure you want to invalidate this identity?
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
                            {burning ? 'Invalidating...' : 'Yes, Invalidate Token'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
