EndorsementsSection = function ({ endorsements, endorsementCounts, loading, contracts, selectedToken, userTokens, showNotification, onReload }) {
    const [showEndorseModal, setShowEndorseModal] = useState(false);
    const [endorseData, setEndorseData] = useState({
        targetTokenId: '',
        endorserTokenId: '',
        skillName: '',
        comment: ''
    });

    // Group endorsements by skill hash - NOW SORTED BY COUNT
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

    // NEW: Sort skills by endorsement count (most endorsed first)
    const sortedSkills = Object.entries(endorsementsBySkill).sort((a, b) => {
        const countA = endorsementCounts[a[0]] || a[1].length;
        const countB = endorsementCounts[b[0]] || b[1].length;
        return countB - countA; // Descending order
    });

    // NEW: Calculate character count for comment
    const commentLength = endorseData.comment.length;
    const commentLimit = 300; // Recommended limit

    const handleEndorseSkill = async () => {
        try {
            if (!endorseData.targetTokenId || !endorseData.endorserTokenId || !endorseData.skillName) {
                showNotification('Please fill in all required fields', 'error');
                return;
            }

            const targetId = parseInt(endorseData.targetTokenId);
            const endorserId = parseInt(endorseData.endorserTokenId);

            if (targetId === endorserId) {
                showNotification('You cannot endorse yourself!', 'error');
                return;
            }

            // Validate tokens exist
            try {
                await contracts.soulbound.ownerOf(targetId);
            } catch (err) {
                showNotification(`Token #${targetId} does not exist!`, 'error');
                return;
            }

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
                        {/* NEW: Show unique skill count */}
                        <span className="badge" style={{ background: 'rgba(102, 126, 234, 0.8)' }}>
                            {Object.keys(endorsementsBySkill).length} Skills
                        </span>
                        <span className="badge">{endorsements?.length || 0} Total</span>
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
                        {/* NEW: Render sorted skills */}
                        {sortedSkills.map(([skillHash, skillEndorsements]) => {
                            const count = endorsementCounts[skillHash] || skillEndorsements.length;

                            return (
                                <div key={skillHash} className="skill-group">
                                    <div className="skill-header">
                                        <span className="skill-name">
                                            Skill Hash: {skillHash.substring(0, 10)}...
                                        </span>
                                        {/* NEW: Enhanced count display */}
                                        <span className="endorsement-count" style={{
                                            background: 'rgba(102, 126, 234, 0.2)',
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '0.9rem',
                                            fontWeight: '600'
                                        }}>
                                            ⚡ {count} {count === 1 ? 'endorsement' : 'endorsements'}
                                        </span>
                                    </div>
                                    <div className="endorsements-list">
                                        {skillEndorsements.map((endorsement, idx) => (
                                            <div key={idx} className="endorsement-item">
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    marginBottom: '8px'
                                                }}>
                                                    <div style={{ fontWeight: '500', color: 'var(--beige)' }}>
                                                        From Token #{endorsement.endorserId.toString()}
                                                    </div>
                                                    <div className="endorsement-date">
                                                        {formatDate(endorsement.endorsedAt)}
                                                    </div>
                                                </div>

                                                {/* NEW: Display comment if exists */}
                                                {endorsement.comment && endorsement.comment.trim() !== '' && (
                                                    <div style={{
                                                        background: 'rgba(6, 182, 212, 0.05)',
                                                        padding: '10px',
                                                        borderRadius: '6px',
                                                        marginTop: '8px',
                                                        borderLeft: '3px solid var(--teal)'
                                                    }}>
                                                        <div style={{
                                                            fontSize: '0.8rem',
                                                            color: 'var(--text-muted)',
                                                            marginBottom: '4px',
                                                            fontWeight: '600'
                                                        }}>
                                                            💬 Comment:
                                                        </div>
                                                        <p style={{
                                                            color: 'var(--text-primary)',
                                                            fontSize: '0.9rem',
                                                            lineHeight: '1.5',
                                                            margin: 0
                                                        }}>
                                                            {endorsement.comment}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
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
                    gap: 12px;
                }

                .endorsement-item {
                    background: rgba(26, 35, 50, 0.5);
                    border-radius: 8px;
                    padding: 12px;
                    border-left: 4px solid var(--sky);
                }

                .endorsement-date {
                    font-size: 12px;
                    color: var(--gray);
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

                    {/* NEW: Comment with character counter */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <label className="input-label">Comment (Optional)</label>
                            <span style={{
                                fontSize: '0.8rem',
                                color: commentLength > commentLimit ? 'var(--warning)' : 'var(--text-muted)'
                            }}>
                                {commentLength}/{commentLimit}
                                {commentLength > commentLimit && ' ⚠️'}
                            </span>
                        </div>
                        <TextArea
                            value={endorseData.comment}
                            onChange={(val) => setEndorseData({ ...endorseData, comment: val })}
                            placeholder="Add a comment about this skill..."
                            rows={3}
                        />
                        {commentLength > commentLimit && (
                            <div style={{
                                fontSize: '0.8rem',
                                color: 'var(--warning)',
                                marginTop: '4px'
                            }}>
                                ⚠️ Long comments cost more gas. Consider keeping it under {commentLimit} characters.
                            </div>
                        )}
                    </div>

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


