CredentialsTab = function ({
  contracts,
  selectedToken,
  userTokens,
  showNotification,
  account
}) {
  // State management
  const [credentials, setCredentials] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedType, setSelectedType] = useState(0);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [credentialCounts, setCredentialCounts] = useState({});
  const [validationStatus, setValidationStatus] = useState({});
  const [selectedSkillCategory, setSelectedSkillCategory] = useState(null);
  const [validatingIds, setValidatingIds] = useState({});
  const [showValidateModal, setShowValidateModal] = useState(false);
  const getValidatedKey = () => `sbi_validated_${selectedToken}`;
  const loadValidatedFromStorage = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem(getValidatedKey()) || '[]'));
    } catch {
      return new Set();
    }
  };
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

  // Helper function to get credential status info
  const getCredentialStatusInfo = status => {
    const statusMap = {
      0: {
        label: 'Active',
        color: 'var(--success)',
        icon: '🟢',
        bg: 'rgba(16, 185, 129, 0.1)'
      },
      1: {
        label: 'Revoked',
        color: 'var(--error)',
        icon: '🔴',
        bg: 'rgba(239, 68, 68, 0.1)'
      },
      2: {
        label: 'Expired',
        color: 'var(--text-muted)',
        icon: '⚫',
        bg: 'rgba(107, 117, 137, 0.1)'
      }
    };
    return statusMap[status] || statusMap[0];
  };

  // Helper to get skill category info with colors
  const getSkillCategoryInfo = category => {
    const categoryMap = {
      0: {
        label: 'Technical',
        icon: '💻',
        color: '#667eea'
      },
      1: {
        label: 'Soft',
        icon: '🤝',
        color: '#f093fb'
      },
      2: {
        label: 'Language',
        icon: '🌍',
        color: '#4facfe'
      },
      3: {
        label: 'Domain',
        icon: '🎯',
        color: '#43e97b'
      },
      4: {
        label: 'Tool',
        icon: '🔧',
        color: '#fa709a'
      },
      5: {
        label: 'Other',
        icon: '📦',
        color: '#a8b2c1'
      }
    };
    return categoryMap[category] || categoryMap[5];
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
  const isApproachingLimit = type => {
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

      // Credentials start as invalid until explicitly validated by the user
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

  // Validate a credential on the network
  const handleValidateCredential = async credentialId => {
    const idKey = credentialId.toString();
    try {
      setValidatingIds(prev => ({
        ...prev,
        [idKey]: true
      }));
      const tx = await contracts.credentials.updateCredentialStatus(selectedToken, credentialId);
      showNotification('Validating credential on network...', 'info');
      await tx.wait();
      showNotification('✅ Credential validated successfully!', 'success');
      const validated = loadValidatedFromStorage();
      validated.add(idKey);
      localStorage.setItem(getValidatedKey(), JSON.stringify([...validated]));
      setValidationStatus(prev => ({
        ...prev,
        [idKey]: true
      }));
    } catch (error) {
      console.error('Error validating credential:', error);
      showNotification(error.message || 'Failed to validate credential', 'error');
    } finally {
      setValidatingIds(prev => ({
        ...prev,
        [idKey]: false
      }));
    }
  };

  // Add self-reported credential with limit check
  const handleAddCredential = async () => {
    try {
      console.log('🔵 Starting credential add...', {
        selectedToken,
        credentialData
      });
      if (!credentialData.institution || !credentialData.title) {
        showNotification('Please fill in all required fields', 'error');
        return;
      }

      // Guard: ensure the selected token belongs to the connected wallet
      const isOwnToken = userTokens.some(t => t.id === selectedToken);
      if (!isOwnToken) {
        showNotification('You do not own this identity token. Please select your token from the Identity tab.', 'error');
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
      const issueDateMs = credentialData.issueDate ? new Date(credentialData.issueDate).getTime() : Date.now();
      const issueDate = isNaN(issueDateMs) || issueDateMs <= 0 ? Math.floor(Date.now() / 1000) : Math.floor(issueDateMs / 1000);
      const expiryDateMs = credentialData.expiryDate ? new Date(credentialData.expiryDate).getTime() : 0;
      const expiryDate = expiryDateMs && !isNaN(expiryDateMs) && expiryDateMs > 0 ? Math.floor(expiryDateMs / 1000) : 0;
      if (expiryDate !== 0 && expiryDate <= issueDate) {
        showNotification('Expiry date must be after issue date!', 'error');
        setLoading(false);
        return;
      }
      const tx = await contracts.credentials.addCredential(selectedToken, parseInt(credentialData.credType), metadataHash, issueDate, expiryDate, parseInt(credentialData.category));
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
      const errName = error.errorName || error.data?.errorName || '';
      const errMsg = error.message || '';
      let message;
      if (error.code === 'ACTION_REJECTED' || errMsg.includes('user rejected')) {
        message = 'Transaction was rejected by wallet';
      } else if (errName === 'InvalidParameter' || errMsg.includes('InvalidParameter')) {
        message = 'Invalid parameters: please ensure all fields are filled in correctly and the issue date is valid';
      } else if (errName === 'TooManyCredentials' || errMsg.includes('TooManyCredentials')) {
        message = `❌ Maximum limit reached (${MAX_CREDENTIALS_PER_TYPE} credentials per type)`;
      } else if (errName === 'InvalidDates' || errMsg.includes('InvalidDates')) {
        message = 'Invalid dates: expiry date must be after issue date';
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
  const handleUpdateStatus = async credentialId => {
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
  const handleRevoke = async credId => {
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
    return /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      className: "empty-state"
    }, /*#__PURE__*/React.createElement("div", {
      className: "empty-icon"
    }, "\uD83D\uDCDC"), /*#__PURE__*/React.createElement("h3", null, "No Token Selected"), /*#__PURE__*/React.createElement("p", null, "Select a token from the Identity tab to manage credentials")));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "credentials-tab"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tab-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "Credentials"), /*#__PURE__*/React.createElement("p", {
    className: "tab-description"
  }, "Manage your professional credentials and achievements")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    onClick: () => setShowAddModal(true),
    variant: "secondary"
  }, "\u2795 Add Credential"), (() => {
    const invalidCount = Object.values(validationStatus).filter(v => v === false).length;
    return invalidCount > 0 ? /*#__PURE__*/React.createElement(Button, {
      onClick: () => setShowValidateModal(true),
      variant: "secondary",
      style: {
        background: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'var(--error)',
        color: 'var(--error)'
      }
    }, "\uD83D\uDD0D Validate Credentials (", invalidCount, ")") : null;
  })())), summary && /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: '24px',
      marginTop: '32px'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '16px',
      color: 'var(--teal-light)'
    }
  }, "\uD83D\uDCCA Credential Summary"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '16px'
    }
  }, [{
    key: 'degrees',
    icon: '🎓',
    type: 0,
    color: 'rgba(102, 126, 234, 0.1)'
  }, {
    key: 'certifications',
    icon: '📜',
    type: 1,
    color: 'rgba(14, 165, 233, 0.1)'
  }, {
    key: 'workExperience',
    icon: '💼',
    type: 2,
    color: 'rgba(6, 182, 212, 0.1)'
  }, {
    key: 'identityProofs',
    icon: '🆔',
    type: 3,
    color: 'rgba(240, 147, 251, 0.1)'
  }, {
    key: 'skills',
    icon: '⚡',
    type: 4,
    color: 'rgba(42, 245, 152, 0.1)'
  }].map(({
    key,
    icon,
    type,
    color
  }) => {
    const count = summary[key];
    const isNearLimit = count >= MAX_CREDENTIALS_PER_TYPE * WARNING_THRESHOLD;
    return /*#__PURE__*/React.createElement("div", {
      key: key,
      style: {
        textAlign: 'center',
        padding: '16px',
        background: color,
        borderRadius: '12px',
        position: 'relative',
        border: isNearLimit ? '2px solid var(--warning)' : 'none'
      }
    }, isNearLimit && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: '8px',
        right: '8px',
        width: '8px',
        height: '8px',
        background: 'var(--warning)',
        borderRadius: '50%',
        animation: 'pulse 2s infinite'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '2rem'
      }
    }, icon), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '1.5rem',
        fontWeight: 'bold',
        color: isNearLimit ? 'var(--warning)' : 'var(--teal-light)'
      }
    }, count), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.9rem',
        color: 'var(--text-secondary)'
      }
    }, credentialTypes[type]), isNearLimit && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.75rem',
        color: 'var(--warning)',
        marginTop: '4px',
        fontWeight: '600'
      }
    }, "\u26A0\uFE0F Near Limit"));
  }))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '20px',
      flexWrap: 'wrap',
      gap: '16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      flex: 1
    }
  }, credentialTypes.map((type, idx) => {
    const count = credentialCounts[idx] || 0;
    const isNearLimit = count >= MAX_CREDENTIALS_PER_TYPE * WARNING_THRESHOLD;
    return /*#__PURE__*/React.createElement("button", {
      key: idx,
      className: `filter-btn ${selectedType === idx ? 'active' : ''}`,
      onClick: () => {
        setSelectedType(idx);
        setSelectedSkillCategory(null);
      },
      style: {
        position: 'relative',
        padding: '8px 16px',
        border: selectedType === idx ? isNearLimit ? '2px solid var(--warning)' : '2px solid var(--teal)' : '1px solid var(--border-color)',
        background: selectedType === idx ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
        color: selectedType === idx ? 'var(--teal-light)' : 'var(--text-secondary)',
        borderRadius: '20px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: selectedType === idx ? '600' : '400',
        transition: 'all 0.3s'
      }
    }, type, /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: '6px',
        background: selectedType === idx ? isNearLimit ? 'var(--warning)' : 'rgba(255,255,255,0.3)' : 'var(--teal)',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        color: selectedType === idx ? isNearLimit ? 'white' : 'var(--teal-light)' : 'white'
      }
    }, count), isNearLimit && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: '-4px',
        right: '-4px',
        fontSize: '0.7rem'
      }
    }, "\u26A0\uFE0F"));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'var(--bg-tertiary)',
      padding: '8px 16px',
      borderRadius: '24px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.9rem',
      color: 'var(--text-secondary)'
    }
  }, "Show:"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowActiveOnly(false),
    style: {
      background: !showActiveOnly ? 'var(--gradient-teal)' : 'transparent',
      border: 'none',
      color: !showActiveOnly ? 'white' : 'var(--text-secondary)',
      padding: '6px 16px',
      borderRadius: '16px',
      cursor: 'pointer',
      fontSize: '0.85rem',
      fontWeight: '600',
      transition: 'all 0.3s'
    }
  }, "All"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowActiveOnly(true),
    style: {
      background: showActiveOnly ? 'var(--gradient-teal)' : 'transparent',
      border: 'none',
      color: showActiveOnly ? 'white' : 'var(--text-secondary)',
      padding: '6px 16px',
      borderRadius: '16px',
      cursor: 'pointer',
      fontSize: '0.85rem',
      fontWeight: '600',
      transition: 'all 0.3s'
    }
  }, "\uD83D\uDFE2 Active Only"))), selectedType === 4 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '20px',
      paddingTop: '16px',
      borderTop: '1px solid rgba(6, 182, 212, 0.2)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.9rem',
      color: 'var(--text-secondary)',
      marginBottom: '12px',
      fontWeight: '600'
    }
  }, "Filter by Category:"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setSelectedSkillCategory(null),
    style: {
      padding: '6px 14px',
      border: selectedSkillCategory === null ? '2px solid var(--teal)' : '1px solid var(--border-color)',
      background: selectedSkillCategory === null ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
      color: selectedSkillCategory === null ? 'var(--teal-light)' : 'var(--text-secondary)',
      borderRadius: '16px',
      cursor: 'pointer',
      fontSize: '0.85rem',
      fontWeight: selectedSkillCategory === null ? '600' : '400',
      transition: 'all 0.3s'
    }
  }, "All Categories"), skillCategories.map((cat, idx) => {
    const catInfo = getSkillCategoryInfo(idx);
    return /*#__PURE__*/React.createElement("button", {
      key: idx,
      onClick: () => setSelectedSkillCategory(idx),
      style: {
        padding: '6px 14px',
        border: selectedSkillCategory === idx ? `2px solid ${catInfo.color}` : '1px solid var(--border-color)',
        background: selectedSkillCategory === idx ? `${catInfo.color}15` : 'transparent',
        color: selectedSkillCategory === idx ? catInfo.color : 'var(--text-secondary)',
        borderRadius: '16px',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: selectedSkillCategory === idx ? '600' : '400',
        transition: 'all 0.3s',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }
    }, /*#__PURE__*/React.createElement("span", null, catInfo.icon), cat);
  }))), isApproachingLimit(selectedType) && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(245, 158, 11, 0.1)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      borderRadius: '8px',
      padding: '12px 16px',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '1.2rem'
    }
  }, "\u26A0\uFE0F"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: '600',
      color: 'var(--warning)'
    }
  }, "Approaching Credential Limit"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.9rem',
      color: 'var(--text-secondary)',
      marginTop: '4px'
    }
  }, "You have ", credentialCounts[selectedType] || 0, "/", MAX_CREDENTIALS_PER_TYPE, " ", credentialTypes[selectedType], " credentials. Consider revoking unused credentials."))), loading ? /*#__PURE__*/React.createElement(LoadingSpinner, null) : credentials.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "empty-message",
    style: {
      textAlign: 'center',
      padding: '40px'
    }
  }, /*#__PURE__*/React.createElement("p", null, "No ", showActiveOnly ? 'active ' : '', selectedType === 4 && selectedSkillCategory !== null ? `${skillCategories[selectedSkillCategory]} ` : '', credentialTypes[selectedType].toLowerCase(), " credentials yet")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }
  }, credentials.map((cred, idx) => {
    const statusInfo = getCredentialStatusInfo(cred.status);
    const isValid = validationStatus[cred.credentialId.toString()];
    const isExpired = cred.expiryDate > 0 && Math.floor(Date.now() / 1000) >= cred.expiryDate.toNumber();
    const isValidating = validatingIds[cred.credentialId.toString()];
    const catInfo = selectedType === 4 ? getSkillCategoryInfo(cred.category) : null;
    return /*#__PURE__*/React.createElement("div", {
      key: idx,
      style: {
        background: 'var(--bg-tertiary)',
        padding: '20px',
        borderRadius: '12px',
        borderLeft: `4px solid ${statusInfo.color}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '12px',
        flexWrap: 'wrap',
        gap: '12px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '1.1rem',
        fontWeight: '600',
        color: 'var(--teal-light)',
        marginBottom: '8px'
      }
    }, credentialTypes[cred.credType]), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.85rem',
        color: 'var(--text-secondary)'
      }
    }, "ID: ", cred.credentialId.toString())), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: '600',
        background: cred.verified ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.15)',
        color: cred.verified ? 'var(--success)' : '#3b82f6'
      }
    }, cred.verified ? '✅ Verified' : '⚠️ Self-Reported'), /*#__PURE__*/React.createElement("span", {
      style: {
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: '600',
        background: statusInfo.bg,
        color: statusInfo.color
      }
    }, statusInfo.icon, " ", statusInfo.label), isValid !== undefined && /*#__PURE__*/React.createElement("span", {
      style: {
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: '600',
        background: isValid ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
        color: isValid ? 'var(--success)' : 'var(--error)'
      }
    }, isValid ? '✓ Valid' : '✗ Invalid'), selectedType === 4 && catInfo && /*#__PURE__*/React.createElement("span", {
      style: {
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '0.8rem',
        fontWeight: '600',
        background: `${catInfo.color}20`,
        color: catInfo.color,
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }
    }, catInfo.icon, " ", catInfo.label))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid rgba(6, 182, 212, 0.2)'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        marginBottom: '4px'
      }
    }, "Issuer"), /*#__PURE__*/React.createElement("code", {
      style: {
        fontSize: '0.85rem',
        color: 'var(--teal-light)'
      }
    }, shortenAddress(cred.issuer))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        marginBottom: '4px'
      }
    }, "Issue Date"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.9rem'
      }
    }, formatDate(cred.issueDate))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        marginBottom: '4px'
      }
    }, "Expiry"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.9rem',
        color: isExpired ? 'var(--error)' : 'inherit'
      }
    }, cred.expiryDate.toNumber() === 0 ? 'Never' : formatDate(cred.expiryDate))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        marginBottom: '4px'
      }
    }, "Metadata Hash"), /*#__PURE__*/React.createElement("code", {
      style: {
        fontSize: '0.75rem',
        color: 'var(--teal-light)',
        wordBreak: 'break-all'
      }
    }, cred.metadataHash.slice(0, 20), "..."))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: '8px',
        marginTop: '16px',
        flexWrap: 'wrap'
      }
    }, !isValid && cred.status === 0 && /*#__PURE__*/React.createElement(Button, {
      onClick: () => handleValidateCredential(cred.credentialId),
      disabled: validatingIds[cred.credentialId.toString()],
      style: {
        fontSize: '0.85rem',
        padding: '6px 12px',
        background: 'linear-gradient(135deg, #667eea, #4facfe)',
        border: 'none',
        color: 'white',
        opacity: validatingIds[cred.credentialId.toString()] ? 0.7 : 1
      }
    }, validatingIds[cred.credentialId.toString()] ? '⏳ Validating...' : '🔍 Validate'), isExpired && cred.status === 0 && /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: () => handleUpdateStatus(cred.credentialId),
      style: {
        fontSize: '0.85rem',
        padding: '6px 12px'
      }
    }, "\uD83D\uDD04 Update to Expired"), cred.status === 0 && /*#__PURE__*/React.createElement(Button, {
      variant: "danger",
      onClick: () => handleRevoke(cred.credentialId),
      style: {
        fontSize: '0.85rem',
        padding: '6px 12px'
      }
    }, "Revoke")));
  }))), /*#__PURE__*/React.createElement(Modal, {
    isOpen: showValidateModal,
    onClose: () => setShowValidateModal(false),
    title: "\uD83D\uDD0D Validate Credentials"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-secondary)',
      marginBottom: '20px',
      fontSize: '0.95rem'
    }
  }, "Newly added credentials start as invalid. Select one below to validate it on-chain."), credentials.filter(c => validationStatus[c.credentialId.toString()] === false).length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '30px',
      color: 'var(--text-secondary)'
    }
  }, /*#__PURE__*/React.createElement("p", null, "No invalid credentials in the current view."), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '0.85rem',
      marginTop: '8px'
    }
  }, "Switch credential type using the filters to find others.")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }
  }, credentials.filter(c => validationStatus[c.credentialId.toString()] === false).map((cred, idx) => /*#__PURE__*/React.createElement("div", {
    key: idx,
    style: {
      background: 'var(--bg-tertiary)',
      padding: '16px',
      borderRadius: '10px',
      borderLeft: '4px solid var(--error)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: '600',
      color: 'var(--teal-light)',
      marginBottom: '4px'
    }
  }, credentialTypes[cred.credType]), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.85rem',
      color: 'var(--text-secondary)'
    }
  }, "ID: ", cred.credentialId.toString(), " \u2022 ", cred.verified ? '✅ Verified' : '⚠️ Self-Reported')), /*#__PURE__*/React.createElement(Button, {
    onClick: () => handleValidateCredential(cred.credentialId),
    disabled: validatingIds[cred.credentialId.toString()],
    style: {
      fontSize: '0.85rem',
      padding: '8px 16px',
      minWidth: '110px'
    }
  }, validatingIds[cred.credentialId.toString()] ? '⏳ Validating...' : '🔍 Validate')))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: '24px'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => setShowValidateModal(false)
  }, "Close")))), /*#__PURE__*/React.createElement(Modal, {
    isOpen: showAddModal,
    onClose: () => setShowAddModal(false),
    title: "\u2795 Add Credential"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(245, 158, 11, 0.1)',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '20px',
      border: '1px solid rgba(245, 158, 11, 0.3)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '0.9rem',
      color: 'var(--warning)',
      margin: 0
    }
  }, "\u26A0\uFE0F Newly added credentials are ", /*#__PURE__*/React.createElement("strong", null, "invalid by default"), " and must be validated through the network before they are recognised. Use the ", /*#__PURE__*/React.createElement("strong", null, "Validate"), " button on each credential card after adding.")), isApproachingLimit(parseInt(credentialData.credType)) && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(245, 158, 11, 0.1)',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '16px',
      border: '1px solid rgba(245, 158, 11, 0.3)'
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '0.85rem',
      color: 'var(--warning)',
      margin: 0
    }
  }, "\u26A0\uFE0F You have ", credentialCounts[parseInt(credentialData.credType)] || 0, "/", MAX_CREDENTIALS_PER_TYPE, " ", credentialTypes[parseInt(credentialData.credType)], " credentials. Approaching limit!")), /*#__PURE__*/React.createElement(Select, {
    label: "Credential Type",
    value: credentialData.credType,
    onChange: val => setCredentialData({
      ...credentialData,
      credType: val
    }),
    options: credentialTypes.map((t, i) => ({
      value: i.toString(),
      label: `${t} (${credentialCounts[i] || 0}/${MAX_CREDENTIALS_PER_TYPE})`
    }))
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Institution/Organization",
    value: credentialData.institution,
    onChange: val => setCredentialData({
      ...credentialData,
      institution: val
    }),
    placeholder: "e.g., MIT, Google, AWS"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Title/Name",
    value: credentialData.title,
    onChange: val => setCredentialData({
      ...credentialData,
      title: val
    }),
    placeholder: "e.g., Bachelor of Computer Science"
  }), /*#__PURE__*/React.createElement(TextArea, {
    label: "Description",
    value: credentialData.description,
    onChange: val => setCredentialData({
      ...credentialData,
      description: val
    }),
    placeholder: "Brief description of the credential"
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Issue Date",
    type: "date",
    value: credentialData.issueDate,
    onChange: val => setCredentialData({
      ...credentialData,
      issueDate: val
    })
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Expiry Date (optional)",
    type: "date",
    value: credentialData.expiryDate,
    onChange: val => setCredentialData({
      ...credentialData,
      expiryDate: val
    })
  }), parseInt(credentialData.credType) === 4 && /*#__PURE__*/React.createElement(Select, {
    label: "Skill Category",
    value: credentialData.category,
    onChange: val => setCredentialData({
      ...credentialData,
      category: val
    }),
    options: skillCategories.map((c, i) => {
      const catInfo = getSkillCategoryInfo(i);
      return {
        value: i.toString(),
        label: `${catInfo.icon} ${c}`
      };
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'flex-end',
      marginTop: '24px'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => setShowAddModal(false),
    disabled: loading
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: handleAddCredential,
    disabled: loading || (credentialCounts[parseInt(credentialData.credType)] || 0) >= MAX_CREDENTIALS_PER_TYPE
  }, loading ? 'Adding...' : '➕ Add Credential')))));
};