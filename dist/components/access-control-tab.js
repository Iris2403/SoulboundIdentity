AccessControlTab = function ({
  contracts,
  selectedToken,
  userTokens,
  showNotification
}) {
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
  const [selectedCredTypes, setSelectedCredTypes] = useState({
    0: true,
    1: true,
    2: true,
    3: true,
    4: true
  });
  const [selectedSocialSections, setSelectedSocialSections] = useState({
    0: true,
    1: true,
    2: true
  });
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
  const handleVerifyReputation = async (tokenId, score) => {
    if (!window.snarkjs) {
      showNotification('snarkjs not loaded', 'error');
      return;
    }
    const threshold = parseInt(repThreshold);
    if (isNaN(threshold) || threshold < 0) {
      showNotification('Enter a valid threshold', 'error');
      return;
    }
    if (score <= threshold) {
      setRepZkpStatus('error');
      setRepZkpMessage(`Score is NOT above ${threshold}.`);
      return;
    }
    setRepZkpStatus('generating');
    setRepZkpMessage('Generating proof...');
    try {
      const {
        proof,
        publicSignals
      } = await window.snarkjs.groth16.fullProve({
        score: score.toString(),
        threshold: threshold.toString()
      }, 'circuits/reputation_threshold.wasm', 'circuits/reputation_threshold_final.zkey');
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
  const getExpiryCountdown = expiresAt => {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = expiresAt - now;
    if (timeLeft <= 0) return '⚫ Expired';
    const days = Math.floor(timeLeft / 86400);
    const hours = Math.floor(timeLeft % 86400 / 3600);
    const minutes = Math.floor(timeLeft % 3600 / 60);
    if (days > 0) return `🟢 Expires in ${days} day${days > 1 ? 's' : ''} ${hours}h`;
    if (hours > 0) return `🟡 Expires in ${hours} hour${hours > 1 ? 's' : ''} ${minutes}m`;
    return `🔴 Expires in ${minutes} minute${minutes > 1 ? 's' : ''}`;
  };
  const handleVerifyGPA = async maxGpa => {
    if (!window.snarkjs) {
      showNotification('snarkjs not loaded', 'error');
      return;
    }
    const threshold = parseInt(gpaThreshold);
    if (isNaN(threshold) || threshold < 0) {
      showNotification('Select a valid threshold', 'error');
      return;
    }
    if (maxGpa <= threshold) {
      setGpaZkpStatus('error');
      setGpaZkpMessage(`GPA is NOT above ${(threshold / 100).toFixed(2)}.`);
      return;
    }
    setGpaZkpStatus('generating');
    setGpaZkpMessage('Generating proof...');
    try {
      const {
        proof,
        publicSignals
      } = await window.snarkjs.groth16.fullProve({
        gpa: maxGpa.toString(),
        threshold: threshold.toString()
      }, 'circuits/gpa_threshold.wasm', 'circuits/gpa_threshold_final.zkey');
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
  const DEGREE_CAT_NAMES = ['Arts & Humanities', 'Business & Economics', 'Law & Social Sciences', 'Education & Development', 'Health & Life Sciences', 'Science & Technology'];
  const handleVerifyDegreeCategory = async () => {
    if (!window.snarkjs) {
      showNotification('snarkjs not loaded', 'error');
      return;
    }
    const claimed = parseInt(degreeCatThreshold);
    const matchingCred = (viewingToken.credentials[0] || []).find(c => c.status === 0 && c.category === claimed);
    if (!matchingCred) {
      setDegreeCatZkpStatus('error');
      setDegreeCatZkpMessage(`No active degree in ${DEGREE_CAT_NAMES[claimed]}.`);
      return;
    }
    setDegreeCatZkpStatus('generating');
    setDegreeCatZkpMessage('Generating proof...');
    try {
      const {
        proof,
        publicSignals
      } = await window.snarkjs.groth16.fullProve({
        category: matchingCred.category.toString(),
        claimedCategory: claimed.toString()
      }, 'circuits/degree_category.wasm', 'circuits/degree_category_final.zkey');
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

  // Helper function to get access status label
  const getAccessStatusLabel = status => {
    const statusMap = {
      0: {
        label: 'No Request',
        color: 'var(--text-muted)',
        icon: '⚪'
      },
      1: {
        label: 'Pending',
        color: 'var(--warning)',
        icon: '🟡'
      },
      2: {
        label: 'Approved',
        color: 'var(--success)',
        icon: '🟢'
      },
      3: {
        label: 'Denied',
        color: 'var(--error)',
        icon: '🔴'
      }
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
      const enhancedRequests = await Promise.all(requesters.map(async requester => {
        try {
          const status = await contracts.soulbound.getAccessStatus(selectedToken, requester);
          return {
            address: requester,
            status
          };
        } catch (err) {
          console.log('Could not fetch status for:', requester);
          return {
            address: requester,
            status: 1
          };
        }
      }));
      setPendingRequests(enhancedRequests);

      // Reconstruct granted addresses from AccessApproved events (contract has no getter).
      // fromBlock is capped to MAX_BLOCK_LOOKBACK so we never generate hundreds of
      // sequential chunk calls on a chain with a large block count.
      const approvedFilter = contracts.soulbound.filters.AccessApproved(selectedToken);
      const latestBlock = await contracts.soulbound.provider.getBlockNumber();
      const fromBlock = Math.max(CONFIG.DEPLOYMENT_BLOCK, latestBlock - CONFIG.MAX_BLOCK_LOOKBACK);
      const approvedEvents = await queryFilterInChunks(contracts.soulbound, approvedFilter, fromBlock, latestBlock);
      const uniqueAddresses = [...new Set(approvedEvents.map(e => e.args.requester))];

      // Verify each address still has active (non-expired) access — all in parallel
      const accessResults = await Promise.all(uniqueAddresses.map(async address => {
        try {
          const [hasAccess, expiresAt] = await contracts.soulbound.checkAccess(selectedToken, address);
          return hasAccess ? {
            address,
            expiresAt: expiresAt.toNumber()
          } : null;
        } catch {
          return null;
        }
      }));
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
      const events = await queryFilterInChunks(contracts.soulbound, indexedFilter, fromBlock, latestBlock);
      tokenIds = [...new Set(events.map(e => e.args.tokenId.toNumber()))];
      const results = await Promise.all(tokenIds.map(async tokenId => {
        try {
          const owner = await contracts.soulbound.ownerOf(tokenId);
          if (owner.toLowerCase() === myAddress.toLowerCase()) return null;
          const [hasAccess, expiresAt] = await contracts.soulbound.checkAccess(tokenId, myAddress);
          if (!hasAccess) return null;
          let metadataCID = '';
          try {
            metadataCID = await contracts.soulbound.tokenURI(tokenId);
          } catch {}
          return {
            tokenId,
            owner,
            expiresAt: expiresAt.toNumber(),
            cid: metadataCID || 'N/A'
          };
        } catch {
          return null;
        }
      }));
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
  const openApproveModal = requester => {
    setApprovingRequester(requester);
    setSelectedCredTypes({
      0: true,
      1: true,
      2: true,
      3: true,
      4: true
    });
    setSelectedSocialSections({
      0: true,
      1: true,
      2: true
    });
    setShowApproveModal(true);
  };
  const buildBitmasks = () => {
    const credBitmask = Object.entries(selectedCredTypes).reduce((mask, [bit, checked]) => checked ? mask | 1 << parseInt(bit) : mask, 0);
    const socialBitmask = Object.entries(selectedSocialSections).reduce((mask, [bit, checked]) => checked ? mask | 1 << parseInt(bit) : mask, 0);
    return {
      credBitmask,
      socialBitmask
    };
  };
  const handleApproveAccess = async () => {
    if (!approvingRequester) return;
    try {
      const duration = 30 * 24 * 60 * 60;
      const {
        credBitmask,
        socialBitmask
      } = buildBitmasks();
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
      const {
        credBitmask,
        socialBitmask
      } = buildBitmasks();
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
  const toggleRequestSelection = address => {
    setSelectedRequests(prev => {
      const next = new Set(prev);
      next.has(address) ? next.delete(address) : next.add(address);
      return next;
    });
  };
  const openBatchApproveModal = () => {
    setSelectedCredTypes({
      0: true,
      1: true,
      2: true,
      3: true,
      4: true
    });
    setSelectedSocialSections({
      0: true,
      1: true,
      2: true
    });
    setShowBatchApproveModal(true);
  };
  const handleDenyAccess = async requester => {
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
  const handleRevokeAccess = async requester => {
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
    return /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      className: "empty-state"
    }, /*#__PURE__*/React.createElement("div", {
      className: "empty-icon"
    }, "\uD83D\uDD10"), /*#__PURE__*/React.createElement("h3", null, "Select an Identity Token"), /*#__PURE__*/React.createElement("p", null, "Choose a token from the Identity tab to manage access")));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "access-tab"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tab-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "Access Control"), /*#__PURE__*/React.createElement("p", {
    className: "tab-description"
  }, "Manage who can view your identity and credentials")), /*#__PURE__*/React.createElement(Button, {
    onClick: () => setShowRequestModal(true)
  }, "Request Access to Token")), /*#__PURE__*/React.createElement("div", {
    className: "access-sections"
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("h3", null, "Pending Access Requests"), /*#__PURE__*/React.createElement("span", {
    className: "badge"
  }, pendingRequests.length)), loading ? /*#__PURE__*/React.createElement(LoadingSpinner, null) : pendingRequests.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-message"
  }, /*#__PURE__*/React.createElement("p", null, "No pending access requests")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '14px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      cursor: 'pointer',
      fontSize: '13px',
      color: 'var(--gray-light)'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selectedRequests.size === pendingRequests.length && pendingRequests.length > 0,
    onChange: e => {
      if (e.target.checked) {
        setSelectedRequests(new Set(pendingRequests.map(r => r.address || r)));
      } else {
        setSelectedRequests(new Set());
      }
    }
  }), "Select all"), selectedRequests.size > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '13px',
      color: 'var(--gray)'
    }
  }, selectedRequests.size, " selected"), /*#__PURE__*/React.createElement(Button, {
    onClick: openBatchApproveModal,
    style: {
      padding: '6px 14px',
      fontSize: '12px'
    }
  }, "\u2713 Approve Selected"), /*#__PURE__*/React.createElement(Button, {
    variant: "danger",
    onClick: handleBatchDeny,
    style: {
      padding: '6px 14px',
      fontSize: '12px'
    }
  }, "\u2715 Deny Selected"))), /*#__PURE__*/React.createElement("div", {
    className: "requests-list"
  }, pendingRequests.map((requester, idx) => {
    const addr = requester.address || requester;
    const statusInfo = getAccessStatusLabel(requester.status || 1);
    return /*#__PURE__*/React.createElement("div", {
      key: idx,
      className: "request-item"
    }, /*#__PURE__*/React.createElement("input", {
      type: "checkbox",
      checked: selectedRequests.has(addr),
      onChange: () => toggleRequestSelection(addr),
      style: {
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "requester-info",
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "requester-avatar"
    }, "\uD83D\uDC64"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "requester-address"
    }, shortenAddress(addr)), /*#__PURE__*/React.createElement("div", {
      className: "requester-label"
    }, "Wallet Address"), /*#__PURE__*/React.createElement("div", {
      style: {
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
      }
    }, statusInfo.icon, " ", statusInfo.label))), /*#__PURE__*/React.createElement("div", {
      className: "request-actions"
    }, /*#__PURE__*/React.createElement(Button, {
      onClick: () => openApproveModal(addr),
      style: {
        padding: '8px 16px',
        fontSize: '13px'
      }
    }, "Approve"), /*#__PURE__*/React.createElement(Button, {
      variant: "danger",
      onClick: () => handleDenyAccess(addr),
      style: {
        padding: '8px 16px',
        fontSize: '13px'
      }
    }, "Deny")));
  })))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("h3", null, "Granted Access"), /*#__PURE__*/React.createElement("span", {
    className: "badge"
  }, grantedAccess.length)), loading ? /*#__PURE__*/React.createElement(LoadingSpinner, null) : grantedAccess.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-message"
  }, /*#__PURE__*/React.createElement("p", null, "You haven't granted access to anyone yet")) : /*#__PURE__*/React.createElement("div", {
    className: "requests-list"
  }, grantedAccess.map((item, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    className: "request-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "requester-info"
  }, /*#__PURE__*/React.createElement("div", {
    className: "requester-avatar"
  }, "\u2713"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "requester-address"
  }, shortenAddress(item.address)), /*#__PURE__*/React.createElement("div", {
    className: "requester-label",
    style: {
      marginTop: '8px'
    }
  }, "\uD83D\uDCC5 Granted: ", formatDate(item.expiresAt - 30 * 24 * 60 * 60)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '8px',
      padding: '6px 12px',
      background: 'rgba(6, 182, 212, 0.1)',
      borderRadius: '6px',
      display: 'inline-block'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.9rem',
      fontWeight: '600',
      color: item.expiresAt > Math.floor(Date.now() / 1000) ? 'var(--success)' : 'var(--error)'
    }
  }, getExpiryCountdown(item.expiresAt))))), /*#__PURE__*/React.createElement("div", {
    className: "request-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "danger",
    onClick: () => handleRevokeAccess(item.address),
    style: {
      padding: '8px 16px',
      fontSize: '13px'
    }
  }, "Revoke Access")))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("h3", null, "Tokens I Can Access"), /*#__PURE__*/React.createElement("span", {
    className: "badge"
  }, tokensICanAccess.length)), tokensICanAccess.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-message"
  }, /*#__PURE__*/React.createElement("p", null, "No access granted yet. Request access to view other identities.")) : /*#__PURE__*/React.createElement("div", {
    className: "requests-list"
  }, tokensICanAccess.map((item, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    className: "request-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "requester-info"
  }, /*#__PURE__*/React.createElement("div", {
    className: "requester-avatar"
  }, "\uD83E\uDEAA"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "requester-address"
  }, "Token #", item.tokenId), /*#__PURE__*/React.createElement("div", {
    className: "requester-label"
  }, "Owner: ", shortenAddress(item.owner)), /*#__PURE__*/React.createElement("div", {
    className: "requester-label",
    style: {
      color: 'var(--teal-light)',
      marginTop: '4px'
    }
  }, item.expiresAt > 0 && item.expiresAt < Date.now() / 1000 ? '⚠️ Access Expired' : `✓ Access until ${formatDate(item.expiresAt)}`))), /*#__PURE__*/React.createElement("div", {
    className: "request-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    disabled: loadingDetails,
    onClick: async () => {
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
        for (const deg of credentials[0] || []) {
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
        setRepZkpStatus('idle');
        setRepZkpMessage('');
        setGpaZkpStatus('idle');
        setGpaZkpMessage('');
        setDegreeCatZkpStatus('idle');
        setDegreeCatZkpMessage('');
        setViewingToken({
          ...item,
          ipfsMetadata,
          credentials,
          reputation,
          maxGpa
        });
        setRepZkpStatus('idle');
        setRepZkpMessage('');
        setViewingToken({
          ...item,
          ipfsMetadata,
          credentials,
          reputation
        });
        setShowViewModal(true);
      } catch (error) {
        showNotification('Failed to load token details', 'error');
      } finally {
        setLoadingDetails(false);
      }
    },
    style: {
      padding: '8px 16px',
      fontSize: '13px'
    }
  }, loadingDetails ? 'Loading...' : '👁️ View Details')))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("h3", null, "Privacy Settings")), /*#__PURE__*/React.createElement("div", {
    className: "privacy-info"
  }, /*#__PURE__*/React.createElement("div", {
    className: "info-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "info-icon"
  }, "\uD83D\uDD12"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "Default Privacy"), /*#__PURE__*/React.createElement("p", null, "Your identity and credentials are private by default. Only you can view them unless you grant access."))), /*#__PURE__*/React.createElement("div", {
    className: "info-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "info-icon"
  }, "\u23F1\uFE0F"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "Time-Limited Access"), /*#__PURE__*/React.createElement("p", null, "When you approve access, it's granted for 30 days by default. You can revoke access at any time."))), /*#__PURE__*/React.createElement("div", {
    className: "info-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "info-icon"
  }, "\uD83D\uDEE1\uFE0F"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "Request Tracking"), /*#__PURE__*/React.createElement("p", null, "All access requests are tracked on-chain for transparency and security."))), /*#__PURE__*/React.createElement("div", {
    className: "info-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "info-icon"
  }, "\uD83C\uDFAF"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", null, "Selective Disclosure"), /*#__PURE__*/React.createElement("p", null, "When approving access, you choose exactly which credential types and social sections the requester can see. You can grant access to degrees only, work experience only, or any combination.")))))), /*#__PURE__*/React.createElement(Modal, {
    isOpen: showApproveModal,
    onClose: () => setShowApproveModal(false),
    title: "Approve Access Request"
  }, /*#__PURE__*/React.createElement("div", {
    className: "request-form"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--gray-light)',
      marginBottom: '20px'
    }
  }, "Approving access for ", /*#__PURE__*/React.createElement("code", {
    style: {
      color: 'var(--teal-light)'
    }
  }, approvingRequester && shortenAddress(approvingRequester)), " for ", /*#__PURE__*/React.createElement("strong", null, "30 days"), ". Choose what they can see:"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--beige)',
      marginBottom: '12px'
    }
  }, "\uD83D\uDCCB Credentials"), [{
    bit: 0,
    icon: '🎓',
    label: 'Degrees'
  }, {
    bit: 1,
    icon: '📜',
    label: 'Certifications'
  }, {
    bit: 2,
    icon: '💼',
    label: 'Work Experience'
  }, {
    bit: 3,
    icon: '🆔',
    label: 'Identity Proofs'
  }, {
    bit: 4,
    icon: '⚡',
    label: 'Skills'
  }].map(({
    bit,
    icon,
    label
  }) => /*#__PURE__*/React.createElement("label", {
    key: bit,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '10px',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selectedCredTypes[bit],
    onChange: e => setSelectedCredTypes(prev => ({
      ...prev,
      [bit]: e.target.checked
    }))
  }), /*#__PURE__*/React.createElement("span", null, icon, " ", label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--beige)',
      marginBottom: '12px'
    }
  }, "\uD83C\uDF10 Social"), [{
    bit: 0,
    icon: '⭐',
    label: 'Reviews & Reputation'
  }, {
    bit: 1,
    icon: '🚀',
    label: 'Projects'
  }, {
    bit: 2,
    icon: '👍',
    label: 'Endorsements'
  }].map(({
    bit,
    icon,
    label
  }) => /*#__PURE__*/React.createElement("label", {
    key: bit,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '10px',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selectedSocialSections[bit],
    onChange: e => setSelectedSocialSections(prev => ({
      ...prev,
      [bit]: e.target.checked
    }))
  }), /*#__PURE__*/React.createElement("span", null, icon, " ", label)))), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => setShowApproveModal(false)
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: handleApproveAccess
  }, "Approve Access")))), /*#__PURE__*/React.createElement(Modal, {
    isOpen: showBatchApproveModal,
    onClose: () => setShowBatchApproveModal(false),
    title: `Batch Approve ${selectedRequests.size} Request(s)`
  }, /*#__PURE__*/React.createElement("div", {
    className: "request-form"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--gray-light)',
      marginBottom: '20px'
    }
  }, "Approving ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: 'var(--teal-light)'
    }
  }, selectedRequests.size), " request(s) for ", /*#__PURE__*/React.createElement("strong", null, "30 days"), " in a single transaction. Choose what they can see:"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--beige)',
      marginBottom: '12px'
    }
  }, "\uD83D\uDCCB Credentials"), [{
    bit: 0,
    icon: '🎓',
    label: 'Degrees'
  }, {
    bit: 1,
    icon: '📜',
    label: 'Certifications'
  }, {
    bit: 2,
    icon: '💼',
    label: 'Work Experience'
  }, {
    bit: 3,
    icon: '🆔',
    label: 'Identity Proofs'
  }, {
    bit: 4,
    icon: '⚡',
    label: 'Skills'
  }].map(({
    bit,
    icon,
    label
  }) => /*#__PURE__*/React.createElement("label", {
    key: bit,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '10px',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selectedCredTypes[bit],
    onChange: e => setSelectedCredTypes(prev => ({
      ...prev,
      [bit]: e.target.checked
    }))
  }), /*#__PURE__*/React.createElement("span", null, icon, " ", label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--beige)',
      marginBottom: '12px'
    }
  }, "\uD83C\uDF10 Social"), [{
    bit: 0,
    icon: '⭐',
    label: 'Reviews & Reputation'
  }, {
    bit: 1,
    icon: '🚀',
    label: 'Projects'
  }, {
    bit: 2,
    icon: '👍',
    label: 'Endorsements'
  }].map(({
    bit,
    icon,
    label
  }) => /*#__PURE__*/React.createElement("label", {
    key: bit,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '10px',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: selectedSocialSections[bit],
    onChange: e => setSelectedSocialSections(prev => ({
      ...prev,
      [bit]: e.target.checked
    }))
  }), /*#__PURE__*/React.createElement("span", null, icon, " ", label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(14,116,144,0.08)',
      border: '1px solid rgba(14,116,144,0.3)',
      borderRadius: '8px',
      padding: '12px',
      fontSize: '13px',
      color: 'var(--gray-light)',
      marginBottom: '4px'
    }
  }, "This sends up to 3 transactions: one to approve identity access, one for credential permissions, one for social permissions."), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => setShowBatchApproveModal(false)
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: handleBatchApprove
  }, "Approve All Selected")))), /*#__PURE__*/React.createElement(Modal, {
    isOpen: showRequestModal,
    onClose: () => setShowRequestModal(false),
    title: "Request Access"
  }, /*#__PURE__*/React.createElement("div", {
    className: "request-form"
  }, /*#__PURE__*/React.createElement(Input, {
    label: "Token ID",
    value: requestTokenId,
    onChange: setRequestTokenId,
    placeholder: "Enter token ID",
    type: "number",
    required: true
  }), /*#__PURE__*/React.createElement("div", {
    className: "info-box"
  }, /*#__PURE__*/React.createElement("strong", null, "Note:"), " You're requesting access to view another user's identity and credentials. The owner will need to approve your request."), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => setShowRequestModal(false)
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: handleRequestAccess,
    disabled: !requestTokenId
  }, "Send Request")))), /*#__PURE__*/React.createElement(Modal, {
    isOpen: showViewModal,
    onClose: () => {
      setShowViewModal(false);
      setRepZkpStatus('idle');
      setRepZkpMessage('');
    },
    title: viewingToken ? `Token #${viewingToken.tokenId} — Identity` : 'Identity Details'
  }, viewingToken && /*#__PURE__*/React.createElement("div", {
    className: "token-view-details"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
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
    }
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDD13"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", null, "Read access granted"), viewingToken.expiresAt > 0 && ` · Expires ${formatDate(viewingToken.expiresAt)}`, ' · ', /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--gray)'
    }
  }, "Owner: "), /*#__PURE__*/React.createElement("code", {
    style: {
      color: 'var(--teal-light)',
      fontSize: '0.82rem'
    }
  }, viewingToken.owner))), /*#__PURE__*/React.createElement("div", {
    className: "detail-section"
  }, /*#__PURE__*/React.createElement("h4", null, "Profile"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '16px',
      alignItems: 'flex-start'
    }
  }, viewingToken.ipfsMetadata?.profileImage ? /*#__PURE__*/React.createElement("img", {
    src: viewingToken.ipfsMetadata.profileImage,
    alt: "Profile",
    style: {
      width: '64px',
      height: '64px',
      borderRadius: '12px',
      objectFit: 'cover',
      flexShrink: 0
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: '64px',
      height: '64px',
      borderRadius: '12px',
      flexShrink: 0,
      background: 'rgba(14,116,144,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '28px'
    }
  }, "\uD83D\uDC64"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '1.15rem',
      fontWeight: '700',
      color: 'var(--beige)',
      marginBottom: '6px'
    }
  }, viewingToken.ipfsMetadata?.name || `Token #${viewingToken.tokenId}`), viewingToken.ipfsMetadata?.bio && /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--gray-light)',
      fontSize: '0.9rem',
      lineHeight: '1.5'
    }
  }, viewingToken.ipfsMetadata.bio), !viewingToken.ipfsMetadata && /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--gray)',
      fontSize: '0.85rem'
    }
  }, "No profile metadata found on IPFS")))), viewingToken.credentials && /*#__PURE__*/React.createElement("div", {
    className: "detail-section"
  }, /*#__PURE__*/React.createElement("h4", null, "Credentials"), [{
    type: 0,
    icon: '🎓',
    label: 'Degrees'
  }, {
    type: 1,
    icon: '📜',
    label: 'Certifications'
  }, {
    type: 2,
    icon: '💼',
    label: 'Work Experience'
  }, {
    type: 3,
    icon: '🆔',
    label: 'Identity Proofs'
  }, {
    type: 4,
    icon: '⚡',
    label: 'Skills'
  }].map(({
    type,
    icon,
    label
  }) => {
    const creds = viewingToken.credentials[type] || [];
    return /*#__PURE__*/React.createElement("div", {
      key: type,
      style: {
        marginBottom: '16px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '8px',
        fontSize: '0.95rem',
        color: 'var(--beige)',
        fontWeight: '600'
      }
    }, /*#__PURE__*/React.createElement("span", null, icon), /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("span", {
      style: {
        background: creds.length > 0 ? 'rgba(14,116,144,0.2)' : 'rgba(156,163,175,0.1)',
        color: creds.length > 0 ? 'var(--teal-light)' : 'var(--gray)',
        borderRadius: '10px',
        padding: '1px 8px',
        fontSize: '0.78rem',
        fontWeight: '700'
      }
    }, creds.length)), creds.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        color: 'var(--gray)',
        fontSize: '0.82rem',
        paddingLeft: '8px'
      }
    }, "No ", label.toLowerCase(), " on record") : /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingLeft: '4px'
      }
    }, creds.map((cred, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        background: 'rgba(26,35,50,0.6)',
        borderRadius: '8px',
        padding: '12px',
        borderLeft: `3px solid ${cred.status === 0 ? 'var(--teal)' : cred.status === 1 ? 'var(--error, #ef4444)' : 'var(--gray)'}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        marginBottom: '8px',
        flexWrap: 'wrap'
      }
    }, cred.verified && /*#__PURE__*/React.createElement("span", {
      style: {
        background: 'rgba(16,185,129,0.15)',
        color: '#10b981',
        borderRadius: '4px',
        padding: '2px 8px',
        fontSize: '0.72rem',
        fontWeight: '700'
      }
    }, "\u2713 Verified"), !cred.verified && /*#__PURE__*/React.createElement("span", {
      style: {
        background: 'rgba(245,158,11,0.12)',
        color: '#f59e0b',
        borderRadius: '4px',
        padding: '2px 8px',
        fontSize: '0.72rem',
        fontWeight: '600'
      }
    }, "Self-reported"), /*#__PURE__*/React.createElement("span", {
      style: {
        background: cred.status === 0 ? 'rgba(14,116,144,0.15)' : cred.status === 1 ? 'rgba(239,68,68,0.15)' : 'rgba(156,163,175,0.15)',
        color: cred.status === 0 ? 'var(--teal-light)' : cred.status === 1 ? 'var(--error, #ef4444)' : 'var(--gray)',
        borderRadius: '4px',
        padding: '2px 8px',
        fontSize: '0.72rem'
      }
    }, cred.status === 0 ? 'Active' : cred.status === 1 ? 'Revoked' : 'Expired')), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.82rem',
        color: 'var(--gray-light)'
      }
    }, "Issuer: ", /*#__PURE__*/React.createElement("code", {
      style: {
        color: 'var(--teal-light)',
        fontSize: '0.8rem'
      }
    }, shortenAddress(cred.issuer))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.8rem',
        color: 'var(--gray)',
        marginTop: '4px',
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", null, "Issued: ", cred.issueDate > 0 ? formatDate(cred.issueDate) : '—'), /*#__PURE__*/React.createElement("span", null, "Expires: ", cred.expiryDate > 0 ? formatDate(cred.expiryDate) : 'No expiry'))))), type === 0 && (viewingToken.credentials[0] || []).some(c => c.status === 0) && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: '12px',
        background: 'rgba(26,35,50,0.6)',
        borderRadius: '10px',
        padding: '16px'
      }
    }, viewingToken.maxGpa === 0 ? /*#__PURE__*/React.createElement("p", {
      style: {
        color: 'var(--gray)',
        fontSize: '0.85rem'
      }
    }, "No GPA data available for ZK verification. Degrees must be issued via ", /*#__PURE__*/React.createElement("code", null, "addDegreeCredential"), ".") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
      style: {
        color: 'var(--text-secondary)',
        fontSize: '0.85rem',
        marginBottom: '14px'
      }
    }, "Verify this token's GPA is above a threshold. The actual GPA is not revealed."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-end',
        marginBottom: '12px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        display: 'block',
        marginBottom: '6px'
      }
    }, "Prove GPA is above"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px'
      }
    }, [200, 250, 300, 325, 350, 375].map(val => /*#__PURE__*/React.createElement("button", {
      key: val,
      onClick: () => {
        setGpaThreshold(val.toString());
        setGpaZkpStatus('idle');
        setGpaZkpMessage('');
      },
      style: {
        padding: '6px 14px',
        borderRadius: '20px',
        border: `1px solid ${gpaThreshold === val.toString() ? 'var(--teal)' : 'rgba(14,116,144,0.3)'}`,
        background: gpaThreshold === val.toString() ? 'rgba(14,116,144,0.25)' : 'transparent',
        color: gpaThreshold === val.toString() ? 'var(--teal-light)' : 'var(--gray-light)',
        fontSize: '0.85rem',
        fontWeight: gpaThreshold === val.toString() ? '700' : '400',
        cursor: 'pointer',
        transition: 'all 0.15s'
      }
    }, (val / 100).toFixed(2))))), /*#__PURE__*/React.createElement(Button, {
      onClick: () => handleVerifyGPA(viewingToken.maxGpa),
      disabled: gpaZkpStatus === 'generating' || gpaZkpStatus === 'verifying',
      style: {
        minWidth: '110px',
        height: '44px',
        flexShrink: 0
      }
    }, gpaZkpStatus === 'generating' ? 'Generating...' : gpaZkpStatus === 'verifying' ? 'Verifying...' : 'Verify GPA')), gpaZkpMessage && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 14px',
        borderRadius: '8px',
        fontSize: '0.9rem',
        fontWeight: '600',
        background: gpaZkpStatus === 'success' ? 'rgba(16,185,129,0.1)' : gpaZkpStatus === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.05)',
        border: `1px solid ${gpaZkpStatus === 'success' ? 'rgba(16,185,129,0.3)' : gpaZkpStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.2)'}`,
        color: gpaZkpStatus === 'success' ? 'var(--success)' : gpaZkpStatus === 'error' ? 'var(--error)' : 'var(--text-secondary)'
      }
    }, gpaZkpStatus === 'generating' || gpaZkpStatus === 'verifying' ? '⏳ ' : gpaZkpStatus === 'success' ? '✓ ' : '✗ ', gpaZkpMessage))), type === 0 && (viewingToken.credentials[0] || []).some(c => c.status === 0) && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: '12px',
        background: 'rgba(26,35,50,0.6)',
        borderRadius: '10px',
        padding: '16px'
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        color: 'var(--text-secondary)',
        fontSize: '0.85rem',
        marginBottom: '14px'
      }
    }, "Verify this token has an active degree in a specific field. The actual credential is not revealed."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-end',
        marginBottom: '12px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("label", {
      style: {
        fontSize: '0.78rem',
        color: 'var(--text-muted)',
        display: 'block',
        marginBottom: '6px'
      }
    }, "Prove degree in field"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px'
      }
    }, ['Arts & Humanities', 'Business & Economics', 'Law & Social Sciences', 'Education & Development', 'Health & Life Sciences', 'Science & Technology'].map((name, val) => /*#__PURE__*/React.createElement("button", {
      key: val,
      onClick: () => {
        setDegreeCatThreshold(val.toString());
        setDegreeCatZkpStatus('idle');
        setDegreeCatZkpMessage('');
      },
      style: {
        padding: '6px 14px',
        borderRadius: '20px',
        border: `1px solid ${degreeCatThreshold === val.toString() ? 'var(--teal)' : 'rgba(14,116,144,0.3)'}`,
        background: degreeCatThreshold === val.toString() ? 'rgba(14,116,144,0.25)' : 'transparent',
        color: degreeCatThreshold === val.toString() ? 'var(--teal-light)' : 'var(--gray-light)',
        fontSize: '0.82rem',
        fontWeight: degreeCatThreshold === val.toString() ? '700' : '400',
        cursor: 'pointer',
        transition: 'all 0.15s'
      }
    }, name)))), /*#__PURE__*/React.createElement(Button, {
      onClick: handleVerifyDegreeCategory,
      disabled: degreeCatZkpStatus === 'generating' || degreeCatZkpStatus === 'verifying',
      style: {
        minWidth: '110px',
        height: '44px',
        flexShrink: 0
      }
    }, degreeCatZkpStatus === 'generating' ? 'Generating...' : degreeCatZkpStatus === 'verifying' ? 'Verifying...' : 'Verify Field')), degreeCatZkpMessage && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 14px',
        borderRadius: '8px',
        fontSize: '0.9rem',
        fontWeight: '600',
        background: degreeCatZkpStatus === 'success' ? 'rgba(16,185,129,0.1)' : degreeCatZkpStatus === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.05)',
        border: `1px solid ${degreeCatZkpStatus === 'success' ? 'rgba(16,185,129,0.3)' : degreeCatZkpStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.2)'}`,
        color: degreeCatZkpStatus === 'success' ? 'var(--success)' : degreeCatZkpStatus === 'error' ? 'var(--error)' : 'var(--text-secondary)'
      }
    }, degreeCatZkpStatus === 'generating' || degreeCatZkpStatus === 'verifying' ? '⏳ ' : degreeCatZkpStatus === 'success' ? '✓ ' : '✗ ', degreeCatZkpMessage)));
  })), viewingToken.reputation !== null && viewingToken.reputation !== undefined && /*#__PURE__*/React.createElement("div", {
    className: "detail-section",
    style: {
      paddingBottom: 0,
      borderBottom: 'none'
    }
  }, /*#__PURE__*/React.createElement("h4", null, "Reputation"), viewingToken.reputation.totalReviews === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--gray)',
      fontSize: '0.88rem'
    }
  }, "No reviews yet") : /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(26,35,50,0.6)',
      borderRadius: '10px',
      padding: '16px'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.85rem',
      marginBottom: '14px'
    }
  }, "Verify this token's reputation score is above a threshold. The actual score is not revealed."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '10px',
      alignItems: 'flex-end',
      marginBottom: '12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      fontSize: '0.78rem',
      color: 'var(--text-muted)',
      display: 'block',
      marginBottom: '6px'
    }
  }, "Prove score is above"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px'
    }
  }, [10, 20, 30, 40, 50, 60, 70, 80, 90].map(val => /*#__PURE__*/React.createElement("button", {
    key: val,
    onClick: () => {
      setRepThreshold(val.toString());
      setRepZkpStatus('idle');
      setRepZkpMessage('');
    },
    style: {
      padding: '6px 14px',
      borderRadius: '20px',
      border: `1px solid ${repThreshold === val.toString() ? 'var(--teal)' : 'rgba(14,116,144,0.3)'}`,
      background: repThreshold === val.toString() ? 'rgba(14,116,144,0.25)' : 'transparent',
      color: repThreshold === val.toString() ? 'var(--teal-light)' : 'var(--gray-light)',
      fontSize: '0.85rem',
      fontWeight: repThreshold === val.toString() ? '700' : '400',
      cursor: 'pointer',
      transition: 'all 0.15s'
    }
  }, val)))), /*#__PURE__*/React.createElement(Button, {
    onClick: () => handleVerifyReputation(viewingToken.tokenId, viewingToken.reputation.averageScore),
    disabled: repZkpStatus === 'generating' || repZkpStatus === 'verifying',
    style: {
      minWidth: '100px',
      height: '44px',
      flexShrink: 0
    }
  }, repZkpStatus === 'generating' ? 'Generating...' : repZkpStatus === 'verifying' ? 'Verifying...' : 'Verify')), repZkpMessage && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      borderRadius: '8px',
      fontSize: '0.9rem',
      fontWeight: '600',
      background: repZkpStatus === 'success' ? 'rgba(16,185,129,0.1)' : repZkpStatus === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(6,182,212,0.05)',
      border: `1px solid ${repZkpStatus === 'success' ? 'rgba(16,185,129,0.3)' : repZkpStatus === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.2)'}`,
      color: repZkpStatus === 'success' ? 'var(--success)' : repZkpStatus === 'error' ? 'var(--error)' : 'var(--text-secondary)'
    }
  }, repZkpStatus === 'generating' || repZkpStatus === 'verifying' ? '⏳ ' : repZkpStatus === 'success' ? '✓ ' : '✗ ', repZkpMessage), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '10px',
      fontSize: '0.75rem',
      color: 'var(--gray)'
    }
  }, viewingToken.reputation.totalReviews, " review", viewingToken.reputation.totalReviews !== 1 ? 's' : '', " \xB7 ", viewingToken.reputation.verifiedReviews, " verified"))))), /*#__PURE__*/React.createElement("style", null, `
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
            `));
};