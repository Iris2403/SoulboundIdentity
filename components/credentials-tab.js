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
        };
        return statusMap[status] || statusMap[0];
    };

    // Helper to get skill category info with colors
    const getSkillCategoryInfo = (category) => {
        const categoryMap = {
            0: { label: 'Technical', icon: '💻', color: '#667eea' },
            1: { label: 'Soft', icon: '🤝', color: '#f093fb' },
            2: { label: 'Language', icon: '🌍', color: '#4facfe' },
            3: { label: 'Domain', icon: '🎯', color: '#43e97b' },
            4: { label: 'Tool', icon: '🔧', color: '#fa709a' },
            5: { label: 'Other', icon: '📦', color: '#a8b2c1' }
        };
        return categoryMap[category] || categoryMap[5];
    };

    // Check issuer authorization for all credential types
    const checkIssuerAuthorization = async () => {
        if (!contracts || !account) return;

        try {
            const authStatus = {};
            for (let i = 0; i < credentialTypes.length; i++) {
                const isAuthorized = await contracts.credentials.authorizedIssuers(i, account);
                authStatus[i] = isAuthorized;
            }
            setIssuerAuthStatus(authStatus);
        } catch (error) {
            console.error('Error checking issuer authorization:', error);
        }
    };

    // Check if specific credential's issuer is authorized
    const checkCredentialIssuerAuth = async (credType, issuer) => {
        try {
            const isAuth = await contracts.credentials.authorizedIssuers(credType, issuer);
            return isAuth;
        } catch (error) {
            return false;
        }
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

    // Check if approaching limit
    const isApproachingLimit = (type) => {
        const count = credentialCounts[type] || 0;
        return count >= MAX_CREDENTIALS_PER_TYPE * WARNING_THRESHOLD;
    };

    // Load credentials with active filter and skill category filter
    const loadCredentials = async () => {
        if (!selectedToken || !contracts) return;

        setLoading(true);
        try {
            let creds;

            if (showActiveOnly) {
                creds = await contracts.credentials.getActiveCredentials(selectedToken, selectedType);
            } else {
                creds = await contracts.credentials.getCredentialsByType(selectedToken, selectedType);
            }

            // Filter by skill category if Skills type is selected and category is chosen
            if (selectedType === 4 && selectedSkillCategory !== null) {
                creds = creds.filter(c => c.category === selectedSkillCategory);
            }

            // Validate each credential and check issuer authorization
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

    // Add self-reported credential with limit check
    const handleAddCredential = async () => {
        try {
            console.log('🔵 Starting credential add...', { selectedToken, credentialData });

            if (!credentialData.institution || !credentialData.title) {
                showNotification('Please fill in all required fields', 'error');
                return;
            }

            // Check limit
            const currentCount = credentialCounts[parseInt(credentialData.credType)] || 0;
            if (currentCount >= MAX_CREDENTIALS_PER_TYPE) {
                showNotification(`❌ Maximum limit reached (${MAX_CREDENTIALS_PER_TYPE} ${credentialTypes[parseInt(credentialData.credType)]} credentials)`, 'error');
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

    // Issue verified credential with authorization check
    const handleIssueCredential = async () => {
        try {
            console.log('✅ Issuing verified credential...', issueData);

            if (!issueData.institution || !issueData.title || !issueData.targetTokenId) {
                showNotification('Please fill in all required fields', 'error');
                return;
            }

            // Check if authorized
            const isAuthorized = issuerAuthStatus[parseInt(issueData.credType)];
            if (!isAuthorized) {
                showNotification(`❌ You are not authorized to issue ${credentialTypes[parseInt(issueData.credType)]} credentials`, 'error');
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
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <Button onClick={() => setShowAddModal(true)} variant="secondary">
                        ➕ Add Credential
                    </Button>
                    <Button
                        onClick={() => setShowIssueModal(true)}
                        style={{
                            opacity: Object.values(issuerAuthStatus).some(v => v) ? 1 : 0.6,
                            position: 'relative'
                        }}
                        title={Object.values(issuerAuthStatus).some(v => v) ?
                            'You are authorized to issue credentials' :
                            'You are not an authorized issuer'}
                    >
                        ✅ Issue Verified
                        {Object.values(issuerAuthStatus).some(v => v) && (
                            <span style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                width: '12px',
                                height: '12px',
                                background: 'var(--success)',
                                borderRadius: '50%',
                                border: '2px solid var(--bg-primary)',
                                animation: 'pulse 2s infinite'
                            }}></span>
                        )}
                    </Button>
                </div>
            </div>

            {/* Authorization Status Banner */}
            {Object.keys(issuerAuthStatus).length > 0 && Object.values(issuerAuthStatus).some(v => v) && (
                <div style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <span style={{ fontSize: '1.5rem' }}>✅</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: 'var(--success)', marginBottom: '4px' }}>
                            You are an Authorized Issuer
                        </div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            You can issue verified credentials for: {
                                Object.entries(issuerAuthStatus)
                                    .filter(([_, isAuth]) => isAuth)
                                    .map(([type, _]) => credentialTypes[type])
                                    .join(', ')
                            }
                        </div>
                    </div>
                </div>
            )}

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
                                    background: color,
                                    borderRadius: '12px',
                                    position: 'relative',
                                    border: isNearLimit ? '2px solid var(--warning)' : 'none'
                                }}>
                                    {isNearLimit && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '8px',
                                            width: '8px',
                                            height: '8px',
                                            background: 'var(--warning)',
                                            borderRadius: '50%',
                                            animation: 'pulse 2s infinite'
                                        }}></div>
                                    )}
                                    <div style={{ fontSize: '2rem' }}>{icon}</div>
                                    <div style={{
                                        fontSize: '1.5rem',
                                        fontWeight: 'bold',
                                        color: isNearLimit ? 'var(--warning)' : 'var(--teal-light)'
                                    }}>
                                        {count}
                                        <span style={{
                                            fontSize: '0.8rem',
                                            color: 'var(--text-muted)',
                                            marginLeft: '4px'
                                        }}>
                                            /{MAX_CREDENTIALS_PER_TYPE}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        {credentialTypes[type]}
                                    </div>
                                    {isNearLimit && (
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--warning)',
                                            marginTop: '4px',
                                            fontWeight: '600'
                                        }}>
                                            ⚠️ Near Limit
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Filters */}
            <Card>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '20px',
                    flexWrap: 'wrap',
                    gap: '16px'
                }}>
                    {/* Type filter */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                        {credentialTypes.map((type, idx) => {
                            const count = credentialCounts[idx] || 0;
                            const isNearLimit = count >= MAX_CREDENTIALS_PER_TYPE * WARNING_THRESHOLD;

                            return (
                                <button
                                    key={idx}
                                    className={`filter-btn ${selectedType === idx ? 'active' : ''}`}
                                    onClick={() => {
                                        setSelectedType(idx);
                                        setSelectedSkillCategory(null); // Reset skill category filter
                                    }}
                                    style={{
                                        position: 'relative',
                                        padding: '8px 16px',
                                        border: selectedType === idx ?
                                            (isNearLimit ? '2px solid var(--warning)' : '2px solid var(--teal)') :
                                            '1px solid var(--border-color)',
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
                                    <span style={{
                                        marginLeft: '6px',
                                        background: selectedType === idx ?
                                            (isNearLimit ? 'var(--warning)' : 'rgba(255,255,255,0.3)') :
                                            'var(--teal)',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        color: selectedType === idx ? (isNearLimit ? 'white' : 'var(--teal-light)') : 'white'
                                    }}>
                                        {count}
                                    </span>
                                    {isNearLimit && (
                                        <span style={{
                                            position: 'absolute',
                                            top: '-4px',
                                            right: '-4px',
                                            fontSize: '0.7rem'
                                        }}>⚠️</span>
                                    )}
                                </button>
                            );
                        })}
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

                {/* Skill Category Filter (only show when Skills type selected) */}
                {selectedType === 4 && (
                    <div style={{
                        marginBottom: '20px',
                        paddingTop: '16px',
                        borderTop: '1px solid rgba(6, 182, 212, 0.2)'
                    }}>
                        <div style={{
                            fontSize: '0.9rem',
                            color: 'var(--text-secondary)',
                            marginBottom: '12px',
                            fontWeight: '600'
                        }}>
                            Filter by Category:
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => setSelectedSkillCategory(null)}
                                style={{
                                    padding: '6px 14px',
                                    border: selectedSkillCategory === null ? '2px solid var(--teal)' : '1px solid var(--border-color)',
                                    background: selectedSkillCategory === null ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                                    color: selectedSkillCategory === null ? 'var(--teal-light)' : 'var(--text-secondary)',
                                    borderRadius: '16px',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: selectedSkillCategory === null ? '600' : '400',
                                    transition: 'all 0.3s'
                                }}
                            >
                                All Categories
                            </button>
                            {skillCategories.map((cat, idx) => {
                                const catInfo = getSkillCategoryInfo(idx);
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedSkillCategory(idx)}
                                        style={{
                                            padding: '6px 14px',
                                            border: selectedSkillCategory === idx ?
                                                `2px solid ${catInfo.color}` :
                                                '1px solid var(--border-color)',
                                            background: selectedSkillCategory === idx ?
                                                `${catInfo.color}15` :
                                                'transparent',
                                            color: selectedSkillCategory === idx ? catInfo.color : 'var(--text-secondary)',
                                            borderRadius: '16px',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            fontWeight: selectedSkillCategory === idx ? '600' : '400',
                                            transition: 'all 0.3s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <span>{catInfo.icon}</span>
                                        {cat}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Limit Warning */}
                {isApproachingLimit(selectedType) && (
                    <div style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', color: 'var(--warning)' }}>
                                Approaching Credential Limit
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                You have {credentialCounts[selectedType] || 0}/{MAX_CREDENTIALS_PER_TYPE} {credentialTypes[selectedType]} credentials.
                                Consider revoking unused credentials.
                            </div>
                        </div>
                    </div>
                )}

                {/* Credentials list */}
                {loading ? (
                    <LoadingSpinner />
                ) : credentials.length === 0 ? (
                    <div className="empty-message" style={{ textAlign: 'center', padding: '40px' }}>
                        <p>
                            No {showActiveOnly ? 'active ' : ''}
                            {selectedType === 4 && selectedSkillCategory !== null ?
                                `${skillCategories[selectedSkillCategory]} ` : ''}
                            {credentialTypes[selectedType].toLowerCase()} credentials yet
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {credentials.map((cred, idx) => {
                            const statusInfo = getCredentialStatusInfo(cred.status);
                            const isValid = validationStatus[cred.credentialId.toString()];
                            const isExpired = cred.expiryDate > 0 &&
                                Math.floor(Date.now() / 1000) >= cred.expiryDate.toNumber();

                            // NOTE: Issuer auth checking is done during checkIssuerAuthorization
                            // We can check from issuerAuthStatus if current account is authorized for this type
                            const issuerIsAuth = cred.verified && issuerAuthStatus[cred.credType];

                            const catInfo = selectedType === 4 ? getSkillCategoryInfo(cred.category) : null;

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
                                            {/* Verified badge with issuer authorization status */}
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '0.8rem',
                                                fontWeight: '600',
                                                background: cred.verified
                                                    ? 'rgba(16, 185, 129, 0.2)'
                                                    : 'rgba(59, 130, 246, 0.15)',

                                                color: cred.verified
                                                    ? 'var(--success)'
                                                    : '#3b82f6',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                                title={cred.verified && issuerIsAuth ?
                                                    'Issued by authorized institution' :
                                                    (cred.verified ? 'Verified credential' : 'Self-reported, unverified')}
                                            >
                                                {cred.verified ? '✅ Verified' : '⚠️ Self-Reported'}
                                                {cred.verified && issuerIsAuth && (
                                                    <span style={{ fontSize: '0.7rem' }}>🏛️</span>
                                                )}
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

                                            {/* Skill Category Badge (for skills only) */}
                                            {selectedType === 4 && catInfo && (
                                                <span style={{
                                                    padding: '4px 12px',
                                                    borderRadius: '12px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '600',
                                                    background: `${catInfo.color}20`,
                                                    color: catInfo.color,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    {catInfo.icon} {catInfo.label}
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
                                                Issuer {cred.verified && issuerIsAuth ? '(Authorized)' : ''}
                                            </div>
                                            <code style={{
                                                fontSize: '0.85rem',
                                                color: cred.verified && issuerIsAuth ? 'var(--success)' : 'var(--teal-light)'
                                            }}>
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
                                        {isExpired && cred.status === 0 && (
                                            <Button
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

            {/* Add Self-Reported Modal */}
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
                        onChange={(val) => setCredentialData({ ...credentialData, credType: val })}
                        options={credentialTypes.map((t, i) => ({
                            value: i.toString(),
                            label: `${t} (${credentialCounts[i] || 0}/${MAX_CREDENTIALS_PER_TYPE})`
                        }))}
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
                            options={skillCategories.map((c, i) => {
                                const catInfo = getSkillCategoryInfo(i);
                                return {
                                    value: i.toString(),
                                    label: `${catInfo.icon} ${c}`
                                };
                            })}
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
                            disabled={loading || (credentialCounts[parseInt(credentialData.credType)] || 0) >= MAX_CREDENTIALS_PER_TYPE}
                        >
                            {loading ? 'Adding...' : '➕ Add Credential'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Issue Verified Credential Modal */}
            <Modal
                isOpen={showIssueModal}
                onClose={() => setShowIssueModal(false)}
                title="✅ Issue Verified Credential"
            >
                <div>
                    {/* Show authorization status */}
                    {Object.values(issuerAuthStatus).some(v => v) ? (
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
                                margin: 0,
                                marginBottom: '8px'
                            }}>
                                ✅ You are authorized to issue credentials for:
                            </p>
                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                flexWrap: 'wrap',
                                marginTop: '8px'
                            }}>
                                {Object.entries(issuerAuthStatus)
                                    .filter(([_, isAuth]) => isAuth)
                                    .map(([type, _]) => (
                                        <span key={type} style={{
                                            padding: '4px 10px',
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            color: 'var(--success)',
                                            borderRadius: '12px',
                                            fontSize: '0.85rem',
                                            fontWeight: '600'
                                        }}>
                                            {credentialTypes[type]}
                                        </span>
                                    ))
                                }
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                        }}>
                            <p style={{
                                fontSize: '0.9rem',
                                color: 'var(--error)',
                                margin: 0
                            }}>
                                ❌ You are not currently authorized to issue any credential types. Contact the contract owner for authorization.
                            </p>
                        </div>
                    )}

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
                        options={credentialTypes.map((t, i) => {
                            const isAuth = issuerAuthStatus[i];
                            return {
                                value: i.toString(),
                                label: `${t}${isAuth ? ' ✅' : ' 🔒'}`,
                                disabled: !isAuth
                            };
                        })}
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
                            options={skillCategories.map((c, i) => {
                                const catInfo = getSkillCategoryInfo(i);
                                return {
                                    value: i.toString(),
                                    label: `${catInfo.icon} ${c}`
                                };
                            })}
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
                            disabled={loading || !issuerAuthStatus[parseInt(issueData.credType)]}
                        >
                            {loading ? 'Issuing...' : '✅ Issue Credential'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
