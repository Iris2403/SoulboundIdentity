IdentityTab = function ({ contracts, account, userTokens, selectedToken, setSelectedToken, onTokenCreated, showNotification }) {
    const [showMintModal, setShowMintModal] = useState(false);
    const [minting, setMinting] = useState(false);
    const [mintData, setMintData] = useState({
        name: '',
        bio: '',
        profileImage: '',
        burnAuth: '1'
    });

    const handleMint = async () => {
        if (userTokens.length > 0) {
            showNotification('You already have an identity token. Only one token per address is allowed.', 'error');
            return;
        }
        try {
            setMinting(true);

            // Create metadata object
            const metadata = {
                name: mintData.name,
                bio: mintData.bio,
                profileImage: mintData.profileImage,
                createdAt: Date.now()
            };

            // Upload metadata to IPFS via Pinata
            const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.PINATA.JWT}`
                },
                body: JSON.stringify({
                    pinataContent: metadata,
                    pinataMetadata: { name: `identity-${mintData.name}-${Date.now()}` }
                })
            });

            if (!pinataResponse.ok) {
                const err = await pinataResponse.json();
                throw new Error('Failed to upload to IPFS: ' + (err.error?.details || pinataResponse.statusText));
            }

            const pinataData = await pinataResponse.json();
            const ipfsCID = pinataData.IpfsHash;

            // Mint token
            const tx = await contracts.soulbound.mint(ipfsCID, parseInt(mintData.burnAuth));
            showNotification('Transaction submitted. Waiting for confirmation...', 'info');

            await tx.wait();
            showNotification('Identity token minted successfully!', 'success');

            setShowMintModal(false);
            setMintData({ name: '', bio: '', profileImage: '', burnAuth: '1' });
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
                {userTokens.length === 0 && (
                    <Button onClick={() => setShowMintModal(true)}>
                        <span style={{ marginRight: '8px' }}>+</span>
                        Mint Identity Token
                    </Button>
                )}
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
