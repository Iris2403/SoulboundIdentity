CredentialsTab = function ({ contracts, selectedToken, userTokens, showNotification, account }) {
    // State management
    const [credentials, setCredentials] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedType, setSelectedType] = useState(0);
    const [showActiveOnly, setShowActiveOnly] = useState(false);
    const [credentialCounts, setCredentialCounts] = useState({});
    const [validationStatus, setValidationStatus] = useState({});
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState(null);
    const [validatingIds, setValidatingIds] = useState({});
    const [showValidateModal, setShowValidateModal] = useState(false);
    const [degreeGPAs, setDegreeGPAs] = useState({});

    const getValidatedKey = () => `sbi_validated_${selectedToken}`;
    const loadValidatedFromStorage = () => {
        try { return new Set(JSON.parse(localStorage.getItem(getValidatedKey()) || '[]')); }
        catch { return new Set(); }
    };

    const [credentialData, setCredentialData] = useState({
        credType: '0',
        institution: '',
        title: '',
        description: '',
        issueDate: '',
        expiryDate: '',
        // Degree-specific
        gpa: '',
        degreeCategory: '0',
        // Certification-specific
        certDomain: '0',
        // Skill-specific
        skillCategory: '0'
    });

    // Constants
    const MAX_CREDENTIALS_PER_TYPE = 100;
    const WARNING_THRESHOLD = 0.9;

    // Visual metadata for degree categories (matches DegreeCategory enum order)
    const degreeCategoryInfo = [
        { icon: '🎭', color: '#a78bfa' }, // Arts & Humanities
        { icon: '💼', color: '#60a5fa' }, // Business & Economics
        { icon: '⚖️', color: '#e879f9' }, // Law & Social Sciences
        { icon: '📚', color: '#34d399' }, // Education & Development
        { icon: '🏥', color: '#4ade80' }, // Health & Life Sciences
        { icon: '🔬', color: '#38bdf8' }, // Science & Technology
    ];

    // Visual metadata for certification domains (matches CertificationDomain enum order)
    const certDomainInfo = [
        { icon: '💻', color: '#667eea' }, // IT & Software Dev
        { icon: '💼', color: '#60a5fa' }, // Business & Management
        { icon: '🏥', color: '#4ade80' }, // Health & Medicine
        { icon: '📊', color: '#fbbf24' }, // Data & AI Analytics
        { icon: '📢', color: '#f472b6' }, // Communication & Marketing
    ];

    useEffect(() => {
        if (selectedToken && contracts) {
            loadCredentials();
            loadSummary();
            loadCredentialCounts();
        }
    }, [selectedToken, contracts, selectedType, showActiveOnly, selectedCategoryFilter]);

    // Returns form field configuration based on credential type
    const getFormConfig = (credType) => {
        switch (parseInt(credType)) {
            case 0: return {
                institutionLabel: 'University / Institution',
                institutionPlaceholder: 'e.g., MIT, Harvard University',
                institutionRequired: true,
                titleLabel: 'Degree Title',
                titlePlaceholder: 'e.g., Bachelor of Computer Science',
                issueDateLabel: 'Graduation Date',
                showExpiry: false,
                showGPA: true,
                showDegreeCategory: true,
            };
            case 1: return {
                institutionLabel: 'Issuing Organization',
                institutionPlaceholder: 'e.g., AWS, Google, Coursera',
                institutionRequired: true,
                titleLabel: 'Certification Name',
                titlePlaceholder: 'e.g., AWS Solutions Architect',
                issueDateLabel: 'Issue Date',
                showExpiry: true,
                showCertDomain: true,
            };
            case 2: return {
                institutionLabel: 'Company / Organization',
                institutionPlaceholder: 'e.g., Google, Startup Inc.',
                institutionRequired: true,
                titleLabel: 'Job Title / Role',
                titlePlaceholder: 'e.g., Software Engineer',
                issueDateLabel: 'Start Date',
                expiryDateLabel: 'End Date (leave blank if currently employed)',
                showExpiry: true,
            };
            case 3: return {
                institutionLabel: 'Issuing Authority',
                institutionPlaceholder: 'e.g., Government, Notary Office',
                institutionRequired: true,
                titleLabel: 'Document Type',
                titlePlaceholder: "e.g., Passport, Driver's License",
                issueDateLabel: 'Issue Date',
                showExpiry: true,
            };
            case 4: return {
                institutionLabel: 'Source / Platform (optional)',
                institutionPlaceholder: 'e.g., Udemy, Self-taught, University',
                institutionRequired: false,
                titleLabel: 'Skill Name',
                titlePlaceholder: 'e.g., Python, Machine Learning',
                issueDateLabel: 'Date Acquired (optional)',
                showExpiry: false,
                showSkillCategory: true,
            };
            default: return {
                institutionLabel: 'Institution',
                institutionRequired: true,
                titleLabel: 'Title',
                issueDateLabel: 'Issue Date',
                showExpiry: true,
            };
        }
    };

    const getCredentialStatusInfo = (status) => {
        const statusMap = {
            0: { label: 'Active', color: 'var(--success)', icon: '🟢', bg: 'rgba(16, 185, 129, 0.1)' },
            1: { label: 'Revoked', color: 'var(--error)', icon: '🔴', bg: 'rgba(239, 68, 68, 0.1)' },
            2: { label: 'Expired', color: 'var(--text-muted)', icon: '⚫', bg: 'rgba(107, 117, 137, 0.1)' }
        };
        return statusMap[status] || statusMap[0];
    };

    // Skill category info for CredentialsHub SkillCategory enum
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

    // Returns badge display info (label, icon, color) for a credential's category field
    const getCategoryDisplay = (credType, category) => {
        switch (credType) {
            case 0: {
                const info = degreeCategoryInfo[category] || { icon: '🎓', color: '#667eea' };
                return { label: degreeCategories[category] || 'Unknown', icon: info.icon, color: info.color };
            }
            case 1: {
                const info = certDomainInfo[category] || { icon: '📜', color: '#4facfe' };
                return { label: certificationDomains[category] || 'Unknown', icon: info.icon, color: info.color };
            }
            case 4:
                return getSkillCategoryInfo(category);
            default:
                return null;
        }
    };

    // Returns the list of filter buttons for types that have categories (0, 1, 4)
    const getCategoryFilterOptions = (type) => {
        switch (type) {
            case 0:
                return degreeCategories.map((cat, idx) => ({
                    label: cat,
                    icon: degreeCategoryInfo[idx]?.icon || '🎓',
                    color: degreeCategoryInfo[idx]?.color || '#667eea'
                }));
            case 1:
                return certificationDomains.map((cat, idx) => ({
                    label: cat,
                    icon: certDomainInfo[idx]?.icon || '📜',
                    color: certDomainInfo[idx]?.color || '#4facfe'
                }));
            case 4:
                return skillCategories.map((cat, idx) => {
                    const info = getSkillCategoryInfo(idx);
                    return { label: cat, icon: info.icon, color: info.color };
                });
            default:
                return [];
        }
    };

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

    const isApproachingLimit = (type) => {
        const count = credentialCounts[type] || 0;
        return count >= MAX_CREDENTIALS_PER_TYPE * WARNING_THRESHOLD;
    };

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

            // Apply category filter for types that support it (Degree, Certification, Skill)
            if ([0, 1, 4].includes(selectedType) && selectedCategoryFilter !== null) {
                creds = creds.filter(c => Number(c.category) === selectedCategoryFilter);
            }

            // Fetch GPA for degree credentials in parallel
            if (selectedType === 0 && creds.length > 0) {
                const gpas = {};
                await Promise.all(creds.map(async (cred) => {
                    try {
                        const gpa = await contracts.credentials.degreeGPA(cred.credentialId);
                        const gpaNum = gpa.toNumber ? gpa.toNumber() : Number(gpa);
                        if (gpaNum > 0) {
                            gpas[cred.credentialId.toString()] = (gpaNum / 100).toFixed(2);
                        }
                    } catch (e) {}
                }));
                setDegreeGPAs(gpas);
            } else {
                setDegreeGPAs({});
            }

            // Credentials start invalid until explicitly validated by the user
            const validated = loadValidatedFromStorage();
            const validationStatuses = {};
            for (const cred of creds) {
                validationStatuses[cred.credentialId.toString()] = validated.has(cred.credentialId.toString());
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

    const handleValidateCredential = async (credentialId) => {
        const idKey = credentialId.toString();
        try {
            setValidatingIds(prev => ({ ...prev, [idKey]: true }));
            const tx = await contracts.credentials.updateCredentialStatus(selectedToken, credentialId);
            showNotification('Validating credential on network...', 'info');
            await tx.wait();
            showNotification('✅ Credential validated successfully!', 'success');
            const validated = loadValidatedFromStorage();
            validated.add(idKey);
            localStorage.setItem(getValidatedKey(), JSON.stringify([...validated]));
            setValidationStatus(prev => ({ ...prev, [idKey]: true }));
        } catch (error) {
            console.error('Error validating credential:', error);
            showNotification(error.message || 'Failed to validate credential', 'error');
        } finally {
            setValidatingIds(prev => ({ ...prev, [idKey]: false }));
        }
    };

    const handleAddCredential = async () => {
        const credType = parseInt(credentialData.credType);
        const formConfig = getFormConfig(credType);
        try {
            // Validate required fields based on type
            if (formConfig.institutionRequired && !credentialData.institution.trim()) {
                showNotification(`Please fill in the ${formConfig.institutionLabel.replace(' (optional)', '')} field`, 'error');
                return;
            }
            if (!credentialData.title.trim()) {
                showNotification(`Please fill in the ${formConfig.titleLabel} field`, 'error');
                return;
            }

            const isOwnToken = userTokens.some(t => t.id === selectedToken);
            if (!isOwnToken) {
                showNotification('You do not own this identity token. Please select your token from the Identity tab.', 'error');
                return;
            }

            const currentCount = credentialCounts[credType] || 0;
            if (currentCount >= MAX_CREDENTIALS_PER_TYPE) {
                showNotification(`❌ Maximum limit reached (${MAX_CREDENTIALS_PER_TYPE} ${credentialTypes[credType]} credentials)`, 'error');
                return;
            }

            setLoading(true);

            const metadataHash = ethers.utils.id(JSON.stringify({
                institution: credentialData.institution,
                title: credentialData.title,
                description: credentialData.description,
                issuedBy: 'Self-Reported'
            }));

            const issueDateMs = credentialData.issueDate ? new Date(credentialData.issueDate).getTime() : Date.now();
            const issueDate = isNaN(issueDateMs) || issueDateMs <= 0
                ? Math.floor(Date.now() / 1000)
                : Math.floor(issueDateMs / 1000);
            const expiryDateMs = credentialData.expiryDate ? new Date(credentialData.expiryDate).getTime() : 0;
            const expiryDate = (expiryDateMs && !isNaN(expiryDateMs) && expiryDateMs > 0)
                ? Math.floor(expiryDateMs / 1000)
                : 0;

            if (expiryDate !== 0 && expiryDate <= issueDate) {
                showNotification('End/expiry date must be after issue/start date!', 'error');
                setLoading(false);
                return;
            }

            let tx;
            if (credType === 0) {
                // Degree — dedicated function with GPA and degree category
                const gpaValue = credentialData.gpa && credentialData.gpa.trim()
                    ? Math.round(parseFloat(credentialData.gpa) * 100)
                    : 0;
                tx = await contracts.credentials.addDegreeCredential(
                    selectedToken,
                    metadataHash,
                    issueDate,
                    0,                                    // degrees don't expire
                    gpaValue,
                    parseInt(credentialData.degreeCategory)
                );
            } else if (credType === 1) {
                // Certification — dedicated function with domain
                tx = await contracts.credentials.addCertificationCredential(
                    selectedToken,
                    metadataHash,
                    issueDate,
                    expiryDate,
                    parseInt(credentialData.certDomain)
                );
            } else {
                // Work Experience (2), Identity Proof (3), Skill (4) — generic function
                const category = credType === 4 ? parseInt(credentialData.skillCategory) : 0;
                tx = await contracts.credentials.addCredential(
                    selectedToken,
                    credType,
                    metadataHash,
                    issueDate,
                    expiryDate,
                    category
                );
            }

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
                gpa: '',
                degreeCategory: '0',
                certDomain: '0',
                skillCategory: '0'
            });

            loadCredentials();
            loadSummary();
            loadCredentialCounts();
        } catch (error) {
            console.error('❌ Error adding credential:', error);
            const errName = error.errorName || error.data?.errorName || '';
            const errMsg = error.message || '';

            let message;
            if (error.code === 'ACTION_REJECTED' || errMsg.includes('user rejected')) {
                message = 'Transaction was rejected by wallet';
            } else if (errName === 'InvalidParameter' || errMsg.includes('InvalidParameter')) {
                message = 'Invalid parameters: please check all fields are filled correctly';
            } else if (errName === 'TooManyCredentials' || errMsg.includes('TooManyCredentials')) {
                message = `❌ Maximum limit reached (${MAX_CREDENTIALS_PER_TYPE} credentials per type)`;
            } else if (errName === 'InvalidDates' || errMsg.includes('InvalidDates')) {
                message = 'Invalid dates: end/expiry date must be after start/issue date';
            } else if (errName === 'NotTokenOwner' || errMsg.includes('NotTokenOwner')) {
                message = 'You do not own this identity token';
            } else {
                message = errMsg || 'Failed to add credential';
            }
            showNotification(message, 'error');
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

    const categoryFilterOptions = getCategoryFilterOptions(selectedType);
    const showCategoryFilter = categoryFilterOptions.length > 0;
    const formConfig = getFormConfig(credentialData.credType);

    return (
        <div className="credentials-tab">
            {/* Header */}
            <div className="tab-header">
                <div>
                    <h2>Credentials</h2>
                    <p className="tab-description">Manage your professional credentials and achievements</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <Button onClick={() => setShowAddModal(true)} variant="secondary">
                        ➕ Add Credential
                    </Button>
                    {(() => {
                        const invalidCount = Object.values(validationStatus).filter(v => v === false).length;
                        return invalidCount > 0 ? (
                            <Button
                                onClick={() => setShowValidateModal(true)}
                                variant="secondary"
                                style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--error)', color: 'var(--error)' }}
                            >
                                🔍 Validate Credentials ({invalidCount})
                            </Button>
                        ) : null;
                    })()}
                </div>
            </div>

            {/* Summary dashboard — clicking a tile switches the active type */}
            {summary && (
                <Card style={{ marginBottom: '24px', marginTop: '32px' }}>
                    <h3 style={{ marginBottom: '16px', color: 'var(--teal-light)' }}>📊 Credential Summary</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
                        {[
                            { key: 'degrees',        icon: '🎓', type: 0, color: 'rgba(102, 126, 234, 0.1)' },
                            { key: 'certifications', icon: '📜', type: 1, color: 'rgba(14, 165, 233, 0.1)'  },
                            { key: 'workExperience', icon: '💼', type: 2, color: 'rgba(6, 182, 212, 0.1)'   },
                            { key: 'identityProofs', icon: '🆔', type: 3, color: 'rgba(240, 147, 251, 0.1)' },
                            { key: 'skills',         icon: '⚡', type: 4, color: 'rgba(42, 245, 152, 0.1)'  }
                        ].map(({ key, icon, type, color }) => {
                            const count = summary[key];
                            const isNearLimit = count >= MAX_CREDENTIALS_PER_TYPE * WARNING_THRESHOLD;
                            return (
                                <div
                                    key={key}
                                    onClick={() => { setSelectedType(type); setSelectedCategoryFilter(null); }}
                                    style={{
                                        textAlign: 'center', padding: '16px', background: color,
                                        borderRadius: '12px', position: 'relative', cursor: 'pointer',
                                        border: selectedType === type
                                            ? '2px solid var(--teal)'
                                            : isNearLimit ? '2px solid var(--warning)' : '2px solid transparent'
                                    }}
                                >
                                    {isNearLimit && (
                                        <div style={{ position: 'absolute', top: '8px', right: '8px', width: '8px', height: '8px', background: 'var(--warning)', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                                    )}
                                    <div style={{ fontSize: '2rem' }}>{icon}</div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: isNearLimit ? 'var(--warning)' : 'var(--teal-light)' }}>
                                        {count}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{credentialTypes[type]}</div>
                                    {isNearLimit && <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '4px', fontWeight: '600' }}>⚠️ Near Limit</div>}
                                </div>
                            );
                        })}
                    </div>
                </Card>
            )}

            {/* Filters + list */}
            <Card>
                {/* Row 1: type pills + active toggle */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                        {credentialTypes.map((type, idx) => {
                            const count = credentialCounts[idx] || 0;
                            const isNearLimit = count >= MAX_CREDENTIALS_PER_TYPE * WARNING_THRESHOLD;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => { setSelectedType(idx); setSelectedCategoryFilter(null); }}
                                    style={{
                                        position: 'relative', padding: '8px 16px', borderRadius: '20px',
                                        cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.3s',
                                        fontWeight: selectedType === idx ? '600' : '400',
                                        border: selectedType === idx
                                            ? (isNearLimit ? '2px solid var(--warning)' : '2px solid var(--teal)')
                                            : '1px solid var(--border-color)',
                                        background: selectedType === idx ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                                        color: selectedType === idx ? 'var(--teal-light)' : 'var(--text-secondary)'
                                    }}
                                >
                                    {type}
                                    <span style={{
                                        marginLeft: '6px', padding: '2px 8px', borderRadius: '10px',
                                        fontSize: '0.75rem', fontWeight: 'bold',
                                        background: selectedType === idx ? (isNearLimit ? 'var(--warning)' : 'rgba(255,255,255,0.3)') : 'var(--teal)',
                                        color: selectedType === idx ? (isNearLimit ? 'white' : 'var(--teal-light)') : 'white'
                                    }}>
                                        {count}
                                    </span>
                                    {isNearLimit && <span style={{ position: 'absolute', top: '-4px', right: '-4px', fontSize: '0.7rem' }}>⚠️</span>}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-tertiary)', padding: '8px 16px', borderRadius: '24px' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Show:</span>
                        {[['All', false], ['🟢 Active Only', true]].map(([label, val]) => (
                            <button
                                key={label}
                                onClick={() => setShowActiveOnly(val)}
                                style={{
                                    background: showActiveOnly === val ? 'var(--gradient-teal)' : 'transparent',
                                    border: 'none', borderRadius: '16px', cursor: 'pointer',
                                    padding: '6px 16px', fontSize: '0.85rem', fontWeight: '600', transition: 'all 0.3s',
                                    color: showActiveOnly === val ? 'white' : 'var(--text-secondary)'
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Row 2: category filter — visible for Degree (0), Certification (1), Skill (4) */}
                {showCategoryFilter && (
                    <div style={{ marginBottom: '20px', paddingTop: '16px', borderTop: '1px solid rgba(6, 182, 212, 0.2)' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: '600' }}>
                            Filter by {selectedType === 0 ? 'Degree Category' : selectedType === 1 ? 'Domain' : 'Skill Category'}:
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => setSelectedCategoryFilter(null)}
                                style={{
                                    padding: '6px 14px', borderRadius: '16px', cursor: 'pointer',
                                    fontSize: '0.85rem', transition: 'all 0.3s',
                                    fontWeight: selectedCategoryFilter === null ? '600' : '400',
                                    border: selectedCategoryFilter === null ? '2px solid var(--teal)' : '1px solid var(--border-color)',
                                    background: selectedCategoryFilter === null ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                                    color: selectedCategoryFilter === null ? 'var(--teal-light)' : 'var(--text-secondary)'
                                }}
                            >
                                All
                            </button>
                            {categoryFilterOptions.map((cat, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedCategoryFilter(idx)}
                                    style={{
                                        padding: '6px 14px', borderRadius: '16px', cursor: 'pointer',
                                        fontSize: '0.85rem', transition: 'all 0.3s',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        fontWeight: selectedCategoryFilter === idx ? '600' : '400',
                                        border: selectedCategoryFilter === idx ? `2px solid ${cat.color}` : '1px solid var(--border-color)',
                                        background: selectedCategoryFilter === idx ? `${cat.color}15` : 'transparent',
                                        color: selectedCategoryFilter === idx ? cat.color : 'var(--text-secondary)'
                                    }}
                                >
                                    <span>{cat.icon}</span>{cat.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Limit warning */}
                {isApproachingLimit(selectedType) && (
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', color: 'var(--warning)' }}>Approaching Credential Limit</div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                You have {credentialCounts[selectedType] || 0}/{MAX_CREDENTIALS_PER_TYPE} {credentialTypes[selectedType]} credentials.
                            </div>
                        </div>
                    </div>
                )}

                {/* Credential cards */}
                {loading ? (
                    <LoadingSpinner />
                ) : credentials.length === 0 ? (
                    <div className="empty-message" style={{ textAlign: 'center', padding: '40px' }}>
                        <p>
                            No {showActiveOnly ? 'active ' : ''}
                            {selectedCategoryFilter !== null && categoryFilterOptions[selectedCategoryFilter]
                                ? `${categoryFilterOptions[selectedCategoryFilter].label} ` : ''}
                            {credentialTypes[selectedType].toLowerCase()} credentials yet
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {credentials.map((cred, idx) => {
                            const statusInfo  = getCredentialStatusInfo(cred.status);
                            const isValid     = validationStatus[cred.credentialId.toString()];
                            const isExpired   = cred.expiryDate > 0 && Math.floor(Date.now() / 1000) >= cred.expiryDate.toNumber();
                            const isValidating = validatingIds[cred.credentialId.toString()];
                            const catDisplay  = getCategoryDisplay(cred.credType, cred.category);
                            const gpa         = degreeGPAs[cred.credentialId.toString()];

                            return (
                                <div key={idx} style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px', borderLeft: `4px solid ${statusInfo.color}` }}>

                                    {/* Card header: type label + badges */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--teal-light)', marginBottom: '8px' }}>
                                                {credentialTypes[cred.credType]}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                ID: {cred.credentialId.toString()}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                            {/* Verified / Self-Reported */}
                                            <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600', background: cred.verified ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.15)', color: cred.verified ? 'var(--success)' : '#3b82f6' }}>
                                                {cred.verified ? '✅ Verified' : '⚠️ Self-Reported'}
                                            </span>

                                            {/* Status */}
                                            <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600', background: statusInfo.bg, color: statusInfo.color }}>
                                                {statusInfo.icon} {statusInfo.label}
                                            </span>

                                            {/* Validation */}
                                            {isValid !== undefined && (
                                                <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600', background: isValid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: isValid ? 'var(--success)' : 'var(--error)' }}>
                                                    {isValid ? '✓ Valid' : '✗ Invalid'}
                                                </span>
                                            )}

                                            {/* Category badge — Degree, Certification, Skill only */}
                                            {catDisplay && (
                                                <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '600', background: `${catDisplay.color}20`, color: catDisplay.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {catDisplay.icon} {catDisplay.label}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Details grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(6, 182, 212, 0.2)' }}>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Issuer</div>
                                            <code style={{ fontSize: '0.85rem', color: 'var(--teal-light)' }}>{shortenAddress(cred.issuer)}</code>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                {cred.credType === 2 ? 'Start Date' : 'Issue Date'}
                                            </div>
                                            <div style={{ fontSize: '0.9rem' }}>{formatDate(cred.issueDate)}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                {cred.credType === 2 ? 'End Date' : 'Expiry'}
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: isExpired ? 'var(--error)' : 'inherit' }}>
                                                {cred.expiryDate.toNumber() === 0
                                                    ? (cred.credType === 2 ? '📌 Currently Employed' : 'Never')
                                                    : formatDate(cred.expiryDate)}
                                            </div>
                                        </div>
                                        {/* GPA — degrees only, shown when non-zero */}
                                        {gpa && (
                                            <div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>GPA</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--teal-light)' }}>{gpa}</div>
                                            </div>
                                        )}
                                        <div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Metadata Hash</div>
                                            <code style={{ fontSize: '0.75rem', color: 'var(--teal-light)', wordBreak: 'break-all' }}>
                                                {cred.metadataHash.slice(0, 20)}...
                                            </code>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                                        {!isValid && cred.status === 0 && (
                                            <Button
                                                onClick={() => handleValidateCredential(cred.credentialId)}
                                                disabled={isValidating}
                                                style={{ fontSize: '0.85rem', padding: '6px 12px', background: 'linear-gradient(135deg, #667eea, #4facfe)', border: 'none', color: 'white', opacity: isValidating ? 0.7 : 1 }}
                                            >
                                                {isValidating ? '⏳ Validating...' : '🔍 Validate'}
                                            </Button>
                                        )}
                                        {isExpired && cred.status === 0 && (
                                            <Button variant="secondary" onClick={() => handleUpdateStatus(cred.credentialId)} style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                                                🔄 Update to Expired
                                            </Button>
                                        )}
                                        {cred.status === 0 && (
                                            <Button variant="danger" onClick={() => handleRevoke(cred.credentialId)} style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
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

            {/* Validate Credentials Modal */}
            <Modal
                isOpen={showValidateModal}
                onClose={() => setShowValidateModal(false)}
                title="🔍 Validate Credentials"
            >
                <div>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '0.95rem' }}>
                        Newly added credentials start as invalid. Select one below to validate it on-chain.
                    </p>
                    {credentials.filter(c => validationStatus[c.credentialId.toString()] === false).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                            <p>No invalid credentials in the current view.</p>
                            <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>Switch credential type using the filters to find others.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {credentials.filter(c => validationStatus[c.credentialId.toString()] === false).map((cred, idx) => (
                                <div key={idx} style={{
                                    background: 'var(--bg-tertiary)',
                                    padding: '16px',
                                    borderRadius: '10px',
                                    borderLeft: '4px solid var(--error)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: '600', color: 'var(--teal-light)', marginBottom: '4px' }}>
                                            {credentialTypes[cred.credType]}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                            ID: {cred.credentialId.toString()} &bull; {cred.verified ? '✅ Verified' : '⚠️ Self-Reported'}
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => handleValidateCredential(cred.credentialId)}
                                        disabled={validatingIds[cred.credentialId.toString()]}
                                        style={{ fontSize: '0.85rem', padding: '8px 16px', minWidth: '110px' }}
                                    >
                                        {validatingIds[cred.credentialId.toString()] ? '⏳ Validating...' : '🔍 Validate'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                        <Button variant="secondary" onClick={() => setShowValidateModal(false)}>
                            Close
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Add Credential Modal */}
            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="➕ Add Credential"
            >
                <div>
                    {/* Invalid-by-default notice */}
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--warning)', margin: 0 }}>
                            ⚠️ Newly added credentials are <strong>invalid by default</strong> and must be validated through the network before they are recognised. Use the <strong>Validate</strong> button on each credential card after adding.
                        </p>
                    </div>

                    {/* Approaching-limit warning */}
                    {isApproachingLimit(parseInt(credentialData.credType)) && (
                        <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--warning)', margin: 0 }}>
                                ⚠️ {credentialCounts[parseInt(credentialData.credType)] || 0}/{MAX_CREDENTIALS_PER_TYPE} {credentialTypes[parseInt(credentialData.credType)]} credentials — approaching limit!
                            </p>
                        </div>
                    )}

                    {/* Type selector — resets all fields on change */}
                    <Select
                        label="Credential Type"
                        value={credentialData.credType}
                        onChange={(val) => setCredentialData({
                            credType: val,
                            institution: '', title: '', description: '',
                            issueDate: '', expiryDate: '',
                            gpa: '', degreeCategory: '0', certDomain: '0', skillCategory: '0'
                        })}
                        options={credentialTypes.map((t, i) => ({
                            value: i.toString(),
                            label: `${t} (${credentialCounts[i] || 0}/${MAX_CREDENTIALS_PER_TYPE})`
                        }))}
                    />

                    {/* Institution — label and placeholder driven by type */}
                    <Input
                        label={formConfig.institutionLabel}
                        value={credentialData.institution}
                        onChange={(val) => setCredentialData({ ...credentialData, institution: val })}
                        placeholder={formConfig.institutionPlaceholder}
                    />

                    {/* Title — label and placeholder driven by type */}
                    <Input
                        label={formConfig.titleLabel}
                        value={credentialData.title}
                        onChange={(val) => setCredentialData({ ...credentialData, title: val })}
                        placeholder={formConfig.titlePlaceholder}
                    />

                    <TextArea
                        label="Description (optional)"
                        value={credentialData.description}
                        onChange={(val) => setCredentialData({ ...credentialData, description: val })}
                        placeholder="Brief description..."
                    />

                    {/* Issue / Start date — label driven by type */}
                    <Input
                        label={formConfig.issueDateLabel}
                        type="date"
                        value={credentialData.issueDate}
                        onChange={(val) => setCredentialData({ ...credentialData, issueDate: val })}
                    />

                    {/* Expiry / End date — hidden for Degree and Skill */}
                    {formConfig.showExpiry && (
                        <Input
                            label={formConfig.expiryDateLabel || 'Expiry Date (optional)'}
                            type="date"
                            value={credentialData.expiryDate}
                            onChange={(val) => setCredentialData({ ...credentialData, expiryDate: val })}
                        />
                    )}

                    {/* GPA — Degree only */}
                    {formConfig.showGPA && (
                        <Input
                            label="GPA (optional, e.g. 3.75)"
                            value={credentialData.gpa}
                            onChange={(val) => setCredentialData({ ...credentialData, gpa: val })}
                            placeholder="e.g., 3.75"
                        />
                    )}

                    {/* Degree Category — Degree only */}
                    {formConfig.showDegreeCategory && (
                        <Select
                            label="Degree Category"
                            value={credentialData.degreeCategory}
                            onChange={(val) => setCredentialData({ ...credentialData, degreeCategory: val })}
                            options={degreeCategories.map((c, i) => ({
                                value: i.toString(),
                                label: `${degreeCategoryInfo[i]?.icon || '🎓'} ${c}`
                            }))}
                        />
                    )}

                    {/* Certification Domain — Certification only */}
                    {formConfig.showCertDomain && (
                        <Select
                            label="Certification Domain"
                            value={credentialData.certDomain}
                            onChange={(val) => setCredentialData({ ...credentialData, certDomain: val })}
                            options={certificationDomains.map((c, i) => ({
                                value: i.toString(),
                                label: `${certDomainInfo[i]?.icon || '📜'} ${c}`
                            }))}
                        />
                    )}

                    {/* Skill Category — Skill only */}
                    {formConfig.showSkillCategory && (
                        <Select
                            label="Skill Category"
                            value={credentialData.skillCategory}
                            onChange={(val) => setCredentialData({ ...credentialData, skillCategory: val })}
                            options={skillCategories.map((c, i) => {
                                const info = getSkillCategoryInfo(i);
                                return { value: i.toString(), label: `${info.icon} ${c}` };
                            })}
                        />
                    )}

                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                        <Button variant="secondary" onClick={() => setShowAddModal(false)} disabled={loading}>
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
        </div>
    );
};
