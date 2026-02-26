ViewIdentitiesTab = function ({ contracts, account, showNotification }) {
    const [viewTokenId, setViewTokenId] = useState('');
    const [owner, setOwner] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleLookup = async () => {
        if (!viewTokenId || !contracts) {
            showNotification('Please enter a token ID', 'warning');
            return;
        }

        setLoading(true);
        setOwner(null);
        try {
            const addr = await contracts.soulbound.ownerOf(parseInt(viewTokenId));
            setOwner(addr);
        } catch (err) {
            showNotification('Token does not exist', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="view-identities-container">
            <h2 style={{ marginBottom: '24px', color: 'var(--beige, #e8dfca)' }}>View Identities</h2>

            <Card>
                <h3 style={{ marginBottom: '16px' }}>Token Lookup</h3>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                    <Input
                        label="Token ID"
                        value={viewTokenId}
                        onChange={setViewTokenId}
                        type="number"
                        placeholder="e.g. 1, 2, 3..."
                    />
                    <Button
                        onClick={handleLookup}
                        disabled={loading || !viewTokenId}
                        style={{ minWidth: '120px', height: '48px' }}
                    >
                        {loading ? 'Looking up...' : '🔍 Look Up'}
                    </Button>
                </div>

                {owner && (
                    <div style={{
                        marginTop: '24px',
                        background: 'var(--bg-tertiary)',
                        padding: '20px',
                        borderRadius: '12px',
                        borderLeft: '4px solid var(--teal)'
                    }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Token #{viewTokenId} is owned by
                        </div>
                        <code style={{ color: 'var(--teal-light)', fontSize: '1rem', wordBreak: 'break-all' }}>
                            {owner}
                        </code>
                    </div>
                )}

                {!loading && !owner && (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🔍</div>
                        <p>Enter a token ID to see its owner address</p>
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
