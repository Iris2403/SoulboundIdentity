AccessControlTab = function ({ contracts, selectedToken, userTokens, showNotification }) {
    const [pendingRequests, setPendingRequests] = useState([]);
    const [grantedAccess, setGrantedAccess] = useState([]);
    const [tokensICanAccess, setTokensICanAccess] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestTokenId, setRequestTokenId] = useState('');
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewingToken, setViewingToken] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [approvingRequester, setApprovingRequester] = useState(null);
    const [selectedCredTypes, setSelectedCredTypes] = useState({0: true, 1: true, 2: true, 3: true, 4: true});
    const [selectedSocialSections, setSelectedSocialSections] = useState({0: true, 1: true, 2: true});
    const [selectedRequests, setSelectedRequests] = useState(new Set());
    const [showBatchApproveModal, setShowBatchApproveModal] = useState(false);
    const [repThreshold, setRepThreshold] = useState('50');
    const [repZkpStatus, setRepZkpStatus] = useState('idle');
    const [repZkpMessage, setRepZkpMessage] = useState('');
    const [gpaThreshold, setGpaThreshold] = useState('300');
    const [gpaZkpStatus, setGpaZkpStatus] = useState('idle');
    const [gpaZkpMessage, setGpaZkpMessage] = useState('');
    const [degreeCatThreshold, setDegreeCatThreshold] = useState('5');
    const [degreeCatZkpStatus, setDegreeCatZkpStatus] = useState('idle');
    const [degreeCatZkpMessage, setDegreeCatZkpMessage] = useState('');
    const [certDomainThreshold, setCertDomainThreshold] = useState('0');
    const [certDomainZkpStatus, setCertDomainZkpStatus] = useState('idle');
    const [certDomainZkpMessage, setCertDomainZkpMessage] = useState('');
    const [workExpThreshold, setWorkExpThreshold] = useState('3');
    const [workExpZkpStatus, setWorkExpZkpStatus] = useState('idle');
    const [workExpZkpMessage, setWorkExpZkpMessage] = useState('');

    const handleVerifyReputation = async (tokenId, score) => {
        if (!window.snarkjs) { showNotification('snarkjs not loaded', 'error'); return; }
        const threshold = parseInt(repThreshold);
        if (isNaN(threshold) || threshold < 0) { showNotification('Enter a valid threshold', 'error'); return; }
        if (score <= threshold) {
            setRepZkpStatus('error');
            setRepZkpMessage(`Score is NOT above ${threshold}.`);
            return;
        }
        setRepZkpStatus('generating');
        setRepZkpMessage('Generating proof...');
        try {
            const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
                { score: score.toString(), threshold: threshold.toString() },
                'circuits/reputation_threshold.wasm',
                'circuits/reputation_threshold_final.zkey'
            );
            setRepZkpStatus('verifying');
            setRepZkpMessage('Verifying on-chain...');
            const pA = [proof.pi_a[0], proof.pi_a[1]];
            const pB = [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]];
            const pC = [proof.pi_c[0], proof.pi_c[1]];
            const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
            const verifier = new ethers.Contract(CONFIG.CONTRACTS.REPUTATION_VERIFIER, GROTH16_VERIFIER_ABI, provider);
            const isValid = await verifier.verifyProof(pA, pB, pC, publicSignals);
            if (isValid) {
                setRepZkpStatus('success');
                setRepZkpMessage(`Reputation ≥ ${threshold} — verified on-chain.`);
            } else {
                setRepZkpStatus('error');
                setRepZkpMessage('On-chain verification failed.');
            }
        } catch (err) {
            console.error('ZKP error:', err);
            setRepZkpStatus('error');
            setRepZkpMessage(err.message || 'Proof generation failed');
        }
    };

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

    const handleVerifyGPA = async (maxGpa) => {
        if (!window.snarkjs) { showNotification('snarkjs not loaded', 'error'); return; }
        const threshold = parseInt(gpaThreshold);
        if (isNaN(threshold) || threshold < 0) { showNotification('Select a valid threshold', 'error'); return; }
        if (maxGpa <= threshold) {
            setGpaZkpStatus('error');
            setGpaZkpMessage(`GPA is NOT above ${(threshold / 100).toFixed(2)}.`);
            return;
        }
        setGpaZkpStatus('generating');
        setGpaZkpMessage('Generating proof...');
        try {
            const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
                { gpa: maxGpa.toString(), threshold: threshold.toString() },
                'circuits/gpa_threshold.wasm',
                'circuits/gpa_threshold_final.zkey'
            );
            setGpaZkpStatus('verifying');
            setGpaZkpMessage('Verifying on-chain...');
            const pA = [proof.pi_a[0], proof.pi_a[1]];
            const pB = [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]];
            const pC = [proof.pi_c[0], proof.pi_c[1]];
            const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
            const verifier = new ethers.Contract(CONFIG.CONTRACTS.GPA_VERIFIER, GPA_VERIFIER_ABI, provider);
            const isValid = await verifier.verifyProof(pA, pB, pC, publicSignals);
            if (isValid) {
                setGpaZkpStatus('success');
                setGpaZkpMessage(`GPA ≥ ${(threshold / 100).toFixed(2)} — verified on-chain.`);
            } else {
                setGpaZkpStatus('error');
                setGpaZkpMessage('On-chain verification failed.');
            }
        } catch (err) {
            console.error('GPA ZKP error:', err);
            setGpaZkpStatus('error');
            setGpaZkpMessage(err.message || 'Proof generation failed');
        }
    };

    const DEGREE_CAT_NAMES = [
        'Arts & Humanities',
        'Business & Economics',
        'Law & Social Sciences',
        'Education & Development',
        'Health & Life Sciences',
        'Science & Technology'
    ];

    const handleVerifyDegreeCategory = async () => {
        if (!window.snarkjs) { showNotification('snarkjs not loaded', 'error'); return; }
        const claimed = parseInt(degreeCatThreshold);
        const matchingCred = (viewingToken.credentials[0] || []).find(
            c => c.status === 0 && c.category === claimed
        );
        if (!matchingCred) {
            setDegreeCatZkpStatus('error');
            setDegreeCatZkpMessage(`No active degree in ${DEGREE_CAT_NAMES[claimed]}.`);
            return;
        }
        setDegreeCatZkpStatus('generating');
        setDegreeCatZkpMessage('Generating proof...');
        try {
            const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
                { category: matchingCred.category.toString(), claimedCategory: claimed.toString() },
                'circuits/degree_category.wasm',
                'circuits/degree_category_final.zkey'
            );
            setDegreeCatZkpStatus('verifying');
            setDegreeCatZkpMessage('Verifying on-chain...');
            const pA = [proof.pi_a[0], proof.pi_a[1]];
            const pB = [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]];
            const pC = [proof.pi_c[0], proof.pi_c[1]];
            const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
            const verifier = new ethers.Contract(CONFIG.CONTRACTS.DEGREE_CATEGORY_VERIFIER, DEGREE_CATEGORY_VERIFIER_ABI, provider);
            const isValid = await verifier.verifyProof(pA, pB, pC, publicSignals);
            if (isValid) {
                setDegreeCatZkpStatus('success');
                setDegreeCatZkpMessage(`Degree in ${DEGREE_CAT_NAMES[claimed]} — verified on-chain.`);
            } else {
                setDegreeCatZkpStatus('error');
                setDegreeCatZkpMessage('On-chain verification failed.');
            }
        } catch (err) {
            console.error('Degree category ZKP error:', err);
            setDegreeCatZkpStatus('error');
            setDegreeCatZkpMessage(err.message || 'Proof generation failed');
        }
    };

    const CERT_DOMAIN_NAMES = [
        'IT & Software Development',
        'Business Management',
        'Health & Medicine',
        'Data & AI Analytics',
        'Communication & Marketing'
    ];

    const handleVerifyCertDomain = async () => {
        if (!window.snarkjs) { showNotification('snarkjs not loaded', 'error'); return; }
        const claimed = parseInt(certDomainThreshold);
        const matchingCred = (viewingToken.credentials[1] || []).find(
            c => c.status === 0 && c.category === claimed
        );
        if (!matchingCred) {
            setCertDomainZkpStatus('error');
            setCertDomainZkpMessage(`No active certification in ${CERT_DOMAIN_NAMES[claimed]}.`);
            return;
        }
        setCertDomainZkpStatus('generating');
        setCertDomainZkpMessage('Generating proof...');
        try {
            const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
                { domain: matchingCred.category.toString(), claimedDomain: claimed.toString() },
                'circuits/cert_domain.wasm',
                'circuits/cert_domain_final.zkey'
            );
            setCertDomainZkpStatus('verifying');
            setCertDomainZkpMessage('Verifying on-chain...');
            const pA = [proof.pi_a[0], proof.pi_a[1]];
            const pB = [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]];
            const pC = [proof.pi_c[0], proof.pi_c[1]];
            const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
            const verifier = new ethers.Contract(CONFIG.CONTRACTS.CERT_DOMAIN_VERIFIER, CERT_DOMAIN_VERIFIER_ABI, provider);
            const isValid = await verifier.verifyProof(pA, pB, pC, publicSignals);
            if (isValid) {
                setCertDomainZkpStatus('success');
                setCertDomainZkpMessage(`Certification in ${CERT_DOMAIN_NAMES[claimed]} — verified on-chain.`);
            } else {
                setCertDomainZkpStatus('error');
                setCertDomainZkpMessage('On-chain verification failed.');
            }
        } catch (err) {
            console.error('Cert domain ZKP error:', err);
            setCertDomainZkpStatus('error');
            setCertDomainZkpMessage(err.message || 'Proof generation failed');
        }
    };

    const handleVerifyWorkExperience = async () => {
        if (!window.snarkjs) { showNotification('snarkjs not loaded', 'error'); return; }
        const threshold = parseInt(workExpThreshold);
        if (isNaN(threshold) || threshold < 1) { showNotification('Select a valid threshold', 'error'); return; }
        const totalYears = viewingToken.totalWorkYears || 0;
        if (totalYears < threshold) {
            setWorkExpZkpStatus('error');
            setWorkExpZkpMessage(`Work experience does NOT meet ${threshold} year${threshold !== 1 ? 's' : ''}.`);
            return;
        }
        setWorkExpZkpStatus('generating');
        setWorkExpZkpMessage('Generating proof...');
        try {
            const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
                { totalYears: totalYears.toString(), threshold: threshold.toString() },
                'circuits/work_experience_threshold.wasm',
                'circuits/work_experience_threshold_final.zkey'
            );
            setWorkExpZkpStatus('verifying');
            setWorkExpZkpMessage('Verifying on-chain...');
            const pA = [proof.pi_a[0], proof.pi_a[1]];
            const pB = [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]];
            const pC = [proof.pi_c[0], proof.pi_c[1]];
            const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
            const verifier = new ethers.Contract(CONFIG.CONTRACTS.WORK_EXPERIENCE_VERIFIER, WORK_EXPERIENCE_VERIFIER_ABI, provider);
            const isValid = await verifier.verifyProof(pA, pB, pC, publicSignals);
            if (isValid) {
                setWorkExpZkpStatus('success');
                setWorkExpZkpMessage(`Work experience ≥ ${threshold} year${threshold !== 1 ? 's' : ''} — verified on-chain.`);
            } else {
                setWorkExpZkpStatus('error');
                setWorkExpZkpMessage('On-chain verification failed.');
            }
        } catch (err) {
            console.error('Work experience ZKP error:', err);
            setWorkExpZkpStatus('error');
            setWorkExpZkpMessage(err.message || 'Proof generation failed');
        }
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
            let requesters = [];
            try {
                const requests = await contracts.soulbound.getPendingRequests(selectedToken, 0, 50);
                // Named-tuple access (ethers v5); fall back to positional index for old ABI shapes
                requesters = requests.requesters ?? requests[0] ?? [];
            } catch (e) {
                console.error('getPendingRequests failed:', e.reason || e.data || e.message);
            }

            // Enhance pending requests with status info — all in parallel
            const enhancedRequests = await Promise.all(
                requesters.map(async (requester) => {
                    try {
                        const status = await contracts.soulbound.getAccessStatus(selectedToken, requester);
                        return { address: requester, status };
                    } catch (err) {
                        console.log('Could not fetch status for:', requester);
                        return { address: requester, status: 1 };
                    }
                })
            );

            setPendingRequests(enhancedRequests);

            // Reconstruct granted addresses from AccessApproved events (contract has no getter).
            // fromBlock is capped to MAX_BLOCK_LOOKBACK so we never generate hundreds of
            // sequential chunk calls on a chain with a large block count.
            const approvedFilter = contracts.soulbound.filters.AccessApproved(selectedToken);
            const latestBlock = await contracts.soulbound.provider.getBlockNumber();
            const fromBlock = Math.max(CONFIG.DEPLOYMENT_BLOCK, latestBlock - CONFIG.MAX_BLOCK_LOOKBACK);
            const approvedEvents = await queryFilterInChunks(
                contracts.soulbound, approvedFilter,
                fromBlock, latestBlock
            );
            const uniqueAddresses = [...new Set(approvedEvents.map(e => e.args.requester))];

            // Verify each address still has active (non-expired) access — all in parallel
            const accessResults = await Promise.all(
                uniqueAddresses.map(async (address) => {
                    try {
                        const [hasAccess, expiresAt] = await contracts.soulbound.checkAccess(selectedToken, address);
                        return hasAccess ? { address, expiresAt: expiresAt.toNumber() } : null;
                    } catch {
                        return null;
                    }
                })
            );

            setGrantedAccess(accessResults.filter(Boolean));
        } catch (error) {
            console.error('Error loading access data:', error.reason || error.data || error.message, error);
        } finally {
            setLoading(false);
        }
    };

    const loadTokensICanAccess = async () => {
        if (!contracts) return;

        try {
            const myAddress = await contracts.soulbound.signer.getAddress();

            // Find tokens where this address was ever approved.
            // Always use the indexed filter (null, myAddress) so the node only
            // searches topic[1] — never widen to a full unindexed scan.
            // fromBlock is capped to MAX_BLOCK_LOOKBACK to bound chunk count.
            let tokenIds = [];
            const latestBlock = await contracts.soulbound.provider.getBlockNumber();
            const fromBlock = Math.max(CONFIG.DEPLOYMENT_BLOCK, latestBlock - CONFIG.MAX_BLOCK_LOOKBACK);
            const indexedFilter = contracts.soulbound.filters.AccessApproved(null, myAddress);
            const events = await queryFilterInChunks(
                contracts.soulbound, indexedFilter,
                fromBlock, latestBlock
            );
            tokenIds = [...new Set(events.map(e => e.args.tokenId.toNumber()))];

            const results = await Promise.all(
                tokenIds.map(async (tokenId) => {
                    try {
                        const owner = await contracts.soulbound.ownerOf(tokenId);
                        if (owner.toLowerCase() === myAddress.toLowerCase()) return null;

                        const [hasAccess, expiresAt] = await contracts.soulbound.checkAccess(tokenId, myAddress);
                        if (!hasAccess) return null;

                        let metadataCID = '';
                        try {
                            metadataCID = await contracts.soulbound.tokenURI(tokenId);
                        } catch {}

                        return { tokenId, owner, expiresAt: expiresAt.toNumber(), cid: metadataCID || 'N/A' };
                    } catch {
                        return null;
                    }
                })
            );
            setTokensICanAccess(results.filter(Boolean));
        } catch (error) {
            console.error('Error loading accessible tokens:', error.reason || error.data || error.message, error);
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

    const openApproveModal = (requester) => {
        setApprovingRequester(requester);
        setSelectedCredTypes({0: true, 1: true, 2: true, 3: true, 4: true});
        setSelectedSocialSections({0: true, 1: true, 2: true});
        setShowApproveModal(true);
    };

    const buildBitmasks = () => {
        const credBitmask = Object.entries(selectedCredTypes)
            .reduce((mask, [bit, checked]) => checked ? mask | (1 << parseInt(bit)) : mask, 0);
        const socialBitmask = Object.entries(selectedSocialSections)
            .reduce((mask, [bit, checked]) => checked ? mask | (1 << parseInt(bit)) : mask, 0);
        return { credBitmask, socialBitmask };
    };

    const handleApproveAccess = async () => {
        if (!approvingRequester) return;
        try {
            const duration = 30 * 24 * 60 * 60;
            const { credBitmask, socialBitmask } = buildBitmasks();

            showNotification('Step 1/3: Approving identity access...', 'info');
            const tx1 = await contracts.soulbound.approveAccess(selectedToken, approvingRequester, duration);
            await tx1.wait();

            if (credBitmask > 0) {
                showNotification('Step 2/3: Granting credential access...', 'info');
                const tx2 = await contracts.credentials.grantCredentialAccess(selectedToken, approvingRequester, credBitmask);
                await tx2.wait();
            }

            if (socialBitmask > 0) {
                showNotification('Step 3/3: Granting social access...', 'info');
                const tx3 = await contracts.social.grantSocialAccess(selectedToken, approvingRequester, socialBitmask);
                await tx3.wait();
            }

            showNotification('Access approved with permissions!', 'success');
            setShowApproveModal(false);
            setApprovingRequester(null);
            loadAccessData();
        } catch (error) {
            console.error('Error approving access:', error);
            showNotification('Failed to approve access', 'error');
        }
    };

    const handleBatchApprove = async () => {
        if (selectedRequests.size === 0) return;
        try {
            const duration = 30 * 24 * 60 * 60;
            const requesters = Array.from(selectedRequests);
            const durations = requesters.map(() => duration);
            const { credBitmask, socialBitmask } = buildBitmasks();

            showNotification(`Step 1/3: Approving ${requesters.length} request(s)...`, 'info');
            const tx1 = await contracts.soulbound.batchApproveAccess(selectedToken, requesters, durations);
            await tx1.wait();

            if (credBitmask > 0) {
                showNotification('Step 2/3: Granting credential access...', 'info');
                const tx2 = await contracts.credentials.batchGrantCredentialAccess(selectedToken, requesters, credBitmask);
                await tx2.wait();
            }

            if (socialBitmask > 0) {
                showNotification('Step 3/3: Granting social access...', 'info');
                const tx3 = await contracts.social.batchGrantSocialAccess(selectedToken, requesters, socialBitmask);
                await tx3.wait();
            }

            showNotification(`${requesters.length} request(s) approved!`, 'success');
            setShowBatchApproveModal(false);
            setSelectedRequests(new Set());
            loadAccessData();
        } catch (error) {
            console.error('Error batch approving:', error);
            showNotification('Failed to batch approve', 'error');
        }
    };

    const handleBatchDeny = async () => {
        if (selectedRequests.size === 0) return;
        try {
            const requesters = Array.from(selectedRequests);
            showNotification(`Denying ${requesters.length} request(s)...`, 'info');
            const tx = await contracts.soulbound.batchDenyAccess(selectedToken, requesters);
            await tx.wait();
            showNotification(`${requesters.length} request(s) denied`, 'success');
            setSelectedRequests(new Set());
            loadAccessData();
        } catch (error) {
            console.error('Error batch denying:', error);
            showNotification('Failed to batch deny', 'error');
        }
    };

    const toggleRequestSelection = (address) => {
        setSelectedRequests(prev => {
            const next = new Set(prev);
            next.has(address) ? next.delete(address) : next.add(address);
            return next;
        });
    };

    const openBatchApproveModal = () => {
        setSelectedCredTypes({0: true, 1: true, 2: true, 3: true, 4: true});
        setSelectedSocialSections({0: true, 1: true, 2: true});
        setShowBatchApproveModal(true);
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
            showNotification('Revoking access...', 'info');
            const tx = await contracts.soulbound.revokeAccess(selectedToken, requester, reason);
            await tx.wait();

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
                        <>
                            {/* Batch action bar — visible once any request is selected */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--gray-light)' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedRequests.size === pendingRequests.length && pendingRequests.length > 0}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedRequests(new Set(pendingRequests.map(r => r.address || r)));
                                            } else {
                                                setSelectedRequests(new Set());
                                            }
                                        }}
                                    />
                                    Select all
                                </label>
                                {selectedRequests.size > 0 && (
                                    <>
                                        <span style={{ fontSize: '13px', color: 'var(--gray)' }}>{selectedRequests.size} selected</span>
                                        <Button
                                            onClick={openBatchApproveModal}
                                            style={{ padding: '6px 14px', fontSize: '12px' }}
                                        >
                                            ✓ Approve Selected
                                        </Button>
                                        <Button
                                            variant="danger"
                                            onClick={handleBatchDeny}
                                            style={{ padding: '6px 14px', fontSize: '12px' }}
                                        >
                                            ✕ Deny Selected
                                        </Button>
                                    </>
                                )}
                            </div>

                            <div className="requests-list">
                                {pendingRequests.map((requester, idx) => {
                                    const addr = requester.address || requester;
                                    const statusInfo = getAccessStatusLabel(requester.status || 1);
                                    return (
                                        <div key={idx} className="request-item">
                                            <input
                                                type="checkbox"
                                                checked={selectedRequests.has(addr)}
                                                onChange={() => toggleRequestSelection(addr)}
                                                style={{ flexShrink: 0 }}
                                            />
                                            <div className="requester-info" style={{ flex: 1 }}>
                                                <div className="requester-avatar">👤</div>
                                                <div style={{ flex: 1 }}>
                                                    <div className="requester-address">{shortenAddress(addr)}</div>
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
                                                    onClick={() => openApproveModal(addr)}
                                                    style={{ padding: '8px 16px', fontSize: '13px' }}
                                                >
                                                    Approve
                                                </Button>
                                                <Button
                                                    variant="danger"
                                                    onClick={() => handleDenyAccess(addr)}
                                                    style={{ padding: '8px 16px', fontSize: '13px' }}
                                                >
                                                    Deny
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
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
                                            disabled={loadingDetails}
                                        onClick={async () => {
                                                try {
                                                    setLoadingDetails(true);
                                                    showNotification('Loading identity details...', 'info');

                                                    // Fetch IPFS metadata (name, bio, photo)
                                                    let ipfsMetadata = null;
                                                    if (item.cid && item.cid !== 'N/A') {
                                                        try {
                                                            const res = await fetch(`${CONFIG.IPFS_GATEWAY}${item.cid}`);
                                                            if (res.ok) ipfsMetadata = await res.json();
                                                        } catch (e) {
                                                            console.log('Could not fetch IPFS metadata:', e);
                                                        }
                                                    }

                                                    // Fetch credentials for each type (0=degrees,1=certs,2=work,3=identity,4=skills)
                                                    const credentials = {};
                                                    for (let type = 0; type <= 4; type++) {
                                                        try {
                                                            const creds = await contracts.credentials.getCredentialsByType(item.tokenId, type);
                                                            credentials[type] = creds.map(c => ({
                                                                id: c.credentialId.toString(),
                                                                issuer: c.issuer,
                                                                issueDate: c.issueDate.toNumber(),
                                                                expiryDate: c.expiryDate.toNumber(),
                                                                status: c.status,
                                                                category: c.category,
                                                                verified: c.verified
                                                            }));
                                                        } catch (e) {
                                                            credentials[type] = [];
                                                        }
                                                    }

                                                    // Fetch GPA for active degree credentials
                                                    let maxGpa = 0;
                                                    for (const deg of (credentials[0] || [])) {
                                                        if (deg.status === 0) {
                                                            try {
                                                                const gpaRaw = await contracts.credentials.degreeGPA(deg.id);
                                                                const gpaVal = gpaRaw.toNumber ? gpaRaw.toNumber() : parseInt(gpaRaw.toString());
                                                                deg.gpa = gpaVal;
                                                                if (gpaVal > maxGpa) maxGpa = gpaVal;
                                                            } catch (e) {
                                                                console.log('degreeGPA fetch failed for', deg.id, e);
                                                            }
                                                        }
                                                    }

                                                    // Fetch total work experience years
                                                    let totalWorkYears = 0;
                                                    try {
                                                        const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
                                                        const credContract = new ethers.Contract(CONFIG.CONTRACTS.CREDENTIALS_HUB, CREDENTIALS_HUB_ABI, provider);
                                                        const work = await credContract.getTotalWorkExperience(item.tokenId);
                                                        const raw = work[0]; // positional access - more reliable with ethers v5 tuples
                                                        totalWorkYears = raw && raw.toNumber ? raw.toNumber() : parseInt((raw || 0).toString());
                                                    } catch (e) {
                                                        console.log('Could not fetch work experience:', e);
                                                    }

                                                    // Fetch reputation summary
                                                    let reputation = null;
                                                    try {
                                                        const rep = await contracts.social.getReputationSummary(item.tokenId);
                                                        reputation = {
                                                            averageScore: rep.averageScore.toNumber(),
                                                            totalReviews: rep.totalReviews.toNumber(),
                                                            verifiedReviews: rep.verifiedReviews.toNumber()
                                                        };
                                                    } catch (e) {
                                                        console.log('Could not fetch reputation:', e);
                                                    }

                                                    setRepZkpStatus('idle'); setRepZkpMessage('');
                                                    setGpaZkpStatus('idle'); setGpaZkpMessage('');
                                                    setDegreeCatZkpStatus('idle'); setDegreeCatZkpMessage('');
                                                    setCertDomainZkpStatus('idle'); setCertDomainZkpMessage('');
                                                    setWorkExpZkpStatus('idle'); setWorkExpZkpMessage('');
                                                    setViewingToken({ ...item, ipfsMetadata, credentials, reputation, maxGpa, totalWorkYears });
                                                    setRepZkpStatus('idle');
                                                    setRepZkpMessage('');
                                                    setViewingToken({ ...item, ipfsMetadata, credentials, reputation });
                                                    setShowViewModal(true);
                                                } catch (error) {
                                                    showNotification('Failed to load token details', 'error');
                                                } finally {
                                                    setLoadingDetails(false);
                                                }
                                            }}
                                            style={{ padding: '8px 16px', fontSize: '13px' }}
                                        >
                                            {loadingDetails ? 'Loading...' : '👁️ View Details'}
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
                            <div className="info-icon">🎯</div>
                            <div>
                                <h4>Selective Disclosure</h4>
                                <p>When approving access, you choose exactly which credential types and social sections the requester can see. You can grant access to degrees only, work experience only, or any combination.</p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            <Modal isOpen={showApproveModal} onClose={() => setShowApproveModal(false)} title="Approve Access Request">
                <div className="request-form">
                    <p style={{ color: 'var(--gray-light)', marginBottom: '20px' }}>
                        Approving access for <code style={{ color: 'var(--teal-light)' }}>{approvingRequester && shortenAddress(approvingRequester)}</code> for <strong>30 days</strong>.
                        Choose what they can see:
                    </p>

                    <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ color: 'var(--beige)', marginBottom: '12px' }}>📋 Credentials</h4>
                        {[
                            { bit: 0, icon: '🎓', label: 'Degrees' },
                            { bit: 1, icon: '📜', label: 'Certifications' },
                            { bit: 2, icon: '💼', label: 'Work Experience' },
                            { bit: 3, icon: '🆔', label: 'Identity Proofs' },
                            { bit: 4, icon: '⚡', label: 'Skills' }
                        ].map(({ bit, icon, label }) => (
                            <label key={bit} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedCredTypes[bit]}
                                    onChange={(e) => setSelectedCredTypes(prev => ({ ...prev, [bit]: e.target.checked }))}
                                />
                                <span>{icon} {label}</span>
                            </label>
                        ))}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ color: 'var(--beige)', marginBottom: '12px' }}>🌐 Social</h4>
                        {[
                            { bit: 0, icon: '⭐', label: 'Reviews & Reputation' },
                            { bit: 1, icon: '🚀', label: 'Projects' },
                            { bit: 2, icon: '👍', label: 'Endorsements' }
                        ].map(({ bit, icon, label }) => (
                            <label key={bit} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedSocialSections[bit]}
                                    onChange={(e) => setSelectedSocialSections(prev => ({ ...prev, [bit]: e.target.checked }))}
                                />
                                <span>{icon} {label}</span>
                            </label>
                        ))}
                    </div>

                    <div className="modal-actions">
                        <Button variant="secondary" onClick={() => setShowApproveModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleApproveAccess}>
                            Approve Access
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showBatchApproveModal} onClose={() => setShowBatchApproveModal(false)} title={`Batch Approve ${selectedRequests.size} Request(s)`}>
                <div className="request-form">
                    <p style={{ color: 'var(--gray-light)', marginBottom: '20px' }}>
                        Approving <strong style={{ color: 'var(--teal-light)' }}>{selectedRequests.size}</strong> request(s) for <strong>30 days</strong> in a single transaction.
                        Choose what they can see:
                    </p>

                    <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ color: 'var(--beige)', marginBottom: '12px' }}>📋 Credentials</h4>
                        {[
                            { bit: 0, icon: '🎓', label: 'Degrees' },
                            { bit: 1, icon: '📜', label: 'Certifications' },
                            { bit: 2, icon: '💼', label: 'Work Experience' },
                            { bit: 3, icon: '🆔', label: 'Identity Proofs' },
                            { bit: 4, icon: '⚡', label: 'Skills' }
                        ].map(({ bit, icon, label }) => (
                            <label key={bit} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedCredTypes[bit]}
                                    onChange={(e) => setSelectedCredTypes(prev => ({ ...prev, [bit]: e.target.checked }))}
                                />
                                <span>{icon} {label}</span>
                            </label>
                        ))}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ color: 'var(--beige)', marginBottom: '12px' }}>🌐 Social</h4>
                        {[
                            { bit: 0, icon: '⭐', label: 'Reviews & Reputation' },
                            { bit: 1, icon: '🚀', label: 'Projects' },
                            { bit: 2, icon: '👍', label: 'Endorsements' }
                        ].map(({ bit, icon, label }) => (
                            <label key={bit} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedSocialSections[bit]}
                                    onChange={(e) => setSelectedSocialSections(prev => ({ ...prev, [bit]: e.target.checked }))}
                                />
                                <span>{icon} {label}</span>
                            </label>
                        ))}
                    </div>

                    <div style={{ background: 'rgba(14,116,144,0.08)', border: '1px solid rgba(14,116,144,0.3)', borderRadius: '8px', padding: '12px', fontSize: '13px', color: 'var(--gray-light)', marginBottom: '4px' }}>
                        This sends up to 3 transactions: one to approve identity access, one for credential permissions, one for social permissions.
                    </div>

                    <div className="modal-actions">
                        <Button variant="secondary" onClick={() => setShowBatchApproveModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleBatchApprove}>
                            Approve All Selected
                        </Button>
                    </div>
                </div>
            </Modal>

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

            <Modal isOpen={showViewModal} onClose={() => { setShowViewModal(false); setRepZkpStatus('idle'); setRepZkpMessage(''); }} title={viewingToken ? `Token #${viewingToken.tokenId} — Identity` : 'Identity Details'}>
                {viewingToken && (
                    <div className="token-view-details">

                        {/* Access context banner */}
                        <div style={{
                            background: 'rgba(16,185,129,0.08)',
                            border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: '8px',
                            padding: '10px 16px',
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '0.85rem',
                            color: '#10b981'
                        }}>
                            <span>🔓</span>
                            <span>
                                <strong>Read access granted</strong>
                                {viewingToken.expiresAt > 0 && ` · Expires ${formatDate(viewingToken.expiresAt)}`}
                                {' · '}<span style={{ color: 'var(--gray)' }}>Owner: </span>
                                <code style={{ color: 'var(--teal-light)', fontSize: '0.82rem' }}>{viewingToken.owner}</code>
                            </span>
                        </div>

                        {/* Profile */}
                        <div className="detail-section">
                            <h4>Profile</h4>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                {viewingToken.ipfsMetadata?.profileImage ? (
                                    <img
                                        src={viewingToken.ipfsMetadata.profileImage}
                                        alt="Profile"
                                        style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }}
                                    />
                                ) : (
                                    <div style={{
                                        width: '64px', height: '64px', borderRadius: '12px', flexShrink: 0,
                                        background: 'rgba(14,116,144,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px'
                                    }}>👤</div>
                                )}
                                <div>
                                    <div style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--beige)', marginBottom: '6px' }}>
                                        {viewingToken.ipfsMetadata?.name || `Token #${viewingToken.tokenId}`}
                                    </div>
                                    {viewingToken.ipfsMetadata?.bio && (
                                        <div style={{ color: 'var(--gray-light)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                            {viewingToken.ipfsMetadata.bio}
                                        </div>
                                    )}
                                    {!viewingToken.ipfsMetadata && (
                                        <div style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>No profile metadata found on IPFS</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Credentials */}
                        {viewingToken.credentials && (
                            <div className="detail-section">
                                <h4>Credentials</h4>
                                {[
                                    { type: 0, icon: '🎓', label: 'Degrees' },
                                    { type: 1, icon: '📜', label: 'Certifications' },
                                    { type: 2, icon: '💼', label: 'Work Experience' },
                                    { type: 3, icon: '🆔', label: 'Identity Proofs' },
                                    { type: 4, icon: '⚡', label: 'Skills' }
                                ].map(({ type, icon, label }) => {
                                    const creds = viewingToken.credentials[type] || [];
                                    return (
                                        <div key={type} style={{ marginBottom: '16px' }}>
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                marginBottom: '8px', fontSize: '0.95rem',
                                                color: 'var(--beige)', fontWeight: '600'
                                            }}>
                                                <span>{icon}</span>
                                                <span>{label}</span>
                                                <span style={{
                                                    background: creds.length > 0 ? 'rgba(14,116,144,0.2)' : 'rgba(156,163,175,0.1)',
                                                    color: creds.length > 0 ? 'var(--teal-light)' : 'var(--gray)',
                                                    borderRadius: '10px', padding: '1px 8px', fontSize: '0.78rem', fontWeight: '700'
                                                }}>{creds.length}</span>
                                            </div>
                                            {creds.length === 0 ? (
                                                <div style={{ color: 'var(--gray)', fontSize: '0.82rem', paddingLeft: '8px' }}>
                                                    No {label.toLowerCase()} on record
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '4px' }}>
                                                    {creds.map((cred, i) => (
                                                        <div key={i} style={{
                                                            background: 'rgba(26,35,50,0.6)',
                                                            borderRadius: '8px', padding: '12px',
                                                            borderLeft: `3px solid ${cred.status === 0 ? 'var(--teal)' : cred.status === 1 ? 'var(--error, #ef4444)' : 'var(--gray)'}`
                                                        }}>
                                                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                                                                {cred.verified && (
                                                                    <span style={{
                                                                        background: 'rgba(16,185,129,0.15)', color: '#10b981',
                                                                        borderRadius: '4px', padding: '2px 8px',
                                                                        fontSize: '0.72rem', fontWeight: '700'
                                                                    }}>✓ Verified</span>
                                                                )}
                                                                {!cred.verified && (
                                                                    <span style={{
                                                                        background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                                                                        borderRadius: '4px', padding: '2px 8px',
                                                                        fontSize: '0.72rem', fontWeight: '600'
                                                                    }}>Self-reported</span>
                                                                )}
                                                                <span style={{
                                                                    background: cred.status === 0 ? 'rgba(14,116,144,0.15)' : cred.status === 1 ? 'rgba(239,68,68,0.15)' : 'rgba(156,163,175,0.15)',
                                                                    color: cred.status === 0 ? 'var(--teal-light)' : cred.status === 1 ? 'var(--error, #ef4444)' : 'var(--gray)',
                                                                    borderRadius: '4px', padding: '2px 8px', fontSize: '0.72rem'
                                                                }}>
                                                                    {cred.status === 0 ? 'Active' : cred.status === 1 ? 'Revoked' : 'Expired'}
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: '0.82rem', color: 'var(--gray-light)' }}>
                                                                Issuer: <code style={{ color: 'var(--teal-light)', fontSize: '0.8rem' }}>{shortenAddress(cred.issuer)}</code>
                                                            </div>
                                                            <div style={{ fontSize: '0.8rem', color: 'var(--gray)', marginTop: '4px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                                                <span>Issued: {cred.issueDate > 0 ? formatDate(cred.issueDate) : '—'}</span>
                                                                <span>Expires: {cred.expiryDate > 0 ? formatDate(cred.expiryDate) : 'No expiry'}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            {type === 0 && (viewingToken.credentials[0] || []).some(c => c.status === 0) && (
                                                <div style={{ marginTop: '12px', background: 'rgba(26,35,50,0.6)', borderRadius: '10px', padding: '16px' }}>
                                                    {viewingToken.maxGpa === 0 ? (
                                                        <p style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>
                                                            No GPA data available for ZK verification. Degrees must be issued via <code>addDegreeCredential</code>.
                                                        </p>
                                                    ) : (
                                                    <React.Fragment>
                                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '14px' }}>
                                                        Verify this token's GPA is above a threshold. The actual GPA is not revealed.
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '12px' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                                                                Prove GPA is above
                                                            </label>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                {[200, 250, 300, 325, 350, 375].map(val => (
                                                                    <button
                                                                        key={val}
                                                                        onClick={() => { setGpaThreshold(val.toString()); setGpaZkpStatus('idle'); setGpaZkpMessage(''); }}
                                                                        style={{
                                                                            padding: '6px 14px',
                                                                            borderRadius: '20px',
                                                                            border: `1px solid ${gpaThreshold === val.toString() ? 'var(--teal)' : 'rgba(14,116,144,0.3)'}`,
                                                                            background: gpaThreshold === val.toString() ? 'rgba(14,116,144,0.25)' : 'transparent',
                                                                            color: gpaThreshold === val.toString() ? 'var(--teal-light)' : 'var(--gray-light)',
                                                                            fontSize: '0.85rem',
                                                                            fontWeight: gpaThreshold === val.toString() ? '700' : '400',
                                                                            cursor: 'pointer',
                                                                            transition: 'all 0.15s'
                                                                        }}
                                                                    >
                                                                        {(val / 100).toFixed(2)}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            onClick={() => handleVerifyGPA(viewingToken.maxGpa)}
                                                            disabled={gpaZkpStatus === 'generating' || gpaZkpStatus === 'verifying'}
                                                            style={{ minWidth: '110px', height: '44px', flexShrink: 0 }}
                                                        >
                                                            {gpaZkpStatus === 'generating' ? 'Generating...' :
                                                             gpaZkpStatus === 'verifying' ? 'Verifying...' : 'Verify GPA'}
                                                        </Button>
                                                    </div>
                                                    {gpaZkpMessage && (
                                                        <div style={{
                                                            padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600',
                                                            background: gpaZkpStatus === 'success' ? 'rgba(16,185,129,0.1)' : gpaZkpStatus === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.05)',
                                                            border: `1px solid ${gpaZkpStatus === 'success' ? 'rgba(16,185,129,0.3)' : gpaZkpStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.2)'}`,
                                                            color: gpaZkpStatus === 'success' ? 'var(--success)' : gpaZkpStatus === 'error' ? 'var(--error)' : 'var(--text-secondary)'
                                                        }}>
                                                            {gpaZkpStatus === 'generating' || gpaZkpStatus === 'verifying' ? '⏳ ' : gpaZkpStatus === 'success' ? '✓ ' : '✗ '}
                                                            {gpaZkpMessage}
                                                        </div>
                                                    )}
                                                    </React.Fragment>
                                                    )}
                                                </div>
                                            )}
                                            {type === 1 && (viewingToken.credentials[1] || []).some(c => c.status === 0) && (
                                                <div style={{ marginTop: '12px', background: 'rgba(26,35,50,0.6)', borderRadius: '10px', padding: '16px' }}>
                                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '14px' }}>
                                                        Verify this token has an active certification in a specific domain. The actual credential is not revealed.
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '12px' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                                                                Prove certification in domain
                                                            </label>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                {['IT & Software Dev', 'Business Management', 'Health & Medicine', 'Data & AI Analytics', 'Communication & Marketing'].map((name, val) => (
                                                                    <button
                                                                        key={val}
                                                                        onClick={() => { setCertDomainThreshold(val.toString()); setCertDomainZkpStatus('idle'); setCertDomainZkpMessage(''); }}
                                                                        style={{
                                                                            padding: '6px 14px',
                                                                            borderRadius: '20px',
                                                                            border: `1px solid ${certDomainThreshold === val.toString() ? 'var(--teal)' : 'rgba(14,116,144,0.3)'}`,
                                                                            background: certDomainThreshold === val.toString() ? 'rgba(14,116,144,0.25)' : 'transparent',
                                                                            color: certDomainThreshold === val.toString() ? 'var(--teal-light)' : 'var(--gray-light)',
                                                                            fontSize: '0.82rem',
                                                                            fontWeight: certDomainThreshold === val.toString() ? '700' : '400',
                                                                            cursor: 'pointer',
                                                                            transition: 'all 0.15s'
                                                                        }}
                                                                    >
                                                                        {name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            onClick={handleVerifyCertDomain}
                                                            disabled={certDomainZkpStatus === 'generating' || certDomainZkpStatus === 'verifying'}
                                                            style={{ minWidth: '110px', height: '44px', flexShrink: 0 }}
                                                        >
                                                            {certDomainZkpStatus === 'generating' ? 'Generating...' :
                                                             certDomainZkpStatus === 'verifying' ? 'Verifying...' : 'Verify Domain'}
                                                        </Button>
                                                    </div>
                                                    {certDomainZkpMessage && (
                                                        <div style={{
                                                            padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600',
                                                            background: certDomainZkpStatus === 'success' ? 'rgba(16,185,129,0.1)' : certDomainZkpStatus === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.05)',
                                                            border: `1px solid ${certDomainZkpStatus === 'success' ? 'rgba(16,185,129,0.3)' : certDomainZkpStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.2)'}`,
                                                            color: certDomainZkpStatus === 'success' ? 'var(--success)' : certDomainZkpStatus === 'error' ? 'var(--error)' : 'var(--text-secondary)'
                                                        }}>
                                                            {certDomainZkpStatus === 'generating' || certDomainZkpStatus === 'verifying' ? '⏳ ' : certDomainZkpStatus === 'success' ? '✓ ' : '✗ '}
                                                            {certDomainZkpMessage}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {type === 2 && (viewingToken.credentials[2] || []).length > 0 && (
                                                <div style={{ marginTop: '12px', background: 'rgba(26,35,50,0.6)', borderRadius: '10px', padding: '16px' }}>
                                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '14px' }}>
                                                        Verify total work experience meets a minimum. The actual duration is not revealed.{' '}
                                                        {viewingToken.totalWorkYears > 0
                                                            ? <span style={{ color: 'var(--teal-light)', fontWeight: '600' }}>({viewingToken.totalWorkYears} yr{viewingToken.totalWorkYears !== 1 ? 's' : ''} computed)</span>
                                                            : <span style={{ color: 'var(--gray)' }}>(less than 1 year or no data)</span>
                                                        }
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '12px' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                                                                Prove experience of at least
                                                            </label>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                {[1, 2, 3, 4, 5, 7, 10].map(val => (
                                                                    <button
                                                                        key={val}
                                                                        onClick={() => { setWorkExpThreshold(val.toString()); setWorkExpZkpStatus('idle'); setWorkExpZkpMessage(''); }}
                                                                        style={{
                                                                            padding: '6px 14px',
                                                                            borderRadius: '20px',
                                                                            border: `1px solid ${workExpThreshold === val.toString() ? 'var(--teal)' : 'rgba(14,116,144,0.3)'}`,
                                                                            background: workExpThreshold === val.toString() ? 'rgba(14,116,144,0.25)' : 'transparent',
                                                                            color: workExpThreshold === val.toString() ? 'var(--teal-light)' : 'var(--gray-light)',
                                                                            fontSize: '0.85rem',
                                                                            fontWeight: workExpThreshold === val.toString() ? '700' : '400',
                                                                            cursor: 'pointer',
                                                                            transition: 'all 0.15s'
                                                                        }}
                                                                    >
                                                                        {val} yr{val !== 1 ? 's' : ''}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            onClick={handleVerifyWorkExperience}
                                                            disabled={workExpZkpStatus === 'generating' || workExpZkpStatus === 'verifying'}
                                                            style={{ minWidth: '110px', height: '44px', flexShrink: 0 }}
                                                        >
                                                            {workExpZkpStatus === 'generating' ? 'Generating...' :
                                                             workExpZkpStatus === 'verifying' ? 'Verifying...' : 'Verify Years'}
                                                        </Button>
                                                    </div>
                                                    {workExpZkpMessage && (
                                                        <div style={{
                                                            padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600',
                                                            background: workExpZkpStatus === 'success' ? 'rgba(16,185,129,0.1)' : workExpZkpStatus === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.05)',
                                                            border: `1px solid ${workExpZkpStatus === 'success' ? 'rgba(16,185,129,0.3)' : workExpZkpStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.2)'}`,
                                                            color: workExpZkpStatus === 'success' ? 'var(--success)' : workExpZkpStatus === 'error' ? 'var(--error)' : 'var(--text-secondary)'
                                                        }}>
                                                            {workExpZkpStatus === 'generating' || workExpZkpStatus === 'verifying' ? '⏳ ' : workExpZkpStatus === 'success' ? '✓ ' : '✗ '}
                                                            {workExpZkpMessage}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {type === 0 && (viewingToken.credentials[0] || []).some(c => c.status === 0) && (
                                                <div style={{ marginTop: '12px', background: 'rgba(26,35,50,0.6)', borderRadius: '10px', padding: '16px' }}>
                                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '14px' }}>
                                                        Verify this token has an active degree in a specific field. The actual credential is not revealed.
                                                    </p>
                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '12px' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                                                                Prove degree in field
                                                            </label>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                                {['Arts & Humanities', 'Business & Economics', 'Law & Social Sciences', 'Education & Development', 'Health & Life Sciences', 'Science & Technology'].map((name, val) => (
                                                                    <button
                                                                        key={val}
                                                                        onClick={() => { setDegreeCatThreshold(val.toString()); setDegreeCatZkpStatus('idle'); setDegreeCatZkpMessage(''); }}
                                                                        style={{
                                                                            padding: '6px 14px',
                                                                            borderRadius: '20px',
                                                                            border: `1px solid ${degreeCatThreshold === val.toString() ? 'var(--teal)' : 'rgba(14,116,144,0.3)'}`,
                                                                            background: degreeCatThreshold === val.toString() ? 'rgba(14,116,144,0.25)' : 'transparent',
                                                                            color: degreeCatThreshold === val.toString() ? 'var(--teal-light)' : 'var(--gray-light)',
                                                                            fontSize: '0.82rem',
                                                                            fontWeight: degreeCatThreshold === val.toString() ? '700' : '400',
                                                                            cursor: 'pointer',
                                                                            transition: 'all 0.15s'
                                                                        }}
                                                                    >
                                                                        {name}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            onClick={handleVerifyDegreeCategory}
                                                            disabled={degreeCatZkpStatus === 'generating' || degreeCatZkpStatus === 'verifying'}
                                                            style={{ minWidth: '110px', height: '44px', flexShrink: 0 }}
                                                        >
                                                            {degreeCatZkpStatus === 'generating' ? 'Generating...' :
                                                             degreeCatZkpStatus === 'verifying' ? 'Verifying...' : 'Verify Field'}
                                                        </Button>
                                                    </div>
                                                    {degreeCatZkpMessage && (
                                                        <div style={{
                                                            padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600',
                                                            background: degreeCatZkpStatus === 'success' ? 'rgba(16,185,129,0.1)' : degreeCatZkpStatus === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.05)',
                                                            border: `1px solid ${degreeCatZkpStatus === 'success' ? 'rgba(16,185,129,0.3)' : degreeCatZkpStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.2)'}`,
                                                            color: degreeCatZkpStatus === 'success' ? 'var(--success)' : degreeCatZkpStatus === 'error' ? 'var(--error)' : 'var(--text-secondary)'
                                                        }}>
                                                            {degreeCatZkpStatus === 'generating' || degreeCatZkpStatus === 'verifying' ? '⏳ ' : degreeCatZkpStatus === 'success' ? '✓ ' : '✗ '}
                                                            {degreeCatZkpMessage}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Reputation — ZKP only, raw score never shown */}
                        {viewingToken.reputation !== null && viewingToken.reputation !== undefined && (
                            <div className="detail-section" style={{ paddingBottom: 0, borderBottom: 'none' }}>
                                <h4>Reputation</h4>
                                {viewingToken.reputation.totalReviews === 0 ? (
                                    <div style={{ color: 'var(--gray)', fontSize: '0.88rem' }}>No reviews yet</div>
                                ) : (
                                    <div style={{ background: 'rgba(26,35,50,0.6)', borderRadius: '10px', padding: '16px' }}>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '14px' }}>
                                            Verify this token's reputation score is above a threshold. The actual score is not revealed.
                                        </p>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '12px' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                                                    Prove score is above
                                                </label>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(val => (
                                                        <button
                                                            key={val}
                                                            onClick={() => { setRepThreshold(val.toString()); setRepZkpStatus('idle'); setRepZkpMessage(''); }}
                                                            style={{
                                                                padding: '6px 14px',
                                                                borderRadius: '20px',
                                                                border: `1px solid ${repThreshold === val.toString() ? 'var(--teal)' : 'rgba(14,116,144,0.3)'}`,
                                                                background: repThreshold === val.toString() ? 'rgba(14,116,144,0.25)' : 'transparent',
                                                                color: repThreshold === val.toString() ? 'var(--teal-light)' : 'var(--gray-light)',
                                                                fontSize: '0.85rem',
                                                                fontWeight: repThreshold === val.toString() ? '700' : '400',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s'
                                                            }}
                                                        >
                                                            {val}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <Button
                                                onClick={() => handleVerifyReputation(viewingToken.tokenId, viewingToken.reputation.averageScore)}
                                                disabled={repZkpStatus === 'generating' || repZkpStatus === 'verifying'}
                                                style={{ minWidth: '100px', height: '44px', flexShrink: 0 }}
                                            >
                                                {repZkpStatus === 'generating' ? 'Generating...' :
                                                 repZkpStatus === 'verifying' ? 'Verifying...' : 'Verify'}
                                            </Button>
                                        </div>
                                        {repZkpMessage && (
                                            <div style={{
                                                padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600',
                                                background: repZkpStatus === 'success' ? 'rgba(16,185,129,0.1)' : repZkpStatus === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.05)',
                                                border: `1px solid ${repZkpStatus === 'success' ? 'rgba(16,185,129,0.3)' : repZkpStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.2)'}`,
                                                color: repZkpStatus === 'success' ? 'var(--success)' : repZkpStatus === 'error' ? 'var(--error)' : 'var(--text-secondary)'
                                            }}>
                                                {repZkpStatus === 'generating' || repZkpStatus === 'verifying' ? '⏳ ' : repZkpStatus === 'success' ? '✓ ' : '✗ '}
                                                {repZkpMessage}
                                            </div>
                                        )}
                                        <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--gray)' }}>
                                            {viewingToken.reputation.totalReviews} review{viewingToken.reputation.totalReviews !== 1 ? 's' : ''} · {viewingToken.reputation.verifiedReviews} verified
                                        </div>
                                    </div>
                                )}
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

