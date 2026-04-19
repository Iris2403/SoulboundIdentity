TokenCard = function ({
  token,
  isSelected,
  onSelect,
  contracts,
  onBurned
}) {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);
  const [burning, setBurning] = useState(false);
  const {
    addToast
  } = useToast();
  useEffect(() => {
    loadMetadata();
  }, [token.cid]);
  const loadMetadata = async () => {
    try {
      const response = await fetch(`${CONFIG.IPFS_GATEWAY}${token.cid}`);
      if (!response.ok) throw new Error('Failed to fetch metadata from IPFS');
      const data = await response.json();
      setMetadata(data);
    } catch (error) {
      console.error('Error loading metadata:', error);
      setMetadata({
        name: `Token #${token.id}`,
        bio: '',
        profileImage: ''
      });
    } finally {
      setLoading(false);
    }
  };
  const copyToClipboard = text => {
    navigator.clipboard.writeText(text);
    addToast('Copied to clipboard!', 'success');
  };
  const handleBurnToken = async () => {
    try {
      console.log('🔥 Burning token:', token.id);
      setBurning(true);
      const tx = await contracts.soulbound.burn(token.id);
      console.log('⏳ Burn transaction hash:', tx.hash);
      await tx.wait();
      console.log('✅ Token burned successfully');
      setShowBurnConfirm(false);
      setShowDetails(false);
      if (onBurned) onBurned(token.id);
    } catch (error) {
      console.error('❌ Error burning token:', error);
      addToast('Failed to burn token: ' + (error.message || 'Unknown error'), 'error');
    } finally {
      setBurning(false);
    }
  };
  if (loading) {
    return /*#__PURE__*/React.createElement(Card, {
      className: `token-card ${isSelected ? 'selected' : ''}`
    }, /*#__PURE__*/React.createElement(LoadingSpinner, null));
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
    className: `token-card ${isSelected ? 'selected' : ''}`,
    onClick: onSelect
  }, /*#__PURE__*/React.createElement("div", {
    className: "token-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "token-info-col"
  }, /*#__PURE__*/React.createElement("div", {
    className: "token-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "token-avatar"
  }, metadata?.profileImage ? /*#__PURE__*/React.createElement("img", {
    src: metadata.profileImage,
    alt: "Profile"
  }) : /*#__PURE__*/React.createElement("div", {
    className: "avatar-placeholder"
  }, "\uD83D\uDC64")), /*#__PURE__*/React.createElement("div", {
    className: "token-meta"
  }, /*#__PURE__*/React.createElement("h3", null, metadata?.name || `Token #${token.id}`), /*#__PURE__*/React.createElement("span", {
    className: "token-id"
  }, "ID: ", token.id))), metadata?.bio && /*#__PURE__*/React.createElement("p", {
    className: "token-bio"
  }, metadata.bio), /*#__PURE__*/React.createElement("div", {
    className: "token-cid"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cid-label"
  }, "IPFS CID:"), /*#__PURE__*/React.createElement("code", {
    className: "cid-value"
  }, token.cid.substring(0, 20), "...")), /*#__PURE__*/React.createElement("div", {
    className: "token-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "view-details-btn",
    onClick: e => {
      e.stopPropagation();
      setShowDetails(true);
    }
  }, "\uD83D\uDC41\uFE0F View Details"), /*#__PURE__*/React.createElement("button", {
    className: "invalidate-btn",
    onClick: e => {
      e.stopPropagation();
      setShowBurnConfirm(true);
    }
  }, "Invalidate"))), /*#__PURE__*/React.createElement("div", {
    className: "token-qr-col",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement(QRCodeDisplay, {
    tokenId: token.id,
    contractAddress: CONFIG.CONTRACTS.SOULBOUND_IDENTITY,
    size: 160
  }))), isSelected && /*#__PURE__*/React.createElement("div", {
    className: "selected-badge"
  }, "\u2713 Selected")), /*#__PURE__*/React.createElement(Modal, {
    isOpen: showDetails,
    onClose: () => setShowDetails(false),
    title: `Token #${token.id} Details`
  }, /*#__PURE__*/React.createElement("div", {
    className: "token-details"
  }, /*#__PURE__*/React.createElement("div", {
    className: "detail-section"
  }, /*#__PURE__*/React.createElement("h4", null, "Token Information"), /*#__PURE__*/React.createElement("div", {
    className: "detail-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "detail-label"
  }, "Token ID:"), /*#__PURE__*/React.createElement("span", {
    className: "detail-value"
  }, token.id)), /*#__PURE__*/React.createElement("div", {
    className: "detail-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "detail-label"
  }, "Name:"), /*#__PURE__*/React.createElement("span", {
    className: "detail-value"
  }, metadata?.name)), /*#__PURE__*/React.createElement("div", {
    className: "detail-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "detail-label"
  }, "Type:"), /*#__PURE__*/React.createElement("span", {
    className: "detail-value"
  }, "Soulbound Token (Non-transferable)")), /*#__PURE__*/React.createElement("div", {
    className: "detail-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "detail-label"
  }, "Status:"), /*#__PURE__*/React.createElement("span", {
    className: "detail-value",
    style: {
      color: isSelected ? 'var(--teal-light)' : 'var(--gray)'
    }
  }, isSelected ? '✓ Currently Selected' : 'Not Selected'))), /*#__PURE__*/React.createElement("div", {
    className: "detail-section"
  }, /*#__PURE__*/React.createElement("h4", null, "Biography"), /*#__PURE__*/React.createElement("p", {
    className: "bio-full"
  }, metadata?.bio)), /*#__PURE__*/React.createElement("div", {
    className: "detail-section"
  }, /*#__PURE__*/React.createElement("h4", null, "IPFS Metadata"), /*#__PURE__*/React.createElement("div", {
    className: "cid-display"
  }, /*#__PURE__*/React.createElement("code", {
    className: "full-cid"
  }, token.cid), /*#__PURE__*/React.createElement("button", {
    className: "copy-btn",
    onClick: () => copyToClipboard(token.cid)
  }, "\uD83D\uDCCB Copy")), /*#__PURE__*/React.createElement("a", {
    href: `https://gateway.pinata.cloud/ipfs/${token.cid}`,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "ipfs-link"
  }, "\uD83D\uDD17 View on IPFS Gateway")), /*#__PURE__*/React.createElement("div", {
    className: "detail-section"
  }, /*#__PURE__*/React.createElement("h4", null, "Blockchain Information"), /*#__PURE__*/React.createElement("div", {
    className: "detail-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "detail-label"
  }, "Contract:"), /*#__PURE__*/React.createElement("code", {
    className: "detail-value"
  }, CONFIG.CONTRACTS.SOULBOUND_IDENTITY)), /*#__PURE__*/React.createElement("div", {
    className: "detail-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "detail-label"
  }, "Network:"), /*#__PURE__*/React.createElement("span", {
    className: "detail-value"
  }, CONFIG.NETWORK_NAME)), /*#__PURE__*/React.createElement("div", {
    className: "detail-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "detail-label"
  }, "Chain ID:"), /*#__PURE__*/React.createElement("span", {
    className: "detail-value"
  }, CONFIG.CHAIN_ID))), !isSelected && /*#__PURE__*/React.createElement("div", {
    className: "modal-actions",
    style: {
      marginTop: '24px'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => {
      onSelect();
      setShowDetails(false);
    }
  }, "Select This Token")), /*#__PURE__*/React.createElement("div", {
    className: "danger-zone",
    style: {
      marginTop: '32px',
      padding: '20px',
      background: 'rgba(239, 68, 68, 0.1)',
      borderRadius: '12px',
      border: '1px solid rgba(239, 68, 68, 0.3)'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--error)',
      marginBottom: '12px',
      fontSize: '1rem'
    }
  }, "\u26A0\uFE0F Danger Zone"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.9rem',
      marginBottom: '16px'
    }
  }, "Permanently invalidate this identity token and all associated access data. This action cannot be undone."), /*#__PURE__*/React.createElement(Button, {
    variant: "danger",
    onClick: () => setShowBurnConfirm(true),
    disabled: burning
  }, "Invalidate Token"))), /*#__PURE__*/React.createElement("style", null, `
                    .token-details {
                        display: flex;
                        flex-direction: column;
                        gap: 24px;
                    }

                    .detail-section {
                        border-bottom: 1px solid rgba(14, 116, 144, 0.2);
                        padding-bottom: 20px;
                    }

                    .detail-section:last-child {
                        border-bottom: none;
                        padding-bottom: 0;
                    }

                    .detail-section h4 {
                        color: var(--teal-light);
                        font-size: 16px;
                        margin-bottom: 12px;
                    }

                    .detail-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 8px 0;
                        gap: 16px;
                    }

                    .detail-label {
                        color: var(--gray);
                        font-size: 14px;
                        font-weight: 500;
                    }

                    .detail-value {
                        color: var(--beige);
                        font-size: 14px;
                        text-align: right;
                        word-break: break-word;
                    }

                    code.detail-value {
                        color: var(--teal-light);
                        font-family: monospace;
                        font-size: 12px;
                    }

                    .bio-full {
                        color: var(--gray-light);
                        font-size: 14px;
                        line-height: 1.6;
                    }

                    .cid-display {
                        display: flex;
                        gap: 12px;
                        align-items: center;
                        background: rgba(26, 35, 50, 0.5);
                        padding: 12px;
                        border-radius: 8px;
                        margin-bottom: 12px;
                    }

                    .full-cid {
                        flex: 1;
                        color: var(--teal-light);
                        font-family: monospace;
                        font-size: 12px;
                        word-break: break-all;
                    }

                    .copy-btn {
                        background: var(--teal);
                        border: none;
                        color: white;
                        padding: 6px 12px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 12px;
                        white-space: nowrap;
                        transition: all 0.3s ease;
                    }

                    .copy-btn:hover {
                        background: var(--teal-light);
                        transform: translateY(-1px);
                    }

                    .ipfs-link {
                        display: inline-block;
                        color: var(--sky);
                        text-decoration: none;
                        font-size: 14px;
                        transition: color 0.3s ease;
                    }

                    .ipfs-link:hover {
                        color: var(--sky-light);
                        text-decoration: underline;
                    }
                `)), /*#__PURE__*/React.createElement(Modal, {
    isOpen: showBurnConfirm,
    onClose: () => setShowBurnConfirm(false),
    title: "\u26A0\uFE0F Confirm Token Invalidation"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(239, 68, 68, 0.1)',
      padding: '16px',
      borderRadius: '8px',
      marginBottom: '20px',
      border: '1px solid rgba(239, 68, 68, 0.3)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--error)',
      fontWeight: '600',
      marginBottom: '8px'
    }
  }, "\u26A0\uFE0F WARNING: This action is PERMANENT and IRREVERSIBLE"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      fontSize: '0.9rem'
    }
  }, "You are about to permanently invalidate Token #", token.id, ". This will:")), /*#__PURE__*/React.createElement("ul", {
    style: {
      color: 'var(--text-secondary)',
      marginLeft: '20px',
      marginBottom: '24px',
      lineHeight: '1.8'
    }
  }, /*#__PURE__*/React.createElement("li", null, "Invalidate the identity token on the blockchain"), /*#__PURE__*/React.createElement("li", null, "Remove all associated access permissions"), /*#__PURE__*/React.createElement("li", null, "Clear all pending access requests"), /*#__PURE__*/React.createElement("li", null, "Remove the token from your wallet permanently")), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-primary)',
      fontWeight: '600',
      marginBottom: '24px',
      fontSize: '1.1rem'
    }
  }, "Are you absolutely sure you want to invalidate this identity?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => setShowBurnConfirm(false),
    disabled: burning
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    variant: "danger",
    onClick: handleBurnToken,
    disabled: burning
  }, burning ? 'Invalidating...' : 'Yes, Invalidate Token')))), /*#__PURE__*/React.createElement("style", null, `
                .token-card {
                    cursor: pointer;
                    position: relative;
                    transition: all 0.3s ease;
                }

                .token-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 24px rgba(14, 116, 144, 0.2);
                }

                .token-card.selected {
                    border-color: var(--teal-light);
                    box-shadow: 0 0 0 2px rgba(14, 116, 144, 0.3);
                }

                /* ── Side-by-side layout ── */
                .token-body {
                    display: flex;
                    gap: 0;
                    align-items: stretch;
                }

                .token-info-col {
                    flex: 1;
                    min-width: 0;
                    padding-right: 20px;
                    border-right: 1px solid rgba(14, 116, 144, 0.2);
                    display: flex;
                    flex-direction: column;
                }

                .token-qr-col {
                    flex-shrink: 0;
                    padding-left: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .token-header {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 16px;
                }

                .token-avatar {
                    width: 52px;
                    height: 52px;
                    border-radius: 10px;
                    overflow: hidden;
                    background: rgba(14, 116, 144, 0.2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .token-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .avatar-placeholder {
                    font-size: 28px;
                }

                .token-meta {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    min-width: 0;
                }

                .token-meta h3 {
                    font-size: 17px;
                    color: var(--beige);
                    margin-bottom: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .token-id {
                    font-size: 12px;
                    color: var(--gray);
                    font-family: monospace;
                }

                .token-bio {
                    color: var(--gray-light);
                    font-size: 13px;
                    line-height: 1.5;
                    margin-bottom: 14px;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    flex: 1;
                }

                .token-cid {
                    background: rgba(26, 35, 50, 0.5);
                    border-radius: 6px;
                    padding: 7px 10px;
                    font-size: 11px;
                    margin-bottom: 14px;
                }

                .cid-label {
                    color: var(--gray);
                    margin-right: 6px;
                }

                .cid-value {
                    color: var(--teal-light);
                    font-family: monospace;
                }

                .token-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: auto;
                }

                .view-details-btn {
                    flex: 1;
                    padding: 10px;
                    background: var(--teal);
                    border: none;
                    color: white;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }

                .view-details-btn:hover {
                    background: var(--teal-light);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(14, 116, 144, 0.4);
                }

                .invalidate-btn {
                    padding: 10px 14px;
                    background: transparent;
                    border: 1px solid rgba(239, 68, 68, 0.5);
                    color: var(--error, #ef4444);
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    transition: all 0.3s ease;
                    white-space: nowrap;
                }

                .invalidate-btn:hover {
                    background: rgba(239, 68, 68, 0.1);
                    border-color: var(--error, #ef4444);
                    transform: translateY(-1px);
                }

                .selected-badge {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: var(--teal);
                    color: white;
                    padding: 3px 10px;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: 600;
                }

                @media (max-width: 600px) {
                    .token-body {
                        flex-direction: column;
                    }

                    .token-info-col {
                        padding-right: 0;
                        border-right: none;
                        border-bottom: 1px solid rgba(14, 116, 144, 0.2);
                        padding-bottom: 20px;
                    }

                    .token-qr-col {
                        padding-left: 0;
                        padding-top: 20px;
                    }
                }
            `));
};