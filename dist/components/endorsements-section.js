EndorsementsSection = function ({
  endorsements,
  endorsementCounts,
  loading,
  contracts,
  selectedToken,
  userTokens,
  showNotification,
  onReload
}) {
  const [showEndorseModal, setShowEndorseModal] = useState(false);
  const [endorseType, setEndorseType] = useState('standard'); // 'standard' | 'custom'
  const [endorseData, setEndorseData] = useState({
    targetTokenId: '',
    endorserTokenId: '',
    predefinedSkill: '0',
    skillName: '',
    comment: ''
  });
  const [standardCounts, setStandardCounts] = useState(new Array(16).fill(0));
  useEffect(() => {
    if (selectedToken && contracts) loadStandardCounts();
  }, [selectedToken, contracts]);
  const loadStandardCounts = async () => {
    try {
      const counts = await contracts.social.getAllStandardSkillCounts(selectedToken);
      setStandardCounts(counts.map(c => c.toNumber ? c.toNumber() : Number(c)));
    } catch (e) {
      console.error('Error loading standard skill counts:', e);
    }
  };

  // Detect whether a skillHash encodes a predefined skill id (0–15)
  const getStandardSkill = skillHash => {
    try {
      const id = ethers.BigNumber.from(skillHash).toNumber();
      if (id >= 0 && id < predefinedSkills.length) return predefinedSkills[id];
    } catch (e) {}
    return null;
  };

  // Split endorsements into standard vs custom
  const customEndorsements = endorsements ? endorsements.filter(e => !getStandardSkill(e.skillHash)) : [];
  const customBySkill = {};
  customEndorsements.forEach(e => {
    if (!customBySkill[e.skillHash]) customBySkill[e.skillHash] = [];
    customBySkill[e.skillHash].push(e);
  });
  const sortedCustom = Object.entries(customBySkill).sort((a, b) => b[1].length - a[1].length);
  const commentLength = endorseData.comment.length;
  const commentLimit = 300;
  const handleEndorse = async () => {
    try {
      if (!endorseData.targetTokenId || !endorseData.endorserTokenId) {
        showNotification('Please fill in all required fields', 'error');
        return;
      }
      if (endorseType === 'custom' && !endorseData.skillName.trim()) {
        showNotification('Please enter a skill name', 'error');
        return;
      }
      const targetId = parseInt(endorseData.targetTokenId);
      const endorserId = parseInt(endorseData.endorserTokenId);
      if (targetId === endorserId) {
        showNotification('You cannot endorse yourself!', 'error');
        return;
      }
      try {
        await contracts.soulbound.ownerOf(targetId);
      } catch {
        showNotification(`Token #${targetId} does not exist!`, 'error');
        return;
      }
      try {
        const owner = await contracts.soulbound.ownerOf(endorserId);
        const me = await contracts.soulbound.signer.getAddress();
        if (owner.toLowerCase() !== me.toLowerCase()) {
          showNotification(`You don't own Token #${endorserId}!`, 'error');
          return;
        }
      } catch {
        showNotification(`Token #${endorserId} does not exist!`, 'error');
        return;
      }
      let tx;
      if (endorseType === 'standard') {
        tx = await contracts.social.endorseStandardSkill(targetId, endorserId, parseInt(endorseData.predefinedSkill), endorseData.comment);
      } else {
        tx = await contracts.social.endorseSkill(targetId, endorserId, ethers.utils.id(endorseData.skillName), endorseData.comment);
      }
      showNotification('Endorsing skill...', 'info');
      await tx.wait();
      showNotification('Skill endorsed successfully!', 'success');
      setShowEndorseModal(false);
      setEndorseData({
        targetTokenId: '',
        endorserTokenId: '',
        predefinedSkill: '0',
        skillName: '',
        comment: ''
      });
      onReload();
      loadStandardCounts();
    } catch (error) {
      console.error('Error endorsing skill:', error);
      const msg = error.message || '';
      if (msg.includes('AlreadyEndorsedSkill') || error.errorName === 'AlreadyEndorsedSkill') {
        showNotification('You have already endorsed this skill for this token!', 'error');
      } else if (error.code === 'ACTION_REJECTED' || msg.includes('user rejected')) {
        showNotification('Transaction rejected by wallet', 'error');
      } else {
        showNotification(msg || 'Failed to endorse skill', 'error');
      }
    }
  };

  // Group predefined skills by category for display
  const skillGroups = [{
    category: 0,
    label: 'Technical',
    icon: '💻',
    color: '#667eea'
  }, {
    category: 1,
    label: 'Business',
    icon: '💼',
    color: '#60a5fa'
  }, {
    category: 2,
    label: 'Creative',
    icon: '🎨',
    color: '#f472b6'
  }, {
    category: 3,
    label: 'Soft Skills',
    icon: '🤝',
    color: '#34d399'
  }].map(g => ({
    ...g,
    skills: predefinedSkills.filter(s => s.category === g.category)
  }));
  const totalStandardEndorsements = standardCounts.reduce((a, b) => a + b, 0);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    className: "section-header"
  }, /*#__PURE__*/React.createElement("h3", null, "Skill Endorsements"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center'
    }
  }, totalStandardEndorsements > 0 && /*#__PURE__*/React.createElement("span", {
    className: "badge",
    style: {
      background: 'rgba(102, 126, 234, 0.8)'
    }
  }, "\u26A1 ", totalStandardEndorsements, " Predefined"), /*#__PURE__*/React.createElement("span", {
    className: "badge"
  }, endorsements?.length || 0, " Total"), /*#__PURE__*/React.createElement(Button, {
    onClick: () => setShowEndorseModal(true),
    style: {
      padding: '8px 16px',
      fontSize: '13px'
    }
  }, "+ Endorse Skill"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: '32px'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--teal-light)',
      marginBottom: '16px',
      fontSize: '1rem'
    }
  }, "\u26A1 Predefined Skills"), skillGroups.map(group => /*#__PURE__*/React.createElement("div", {
    key: group.category,
    style: {
      marginBottom: '20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.85rem',
      fontWeight: '600',
      color: group.color,
      marginBottom: '10px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    }
  }, group.icon, " ", group.label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px'
    }
  }, group.skills.map(skill => {
    const count = standardCounts[skill.id] || 0;
    return /*#__PURE__*/React.createElement("div", {
      key: skill.id,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: count > 0 ? `${group.color}18` : 'var(--bg-tertiary)',
        border: `1px solid ${count > 0 ? group.color : 'var(--border-color)'}`,
        borderRadius: '20px',
        padding: '6px 14px',
        transition: 'all 0.3s'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: '0.85rem',
        color: count > 0 ? group.color : 'var(--text-secondary)'
      }
    }, skill.name), count > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        background: group.color,
        color: 'white',
        borderRadius: '10px',
        padding: '2px 8px',
        fontSize: '0.75rem',
        fontWeight: 'bold'
      }
    }, count));
  }))))), sortedCustom.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h4", {
    style: {
      color: 'var(--teal-light)',
      marginBottom: '16px',
      fontSize: '1rem',
      paddingTop: '16px',
      borderTop: '1px solid rgba(6, 182, 212, 0.2)'
    }
  }, "\uD83C\uDFF7\uFE0F Custom Endorsements"), loading ? /*#__PURE__*/React.createElement(LoadingSpinner, null) : /*#__PURE__*/React.createElement("div", {
    className: "endorsements-grouped"
  }, sortedCustom.map(([skillHash, skillEndorsements]) => /*#__PURE__*/React.createElement("div", {
    key: skillHash,
    className: "skill-group"
  }, /*#__PURE__*/React.createElement("div", {
    className: "skill-header"
  }, /*#__PURE__*/React.createElement("span", {
    className: "skill-name"
  }, skillHash.substring(0, 10), "..."), /*#__PURE__*/React.createElement("span", {
    className: "endorsement-count",
    style: {
      background: 'rgba(102, 126, 234, 0.2)',
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '0.9rem',
      fontWeight: '600'
    }
  }, "\u26A1 ", skillEndorsements.length, " ", skillEndorsements.length === 1 ? 'endorsement' : 'endorsements')), /*#__PURE__*/React.createElement("div", {
    className: "endorsements-list"
  }, skillEndorsements.map((endorsement, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "endorsement-item"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: '500',
      color: 'var(--beige)'
    }
  }, "From Token #", endorsement.endorserId.toString()), /*#__PURE__*/React.createElement("div", {
    className: "endorsement-date"
  }, formatDate(endorsement.endorsedAt))), endorsement.comment && endorsement.comment.trim() !== '' && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(6, 182, 212, 0.05)',
      padding: '10px',
      borderRadius: '6px',
      marginTop: '8px',
      borderLeft: '3px solid var(--teal)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.8rem',
      color: 'var(--text-muted)',
      marginBottom: '4px',
      fontWeight: '600'
    }
  }, "\uD83D\uDCAC Comment:"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-primary)',
      fontSize: '0.9rem',
      lineHeight: '1.5',
      margin: 0
    }
  }, endorsement.comment))))))))), !loading && (!endorsements || endorsements.length === 0) && totalStandardEndorsements === 0 && /*#__PURE__*/React.createElement("div", {
    className: "empty-message"
  }, /*#__PURE__*/React.createElement("p", null, "No endorsements yet")), /*#__PURE__*/React.createElement("style", null, `
                    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                    .section-header h3 { font-size: 20px; color: var(--beige); }
                    .badge { background: var(--teal); color: white; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; }
                    .empty-message { text-align: center; padding: 40px 20px; color: var(--gray-light); }
                    .endorsements-grouped { display: flex; flex-direction: column; gap: 24px; }
                    .skill-group { background: rgba(14, 116, 144, 0.1); border-radius: 12px; padding: 16px; border: 1px solid rgba(14, 116, 144, 0.3); }
                    .skill-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(14, 116, 144, 0.3); }
                    .skill-name { font-size: 14px; color: var(--teal-light); font-weight: 600; font-family: monospace; }
                    .endorsement-count { font-size: 13px; color: var(--sky-light); font-weight: 600; }
                    .endorsements-list { display: flex; flex-direction: column; gap: 12px; }
                    .endorsement-item { background: rgba(26, 35, 50, 0.5); border-radius: 8px; padding: 12px; border-left: 4px solid var(--sky); }
                    .endorsement-date { font-size: 12px; color: var(--gray); }
                `)), /*#__PURE__*/React.createElement(Modal, {
    isOpen: showEndorseModal,
    onClose: () => setShowEndorseModal(false),
    title: "Endorse Skill"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '4px',
      marginBottom: '20px',
      background: 'var(--bg-tertiary)',
      borderRadius: '8px',
      padding: '4px'
    }
  }, [['standard', '⚡ Predefined Skill'], ['custom', '🏷️ Custom Skill']].map(([val, label]) => /*#__PURE__*/React.createElement("button", {
    key: val,
    onClick: () => setEndorseType(val),
    style: {
      flex: 1,
      padding: '8px',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '0.9rem',
      fontWeight: '600',
      transition: 'all 0.3s',
      background: endorseType === val ? 'var(--gradient-teal)' : 'transparent',
      color: endorseType === val ? 'white' : 'var(--text-secondary)'
    }
  }, label))), /*#__PURE__*/React.createElement(Input, {
    label: "Token ID to Endorse",
    value: endorseData.targetTokenId,
    onChange: val => setEndorseData({
      ...endorseData,
      targetTokenId: val
    }),
    placeholder: "Enter token ID",
    type: "number"
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Your Token ID (Endorser)",
    value: endorseData.endorserTokenId,
    onChange: val => setEndorseData({
      ...endorseData,
      endorserTokenId: val
    }),
    options: userTokens.map(t => ({
      value: t.id.toString(),
      label: `Token #${t.id}`
    }))
  }), endorseType === 'standard' ? /*#__PURE__*/React.createElement(Select, {
    label: "Skill",
    value: endorseData.predefinedSkill,
    onChange: val => setEndorseData({
      ...endorseData,
      predefinedSkill: val
    }),
    options: predefinedSkills.map(s => ({
      value: s.id.toString(),
      label: `${s.name} — ${standardSkillCategories[s.category]}`
    }))
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Input, {
    label: "Skill Name",
    value: endorseData.skillName,
    onChange: val => setEndorseData({
      ...endorseData,
      skillName: val
    }),
    placeholder: "e.g., Solidity, Project Management"
  }), /*#__PURE__*/React.createElement("div", {
    className: "info-box"
  }, /*#__PURE__*/React.createElement("strong", null, "\uD83D\uDCA1 Tip:"), " Skill names are hashed on-chain. Use consistent naming so endorsements group together.")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '8px'
    }
  }, /*#__PURE__*/React.createElement("label", {
    className: "input-label"
  }, "Comment (optional)"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.8rem',
      color: commentLength > commentLimit ? 'var(--warning)' : 'var(--text-muted)'
    }
  }, commentLength, "/", commentLimit, commentLength > commentLimit && ' ⚠️')), /*#__PURE__*/React.createElement(TextArea, {
    value: endorseData.comment,
    onChange: val => setEndorseData({
      ...endorseData,
      comment: val
    }),
    placeholder: "Add a comment about this skill...",
    rows: 3
  })), /*#__PURE__*/React.createElement("div", {
    className: "modal-actions"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: () => setShowEndorseModal(false)
  }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
    onClick: handleEndorse
  }, "Endorse Skill")))));
};