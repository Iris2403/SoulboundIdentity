AccessControlTab = function ({ contracts, selectedToken, userTokens, showNotification }) {
    const [pendingRequests, setPendingRequests] = useState([]);
    const [grantedAccess, setGrantedAccess] = useState([]);
    const [tokensICanAccess, setTokensICanAccess] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestTokenId, setRequestTokenId] = useState('');
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewingToken, setViewingToken] = useState(null);

    // Helper function to get countdown string
    const getExpiryCountdown = (expiresAt) => {
        const now = Math.floor(Date.now() / 1000);
        const timeLeft = expiresAt - now;

        if (timeLeft <= 0) return '⚫ Expired';

        const days = Math.floor(timeLeft / 86400);
        const hours = Math.floor((timeLeft % 86400) / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);

        if (days > 0) return `🟢 Expires in ${days} day${days > 1 ? 's' : ''} ${hours}h`;
        if (hours > 0) return `🟡 Expires in ${hours} hour${hours > 1 ? 's' : ''} ${minutes}m`;
        return `🔴 Expires in ${minutes} minute${minutes > 1 ? 's' : ''}`;
    };

    // Helper function to get access status label
    const getAccessStatusLabel = (status) => {
        const statusMap = {
            0: { label: 'No Request', color: 'var(--text-muted)', icon: '⚪' },
            1: { label: 'Pending', color: 'var(--warning)', icon: '🟡' },
            2: { label: 'Approved', color: 'var(--success)', icon: '🟢' },
            3: { label: 'Denied', color: 'var(--error)', icon: '🔴' }
        };
        return statusMap[status] || statusMap[0];
    };

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
            // Load pending requests with status
            const requests = await contracts.soulbound.getPendingRequests(selectedToken, 0, 50);

            // Enhance pending requests with status info
            const enhancedRequests = [];
            for (const requester of requests.requesters) {
                try {
                    const status = await contracts.soulbound.getAccessStatus(selectedToken, requester);
                    enhancedRequests.push({
                        address: requester,
                        status: status
                    });
                } catch (err) {
                    console.log('Could not fetch status for:', requester);
                    enhancedRequests.push({
                        address: requester,
                        status: 1 // Default to Pending
                    });
                }
            }

            setPendingRequests(enhancedRequests);

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
            if (!requestTokenId) {
                showNotification('Please enter a token ID', 'warning');
                return;
            }

            console.log('🔵 Requesting access to token:', requestTokenId);

            const tokenIdNumber = parseInt(requestTokenId);

            // Check if token exists
            try {
                await contracts.soulbound.ownerOf(tokenIdNumber);
            } catch (err) {
                showNotification('Token does not exist', 'error');
                return;
            }

            const tx = await contracts.soulbound.requestAccess(tokenIdNumber);
            console.log('⏳ Request access transaction hash:', tx.hash);
            showNotification('Requesting access...', 'info');

            const receipt = await tx.wait();
            console.log('✅ Access request confirmed:', receipt);
            showNotification('Access request sent!', 'success');

            setShowRequestModal(false);
            setRequestTokenId('');
        } catch (error) {
            console.error('❌ Error requesting access:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                data: error.data,
                reason: error.reason
            });

            // Check for specific error messages from the contract
            let errorMessage = 'Failed to request access';
            if (error.message.includes('RequestAlreadyExists')) {
                errorMessage = 'You already have a pending request for this token';
            } else if (error.message.includes('TooManyRequests')) {
                errorMessage = 'You have reached the maximum requests per day';
            } else if (error.message.includes('RequestCooldown')) {
                errorMessage = 'Please wait before requesting access again';
            } else if (error.message.includes('OnlyTokenOwner')) {
                errorMessage = 'You cannot request access to your own token';
            } else if (error.message.includes('OwnerHasAccess')) {
                errorMessage = 'Token owner already has full access';
            } else if (error.reason) {
                errorMessage = error.reason;
            } else if (error.message) {
                errorMessage = error.message;
            }

            showNotification(errorMessage, 'error');
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
                            {pendingRequests.map((requester, idx) => {
                                const statusInfo = getAccessStatusLabel(requester.status || 1);
                                return (
                                    <div key={idx} className="request-item">
                                        <div className="requester-info">
                                            <div className="requester-avatar">👤</div>
                                            <div style={{ flex: 1 }}>
                                                <div className="requester-address">
                                                    {shortenAddress(requester.address || requester)}
                                                </div>
                                                <div className="requester-label">Wallet Address</div>
                                                <div style={{
                                                    marginTop: '8px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '4px 10px',
                                                    background: 'rgba(245, 158, 11, 0.1)',
                                                    borderRadius: '12px',
                                                    fontSize: '0.85rem',
                                                    fontWeight: '600',
                                                    color: statusInfo.color
                                                }}>
                                                    {statusInfo.icon} {statusInfo.label}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="request-actions">
                                            <Button
                                                onClick={() => handleApproveAccess(requester.address || requester)}
                                                style={{ padding: '8px 16px', fontSize: '13px' }}
                                            >
                                                Approve
                                            </Button>
                                            <Button
                                                variant="danger"
                                                onClick={() => handleDenyAccess(requester.address || requester)}
                                                style={{ padding: '8px 16px', fontSize: '13px' }}
                                            >
                                                Deny
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
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
                                        <div style={{ flex: 1 }}>
                                            <div className="requester-address">{shortenAddress(item.address)}</div>
                                            <div className="requester-label" style={{ marginTop: '8px' }}>
                                                📅 Granted: {formatDate(item.expiresAt - (30 * 24 * 60 * 60))}
                                            </div>
                                            <div style={{
                                                marginTop: '8px',
                                                padding: '6px 12px',
                                                background: 'rgba(6, 182, 212, 0.1)',
                                                borderRadius: '6px',
                                                display: 'inline-block'
                                            }}>
                                                <span style={{
                                                    fontSize: '0.9rem',
                                                    fontWeight: '600',
                                                    color: item.expiresAt > Math.floor(Date.now() / 1000) ? 'var(--success)' : 'var(--error)'
                                                }}>
                                                    {getExpiryCountdown(item.expiresAt)}
                                                </span>
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

            <style>{`
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

