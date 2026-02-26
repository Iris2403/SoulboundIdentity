AnalyticsTab = function ({ contracts, selectedToken, showNotification }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!selectedToken || !contracts) return;
        loadAnalytics();
    }, [selectedToken, contracts]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            // selectedToken is already the ID number
            const tokenId = selectedToken;

            const credSummary = await contracts.credentials.getCredentialSummary(tokenId);
            const repSummary = await contracts.social.getReputationSummary(tokenId);
            const endorsements = await contracts.social.getEndorsements(tokenId);
            const projects = await contracts.social.getProjects(tokenId);

            setStats({
                credentials: {
                    degrees: credSummary.degrees.toNumber(),
                    certifications: credSummary.certifications.toNumber(),
                    workExperience: credSummary.workExperience.toNumber(),
                    identityProofs: credSummary.identityProofs.toNumber(),
                    skills: credSummary.skills.toNumber(),
                    total: credSummary.degrees.add(credSummary.certifications)
                        .add(credSummary.workExperience)
                        .add(credSummary.identityProofs)
                        .add(credSummary.skills).toNumber()
                },
                reputation: {
                    average: repSummary.averageScore.toNumber(),
                    total: repSummary.totalReviews.toNumber(),
                    verified: repSummary.verifiedReviews.toNumber()
                },
                social: {
                    endorsements: endorsements.length,
                    projects: projects.length,
                    completedProjects: projects.filter(p => p.status === 2).length,
                    activeProjects: projects.filter(p => p.status === 1).length
                }
            });
        } catch (error) {
            console.error('Error loading analytics:', error);
            showNotification('Failed to load analytics', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!selectedToken) {
        return (
            <Card>
                <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <h3>No Token Selected</h3>
                    <p>Select a token to view analytics</p>
                </div>
            </Card>
        );
    }

    if (loading) {
        return <Card><LoadingSpinner /></Card>;
    }

    if (!stats) {
        return <Card><div className="empty-message">Failed to load analytics</div></Card>;
    }

    return (
        <div className="analytics-container">
            <h2 style={{ marginBottom: '24px', color: 'var(--beige, #e8dfca)' }}>Analytics Dashboard</h2>

            <div className="analytics-dashboard" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                <Card className="stat-card" style={{ padding: '24px' }}>
                    <div className="stat-card-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <span className="stat-icon" style={{ fontSize: '2rem' }}>📜</span>
                        <h3 style={{ margin: 0 }}>Credentials</h3>
                    </div>
                    <div className="big-number" style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--teal-light, #06b6d4)', marginBottom: '8px' }}>
                        {stats.credentials.total}
                    </div>
                    <div className="stat-label" style={{ color: 'var(--gray, #6b7589)', marginBottom: '16px' }}>Total Credentials</div>
                    <div className="stat-breakdown" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-color, rgba(168, 178, 193, 0.1))' }}>
                        <div className="breakdown-item">
                            <span>🎓 Degrees: {stats.credentials.degrees}</span>
                        </div>
                        <div className="breakdown-item">
                            <span>📋 Certifications: {stats.credentials.certifications}</span>
                        </div>
                        <div className="breakdown-item">
                            <span>💼 Work Experience: {stats.credentials.workExperience}</span>
                        </div>
                        <div className="breakdown-item">
                            <span>⚡ Skills: {stats.credentials.skills}</span>
                        </div>
                    </div>
                </Card>

                <Card className="stat-card" style={{ padding: '24px' }}>
                    <div className="stat-card-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <span className="stat-icon" style={{ fontSize: '2rem' }}>⭐</span>
                        <h3 style={{ margin: 0 }}>Reputation</h3>
                    </div>
                    <div className="big-number" style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--teal-light, #06b6d4)', marginBottom: '8px' }}>
                        {stats.reputation.average}
                        <span style={{ fontSize: '1.5rem', color: 'var(--gray, #6b7589)' }}>/100</span>
                    </div>
                    <div className="stat-label" style={{ color: 'var(--gray, #6b7589)', marginBottom: '16px' }}>Average Score</div>
                    <div className="stat-breakdown" style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-color, rgba(168, 178, 193, 0.1))' }}>
                        <div className="breakdown-item">
                            <span>Total Reviews: {stats.reputation.total}</span>
                        </div>
                        <div className="breakdown-item">
                            <span>✓ Verified: {stats.reputation.verified}</span>
                        </div>
                        <div className="breakdown-item">
                            <span>
                                Verification Rate: {stats.reputation.total > 0
                                    ? Math.round((stats.reputation.verified / stats.reputation.total) * 100)
                                    : 0}%
                            </span>
                        </div>
                    </div>
                </Card>

                <Card className="stat-card" style={{ padding: '24px' }}>
                    <div className="stat-card-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <span className="stat-icon" style={{ fontSize: '2rem' }}>🤝</span>
                        <h3 style={{ margin: 0 }}>Social</h3>
                    </div>
                    <div className="stat-breakdown" style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '16px' }}>
                        <div className="breakdown-item" style={{ fontSize: '1.1rem' }}>
                            <span>👍 Endorsements: <strong>{stats.social.endorsements}</strong></span>
                        </div>
                        <div className="breakdown-item" style={{ fontSize: '1.1rem' }}>
                            <span>🚀 Total Projects: <strong>{stats.social.projects}</strong></span>
                        </div>
                        <div className="breakdown-item" style={{ fontSize: '1.1rem' }}>
                            <span>✅ Completed: <strong>{stats.social.completedProjects}</strong></span>
                        </div>
                        <div className="breakdown-item" style={{ fontSize: '1.1rem' }}>
                            <span>⚡ Active: <strong>{stats.social.activeProjects}</strong></span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}

// ============================================
