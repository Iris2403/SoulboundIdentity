AnalyticsTab = function ({
  contracts,
  selectedToken,
  showNotification
}) {
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
          total: credSummary.degrees.add(credSummary.certifications).add(credSummary.workExperience).add(credSummary.identityProofs).add(credSummary.skills).toNumber()
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
    return /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      className: "empty-state"
    }, /*#__PURE__*/React.createElement("div", {
      className: "empty-icon"
    }, "\uD83D\uDCCA"), /*#__PURE__*/React.createElement("h3", null, "No Token Selected"), /*#__PURE__*/React.createElement("p", null, "Select a token to view analytics")));
  }
  if (loading) {
    return /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(LoadingSpinner, null));
  }
  if (!stats) {
    return /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      className: "empty-message"
    }, "Failed to load analytics"));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "analytics-container"
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      marginBottom: '24px',
      color: 'var(--beige, #e8dfca)'
    }
  }, "Analytics Dashboard"), /*#__PURE__*/React.createElement("div", {
    className: "analytics-dashboard",
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '24px'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    className: "stat-card",
    style: {
      padding: '24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-card-header",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '16px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "stat-icon",
    style: {
      fontSize: '2rem'
    }
  }, "\uD83D\uDCDC"), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "Credentials")), /*#__PURE__*/React.createElement("div", {
    className: "big-number",
    style: {
      fontSize: '3rem',
      fontWeight: 'bold',
      color: 'var(--teal-light, #06b6d4)',
      marginBottom: '8px'
    }
  }, stats.credentials.total), /*#__PURE__*/React.createElement("div", {
    className: "stat-label",
    style: {
      color: 'var(--gray, #6b7589)',
      marginBottom: '16px'
    }
  }, "Total Credentials"), /*#__PURE__*/React.createElement("div", {
    className: "stat-breakdown",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      paddingTop: '16px',
      borderTop: '1px solid var(--border-color, rgba(168, 178, 193, 0.1))'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "breakdown-item"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83C\uDF93 Degrees: ", stats.credentials.degrees)), /*#__PURE__*/React.createElement("div", {
    className: "breakdown-item"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCCB Certifications: ", stats.credentials.certifications)), /*#__PURE__*/React.createElement("div", {
    className: "breakdown-item"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCBC Work Experience: ", stats.credentials.workExperience)), /*#__PURE__*/React.createElement("div", {
    className: "breakdown-item"
  }, /*#__PURE__*/React.createElement("span", null, "\u26A1 Skills: ", stats.credentials.skills)))), /*#__PURE__*/React.createElement(Card, {
    className: "stat-card",
    style: {
      padding: '24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-card-header",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '16px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "stat-icon",
    style: {
      fontSize: '2rem'
    }
  }, "\u2B50"), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "Reputation")), /*#__PURE__*/React.createElement("div", {
    className: "big-number",
    style: {
      fontSize: '3rem',
      fontWeight: 'bold',
      color: 'var(--teal-light, #06b6d4)',
      marginBottom: '8px'
    }
  }, stats.reputation.average, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '1.5rem',
      color: 'var(--gray, #6b7589)'
    }
  }, "/100")), /*#__PURE__*/React.createElement("div", {
    className: "stat-label",
    style: {
      color: 'var(--gray, #6b7589)',
      marginBottom: '16px'
    }
  }, "Average Score"), /*#__PURE__*/React.createElement("div", {
    className: "stat-breakdown",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      paddingTop: '16px',
      borderTop: '1px solid var(--border-color, rgba(168, 178, 193, 0.1))'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "breakdown-item"
  }, /*#__PURE__*/React.createElement("span", null, "Total Reviews: ", stats.reputation.total)), /*#__PURE__*/React.createElement("div", {
    className: "breakdown-item"
  }, /*#__PURE__*/React.createElement("span", null, "\u2713 Verified: ", stats.reputation.verified)), /*#__PURE__*/React.createElement("div", {
    className: "breakdown-item"
  }, /*#__PURE__*/React.createElement("span", null, "Verification Rate: ", stats.reputation.total > 0 ? Math.round(stats.reputation.verified / stats.reputation.total * 100) : 0, "%")))), /*#__PURE__*/React.createElement(Card, {
    className: "stat-card",
    style: {
      padding: '24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-card-header",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '16px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "stat-icon",
    style: {
      fontSize: '2rem'
    }
  }, "\uD83E\uDD1D"), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0
    }
  }, "Social")), /*#__PURE__*/React.createElement("div", {
    className: "stat-breakdown",
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      paddingTop: '16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "breakdown-item",
    style: {
      fontSize: '1.1rem'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDC4D Endorsements: ", /*#__PURE__*/React.createElement("strong", null, stats.social.endorsements))), /*#__PURE__*/React.createElement("div", {
    className: "breakdown-item",
    style: {
      fontSize: '1.1rem'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDE80 Total Projects: ", /*#__PURE__*/React.createElement("strong", null, stats.social.projects))), /*#__PURE__*/React.createElement("div", {
    className: "breakdown-item",
    style: {
      fontSize: '1.1rem'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u2705 Completed: ", /*#__PURE__*/React.createElement("strong", null, stats.social.completedProjects))), /*#__PURE__*/React.createElement("div", {
    className: "breakdown-item",
    style: {
      fontSize: '1.1rem'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u26A1 Active: ", /*#__PURE__*/React.createElement("strong", null, stats.social.activeProjects)))))));
};

// ============================================