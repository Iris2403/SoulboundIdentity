CredentialsTab = function ({ contracts, selectedToken, userTokens, showNotification, account }) {
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
    const [selectedSkillCategory, setSelectedSkillCategory] = useState(null); // For skill filtering
    const [issuerAuthStatus, setIssuerAuthStatus] = useState({}); // Track authorized issuers

    const [credentialData, setCredentialData] = useState({
        credType: '0',
        institution: '',
        title: '',
        description: '',
        issueDate: '',
        expiryDate: '',
        category: '0'
    });

    // Constants
    const MAX_CREDENTIALS_PER_TYPE = 100;
    const WARNING_THRESHOLD = 0.9; // Show warning at 90%

    useEffect(() => {
        if (selectedToken && contracts) {
            loadCredentials();
            loadSummary();
            loadCredentialCounts();
        }
    }, [selectedToken, contracts, selectedType, showActiveOnly, selectedSkillCategory]);

    // Check if current account is authorized issuer
    useEffect(() => {
        if (contracts && account) {
            checkIssuerAuthorization();
        }
    }, [contracts, account]);

    // Helper function to get credential status info
    const getCredentialStatusInfo = (status) => {
        const statusMap = {
            0: { label: 'Active', color: 'var(--success)', icon: '🟢', bg: 'rgba(16, 185, 129, 0.1)' },
            1: { label: 'Revoked', color: 'var(--error)', icon: '🔴', bg: 'rgba(239, 68, 68, 0.1)' },
            2: { label: 'Expired', color: 'var(--text-muted)', icon: '⚫', bg: 'rgba(107, 117, 137, 0.1)' }
@@ -240,130 +229,50 @@ CredentialsTab = function ({ contracts, selectedToken, userTokens, showNotificat
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

            if (error.message.includes('TooManyCredentials')) {
                showNotification(`❌ Maximum limit reached (${MAX_CREDENTIALS_PER_TYPE} credentials per type)`, 'error');
            } else {
                showNotification(error.message || 'Failed to add credential', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

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
@@ -371,109 +280,65 @@ CredentialsTab = function ({ contracts, selectedToken, userTokens, showNotificat
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
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <Button onClick={() => setShowAddModal(true)} variant="secondary">
                        ➕ Add Credential
                    </Button>
                    <Button
                        onClick={() => setShowIssueModal(true)}
                        style={{
                            position: 'relative'
                        }}
                        title="Submit credentials for network verification"
                    >
                        🔎 Verify Credentials

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
                        {[
                            { key: 'degrees', icon: '🎓', type: 0, color: 'rgba(102, 126, 234, 0.1)' },
                            { key: 'certifications', icon: '📜', type: 1, color: 'rgba(14, 165, 233, 0.1)' },
                            { key: 'workExperience', icon: '💼', type: 2, color: 'rgba(6, 182, 212, 0.1)' },
                            { key: 'identityProofs', icon: '🆔', type: 3, color: 'rgba(240, 147, 251, 0.1)' },
                            { key: 'skills', icon: '⚡', type: 4, color: 'rgba(42, 245, 152, 0.1)' }
                        ].map(({ key, icon, type, color }) => {
                            const count = summary[key];
                            const isNearLimit = count >= MAX_CREDENTIALS_PER_TYPE * WARNING_THRESHOLD;

                            return (
                                <div key={key} style={{
                                    textAlign: 'center',
                                    padding: '16px',
@@ -956,70 +821,70 @@ CredentialsTab = function ({ contracts, selectedToken, userTokens, showNotificat
                                                variant="secondary"
                                                onClick={() => handleUpdateStatus(cred.credentialId)}
                                                style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                            >
                                                🔄 Update to Expired
                                            </Button>
                                        )}

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

            {/* Add Credential Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="➕ Add Credential"
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
                            ⚠️ Added credentials are self-reported and unverified. You can submit them for network verification later.
                        </p>
                    </div>

                    {/* Limit warning in modal */}
                    {isApproachingLimit(parseInt(credentialData.credType)) && (
                        <div style={{
                            background: 'rgba(245, 158, 11, 0.1)',
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            border: '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                            <p style={{
                                fontSize: '0.85rem',
                                color: 'var(--warning)',
                                margin: 0
                            }}>
                                ⚠️ You have {credentialCounts[parseInt(credentialData.credType)] || 0}/{MAX_CREDENTIALS_PER_TYPE} {credentialTypes[parseInt(credentialData.credType)]} credentials. Approaching limit!
                            </p>
                        </div>
                    )}

                    <Select
                        label="Credential Type"
                        value={credentialData.credType}
@@ -1081,187 +946,72 @@ CredentialsTab = function ({ contracts, selectedToken, userTokens, showNotificat
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
                            disabled={loading || (credentialCounts[parseInt(credentialData.credType)] || 0) >= MAX_CREDENTIALS_PER_TYPE}
                        >
                            {loading ? 'Adding...' : '➕ Add Credential'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Verify Credentials Modal */}
            <Modal
                isOpen={showIssueModal}
                onClose={() => setShowIssueModal(false)}
                title="🔎 Verify Credentials"
            >
                <div>
                    <div style={{
                        background: 'rgba(6, 182, 212, 0.1)',
                        padding: '14px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                        border: '1px solid rgba(6, 182, 212, 0.3)'
                    }}>
                        <p style={{
                            fontSize: '0.95rem',
                            color: 'var(--teal-light)',
                            margin: 0,
                            lineHeight: 1.6
                        }}>
                            Submit self-reported credentials first using <strong>Add Credential</strong>.
                            Verification requests will be processed through our network in a later release.
                        </p>
                    </div>

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
                        <Button onClick={() => setShowIssueModal(false)}>
                            Got it
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
