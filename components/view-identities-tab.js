ViewIdentitiesTab = function ({ contracts, account, showNotification }) {
    const [mode, setMode] = useState('token'); // 'token' | 'address'
    const [viewTokenId, setViewTokenId] = useState('');
    const [viewAddress, setViewAddress] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleLookup = async () => {
        if (!contracts) return;

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
        setResult(null);
        try {
            if (mode === 'token') {
                if (!viewTokenId) { showNotification('Please enter a token ID', 'warning'); return; }
                const addr = await contracts.soulbound.ownerOf(parseInt(viewTokenId));
                setResult({ type: 'token', tokenId: viewTokenId, owner: addr });
            } else {
                if (!viewAddress) { showNotification('Please enter an address', 'warning'); return; }
                const tokens = await contracts.soulbound.tokensOfOwner(viewAddress);
                setResult({ type: 'address', address: viewAddress, tokenIds: tokens.map(t => t.toString()) });
            }
        } catch (err) {
            showNotification(mode === 'token' ? 'Token does not exist' : 'Invalid address or no tokens found', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="view-identities-container">
            <h2 style={{ marginBottom: '24px', color: 'var(--beige, #e8dfca)' }}>View Identities</h2>

            <Card>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                    <Button
                        onClick={() => { setMode('token'); setResult(null); }}
                        variant={mode === 'token' ? 'primary' : 'secondary'}
                        style={{ flex: 1 }}
                    >
                        Search by Token ID
                    </Button>
                    <Button
                        onClick={() => { setMode('address'); setResult(null); }}
                        variant={mode === 'address' ? 'primary' : 'secondary'}
                        style={{ flex: 1 }}
                    >
                        Search by Address
                    </Button>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    {mode === 'token' ? (
                        <Input
                            label="Token Number or Wallet Address"
                            value={viewTokenId}
                            onChange={setViewTokenId}
                            type="number"
                            placeholder="e.g. 1, 2, 3..."
                        />
                    ) : (
                        <Input
                            label="Wallet Address"
                            value={viewAddress}
                            onChange={setViewAddress}
                            placeholder="0x..."
                        />
                    )}
                    <Button
                        onClick={handleLookup}
                        disabled={loading || (mode === 'token' ? !viewTokenId : !viewAddress)}
                        style={{ minWidth: '120px', height: '48px' }}
                    >
                        {loading ? 'Looking up...' : '🔍 Look Up'}
                    </Button>
                </div>

                {result && (
                    <div style={{
                        marginTop: '24px',
                        background: 'var(--bg-tertiary)',
                        padding: '20px',
                        borderRadius: '12px',
                        borderLeft: '4px solid var(--teal)'
                    }}>
                        {result.type === 'token' ? (
                            <>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    Token #{result.tokenId} is owned by
                                </div>
                                <code style={{ color: 'var(--teal-light)', fontSize: '1rem', wordBreak: 'break-all' }}>
                                    {result.owner}
                                </code>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                                    {result.tokenIds.length === 0
                                        ? 'This address owns no tokens'
                                        : `This address owns ${result.tokenIds.length} token${result.tokenIds.length > 1 ? 's' : ''}`}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {result.tokenIds.map(id => (
                                        <span key={id} style={{
                                            background: 'var(--bg-secondary)',
                                            color: 'var(--teal-light)',
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            fontSize: '0.95rem',
                                            fontWeight: 600
                                        }}>
                                            #{id}
                                        </span>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {!loading && !result && (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🔍</div>
                        <p>{mode === 'token' ? 'Enter a token ID to see its owner address' : 'Enter an address to see its token IDs'}</p>
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
