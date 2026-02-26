ViewIdentitiesTab = function ({ contracts, account, showNotification }) {
    const [viewTokenId, setViewTokenId] = useState('');
    const [viewingToken, setViewingToken] = useState(null);
    const [tokenData, setTokenData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hasAccess, setHasAccess] = useState(false);
    const [addressTokens, setAddressTokens] = useState([]); // multiple tokens found by address

    const isEthAddress = (input) => /^0x[0-9a-fA-F]{40}$/.test(input.trim());

    const handleViewToken = async () => {
        if (!viewTokenId || !contracts) {
            showNotification('Please enter a token ID or wallet address', 'warning');
            return;
        }

        const trimmed = viewTokenId.trim();

        // Address search: find all tokens owned by that address
        if (isEthAddress(trimmed)) {
            setLoading(true);
            setAddressTokens([]);
            setTokenData(null);
            try {
                const tokens = await contracts.soulbound.tokensOfOwner(trimmed);
                if (tokens.length === 0) {
                    showNotification('No tokens found for this address', 'warning');
                    return;
                }
                if (tokens.length === 1) {
                    await loadTokenById(tokens[0].toNumber());
                    return;
                }
                // Multiple tokens — let user pick
                setAddressTokens(tokens.map(t => t.toNumber()));
                showNotification(`Found ${tokens.length} tokens for this address. Select one below.`, 'info');
            } catch (error) {
                console.error('Error fetching tokens by address:', error);
                showNotification(error.message || 'Failed to fetch tokens for address', 'error');
            } finally {
                setLoading(false);
            }
            return;
        }

        // Token ID search
        const tokenIdNumber = parseInt(trimmed);
        if (isNaN(tokenIdNumber)) {
            showNotification('Please enter a valid token number or Ethereum address (0x...)', 'warning');
            return;
        }
        await loadTokenById(tokenIdNumber);
    };

    const loadTokenById = async (tokenIdNumber) => {
        setLoading(true);
        try {
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
                    <h3 style={{ marginBottom: '16px' }}>Search Identity</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.95rem' }}>
                        Search by token number or wallet address to view an identity you have access to
                    </p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                        <Input
                            label="Token Number or Wallet Address"
                            value={viewTokenId}
                            onChange={(val) => { setViewTokenId(val); setAddressTokens([]); setTokenData(null); }}
                            type="text"
                            placeholder="Token number (e.g. 1) or address (0x...)"
                        />
                        <Button
                            onClick={handleViewToken}
                            disabled={loading || !viewTokenId}
                            style={{ minWidth: '120px', height: '48px' }}
                        >
                            {loading ? 'Loading...' : '🔍 View'}
                        </Button>
                    </div>

                    {/* Token picker when address resolves to multiple tokens */}
                    {addressTokens.length > 1 && (
                        <div style={{ marginTop: '20px' }}>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '12px', fontSize: '0.9rem' }}>
                                Multiple tokens found for this address. Select one to view:
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                {addressTokens.map(tid => (
                                    <Button
                                        key={tid}
                                        variant="secondary"
                                        onClick={() => { setAddressTokens([]); loadTokenById(tid); }}
                                        style={{ padding: '8px 20px' }}
                                    >
                                        Token #{tid}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
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

                {!loading && !tokenData && addressTokens.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🔍</div>
                        <p>Enter a token number or wallet address above to view its identity and credentials</p>
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
