ViewIdentitiesTab = function ({
  contracts,
  account,
  showNotification
}) {
  const [mode, setMode] = useState('token');
  const [viewTokenId, setViewTokenId] = useState('');
  const [viewAddress, setViewAddress] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const getReadContract = () => {
    if (contracts) return contracts.soulbound;
    const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);
    return new ethers.Contract(CONFIG.CONTRACTS.SOULBOUND_IDENTITY, SOULBOUND_IDENTITY_ABI, provider);
  };
  const handleLookup = async () => {
    setLoading(true);
    setResult(null);
    try {
      const contract = getReadContract();
      if (mode === 'token') {
        if (!viewTokenId) {
          showNotification('Please enter a token ID', 'warning');
          return;
        }
        const tokenIdNum = parseInt(viewTokenId);
        const owner = await contract.ownerOf(tokenIdNum);
        let accessStatus = null;
        let isOwner = false;
        if (account) {
          isOwner = owner.toLowerCase() === account.toLowerCase();
          if (!isOwner) {
            const status = await contract.getAccessStatus(tokenIdNum, account);
            accessStatus = status; // 0=none, 1=pending, 2=approved, 3=denied
          }
        }
        setResult({
          type: 'token',
          tokenId: viewTokenId,
          owner,
          isOwner,
          accessStatus
        });
      } else {
        if (!viewAddress) {
          showNotification('Please enter an address', 'warning');
          return;
        }
        const tokens = await contract.tokensOfOwner(viewAddress);
        setResult({
          type: 'address',
          address: viewAddress,
          tokenIds: tokens.map(t => t.toString())
        });
      }
    } catch (err) {
      console.error(err);
      showNotification(mode === 'token' ? 'Token does not exist' : 'Invalid address or no tokens found', 'error');
    } finally {
      setLoading(false);
    }
  };
  const handleRequestAccess = async () => {
    if (!contracts) {
      showNotification('Connect your wallet to request access', 'warning');
      return;
    }
    setRequestingAccess(true);
    try {
      const tx = await contracts.soulbound.requestAccess(parseInt(result.tokenId));
      await tx.wait();
      showNotification('Access request sent!', 'success');
      const status = await contracts.soulbound.getAccessStatus(parseInt(result.tokenId), account);
      setResult(prev => ({
        ...prev,
        accessStatus: status
      }));
    } catch (err) {
      if (err.message?.includes('RequestAlreadyExists')) {
        showNotification('You already have a pending request', 'warning');
      } else if (err.message?.includes('TooManyRequests')) {
        showNotification('Too many requests today, try again later', 'warning');
      } else if (err.message?.includes('RequestCooldown')) {
        showNotification('Please wait before sending another request', 'warning');
      } else {
        showNotification('Failed to request access', 'error');
      }
    } finally {
      setRequestingAccess(false);
    }
  };
  const ACCESS_LABELS = {
    0: {
      text: 'No Access',
      color: 'var(--gray, #9ca3af)',
      bg: 'rgba(156,163,175,0.15)'
    },
    1: {
      text: 'Request Pending',
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.15)'
    },
    2: {
      text: 'Access Granted',
      color: 'var(--success, #10b981)',
      bg: 'rgba(16,185,129,0.15)'
    },
    3: {
      text: 'Request Denied',
      color: 'var(--error, #ef4444)',
      bg: 'rgba(239,68,68,0.15)'
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "view-identities-container"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      marginBottom: '24px',
      color: 'var(--beige, #e8dfca)'
    }
  }, "View Identities"), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      marginBottom: '24px'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => {
      setMode('token');
      setResult(null);
    },
    variant: mode === 'token' ? 'primary' : 'secondary',
    style: {
      flex: 1
    }
  }, "Search by Token ID"), /*#__PURE__*/React.createElement(Button, {
    onClick: () => {
      setMode('address');
      setResult(null);
    },
    variant: mode === 'address' ? 'primary' : 'secondary',
    style: {
      flex: 1
    }
  }, "Search by Address")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-end'
    }
  }, mode === 'token' ? /*#__PURE__*/React.createElement(Input, {
    label: "Token ID",
    value: viewTokenId,
    onChange: setViewTokenId,
    type: "number",
    placeholder: "e.g. 1, 2, 3..."
  }) : /*#__PURE__*/React.createElement(Input, {
    label: "Wallet Address",
    value: viewAddress,
    onChange: setViewAddress,
    placeholder: "0x..."
  }), /*#__PURE__*/React.createElement(Button, {
    onClick: handleLookup,
    disabled: loading || (mode === 'token' ? !viewTokenId : !viewAddress),
    style: {
      minWidth: '120px',
      height: '48px'
    }
  }, loading ? 'Looking up...' : '🔍 Look Up')), result && result.type === 'token' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '24px',
      background: 'var(--bg-tertiary)',
      padding: '20px',
      borderRadius: '12px',
      borderLeft: '4px solid var(--teal)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.85rem',
      color: 'var(--text-secondary)',
      marginBottom: '6px'
    }
  }, "Token #", result.tokenId, " \u2014 Owner"), /*#__PURE__*/React.createElement("code", {
    style: {
      color: 'var(--teal-light)',
      fontSize: '1rem',
      wordBreak: 'break-all'
    }
  }, result.owner), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '16px'
    }
  }, result.isOwner ? /*#__PURE__*/React.createElement("span", {
    style: {
      background: 'rgba(16,185,129,0.15)',
      color: 'var(--success, #10b981)',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '0.85rem',
      fontWeight: 600
    }
  }, "\u2713 Your token") : account ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap'
    }
  }, result.accessStatus !== null && (() => {
    const label = ACCESS_LABELS[result.accessStatus] || ACCESS_LABELS[0];
    return /*#__PURE__*/React.createElement("span", {
      style: {
        background: label.bg,
        color: label.color,
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '0.85rem',
        fontWeight: 600
      }
    }, label.text);
  })(), (result.accessStatus === 0 || result.accessStatus === 3) && /*#__PURE__*/React.createElement(Button, {
    onClick: handleRequestAccess,
    disabled: requestingAccess,
    variant: "secondary",
    style: {
      padding: '6px 16px',
      fontSize: '0.85rem'
    }
  }, requestingAccess ? 'Requesting...' : 'Request Access')) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.85rem'
    }
  }, "Connect your wallet to check or request access."))), result && result.type === 'address' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '24px',
      background: 'var(--bg-tertiary)',
      padding: '20px',
      borderRadius: '12px',
      borderLeft: '4px solid var(--teal)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.85rem',
      color: 'var(--text-secondary)',
      marginBottom: '12px'
    }
  }, result.tokenIds.length === 0 ? 'This address owns no tokens' : `This address owns ${result.tokenIds.length} token${result.tokenIds.length > 1 ? 's' : ''}`), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px'
    }
  }, result.tokenIds.map(id => /*#__PURE__*/React.createElement("span", {
    key: id,
    title: "Click to look up this token",
    onClick: () => {
      setMode('token');
      setViewTokenId(id);
      setResult(null);
    },
    style: {
      background: 'var(--bg-secondary)',
      color: 'var(--teal-light)',
      padding: '4px 12px',
      borderRadius: '20px',
      fontSize: '0.95rem',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'opacity 0.15s'
    },
    onMouseEnter: e => e.target.style.opacity = '0.75',
    onMouseLeave: e => e.target.style.opacity = '1'
  }, "#", id))), result.tokenIds.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '10px',
      fontSize: '0.8rem',
      color: 'var(--text-secondary)'
    }
  }, "Click a token to look it up")), !loading && !result && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '40px',
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '4rem',
      marginBottom: '16px'
    }
  }, "\uD83D\uDD0D"), /*#__PURE__*/React.createElement("p", null, mode === 'token' ? 'Enter a token ID to see its owner and your access status' : 'Enter an address to see its token IDs'))));
};

// ============================================

// ============================================
// ROOT APP WRAPPER WITH PROVIDERS
// ============================================

console.log('✅ All components loaded globally');