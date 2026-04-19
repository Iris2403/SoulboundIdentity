SocialTab = function ({
  contracts,
  selectedToken,
  userTokens,
  account,
  showNotification
}) {
  const [activeSection, setActiveSection] = useState('reputation');
  const [reputation, setReputation] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewsWritten, setReviewsWritten] = useState([]);
  const [projects, setProjects] = useState([]);
  const [myProjects, setMyProjects] = useState([]);
  const [collaboratingOn, setCollaboratingOn] = useState([]);
  const [endorsements, setEndorsements] = useState([]);
  const [endorsementCounts, setEndorsementCounts] = useState({});
  const [projectStats, setProjectStats] = useState(null); // NEW: Project statistics
  const [hasReviewedCache, setHasReviewedCache] = useState({}); // NEW: Cache for hasReviewed
  const [loading, setLoading] = useState(false);

  // Constants from contract
  const MAX_PROJECTS = 50;
  const MAX_COLLABORATORS = 20;
  const MAX_SCORE = 100;
  useEffect(() => {
    if (selectedToken && contracts) {
      loadSocialData();
      loadMyActivity();
      loadProjectStats(); // NEW
    }
  }, [selectedToken, contracts]);

  // NEW: Load project statistics by status
  const loadProjectStats = async () => {
    if (!selectedToken || !contracts) return;
    try {
      const entries = await Promise.all([0, 1, 2, 3].map(async status => {
        const count = await contracts.social.getProjectCountByStatus(selectedToken, status);
        return [status, count.toNumber()];
      }));
      setProjectStats(Object.fromEntries(entries));
    } catch (error) {
      console.error('Error loading project stats:', error);
    }
  };
  const loadSocialData = async () => {
    if (!selectedToken) return;
    setLoading(true);
    try {
      // Load reputation
      const rep = await contracts.social.getReputationSummary(selectedToken);
      setReputation({
        averageScore: rep.averageScore.toNumber(),
        totalReviews: rep.totalReviews.toNumber(),
        verifiedReviews: rep.verifiedReviews.toNumber()
      });

      // Load reviews received
      const revs = await contracts.social.getReviews(selectedToken);
      setReviews(revs);

      // Load projects
      const projs = await contracts.social.getProjects(selectedToken);
      setProjects(projs);
      setMyProjects(projs);

      // Load endorsements received
      const ends = await contracts.social.getEndorsements(selectedToken);
      setEndorsements(ends);

      // Count endorsements per skill — all in parallel
      const skillHashes = [...new Set(ends.map(e => e.skillHash))];
      const countEntries = await Promise.all(skillHashes.map(async skillHash => {
        try {
          const count = await contracts.social.getEndorsementCount(selectedToken, skillHash);
          return [skillHash, count.toNumber()];
        } catch {
          return [skillHash, ends.filter(e => e.skillHash === skillHash).length];
        }
      }));
      setEndorsementCounts(Object.fromEntries(countEntries));
    } catch (error) {
      console.error('Error loading social data:', error);
    } finally {
      setLoading(false);
    }
  };
  const loadMyActivity = async () => {
    if (!selectedToken) return;
    try {
      // Load reviews I've written
      const writtenReviews = [];
      const storedReviews = JSON.parse(localStorage.getItem(`reviews_written_${selectedToken}`) || '[]');
      for (const item of storedReviews) {
        try {
          const tokenReviews = await contracts.social.getReviews(item.targetTokenId);
          const myReview = tokenReviews.find(r => r.reviewerTokenId.toString() === selectedToken.toString());
          if (myReview) {
            writtenReviews.push({
              ...myReview,
              targetTokenId: item.targetTokenId
            });
          }
        } catch (err) {
          console.log('Could not load review for token', item.targetTokenId);
        }
      }
      setReviewsWritten(writtenReviews);

      // Load projects I'm collaborating on
      const collaborations = [];
      const storedCollabs = JSON.parse(localStorage.getItem(`collaborations_${selectedToken}`) || '[]');
      for (const item of storedCollabs) {
        try {
          const tokenProjects = await contracts.social.getProjects(item.ownerTokenId);
          const project = tokenProjects.find(p => p.projectId.toString() === item.projectId.toString());
          if (project) {
            collaborations.push({
              ...project,
              ownerTokenId: item.ownerTokenId
            });
          }
        } catch (err) {
          console.log('Could not load collaboration');
        }
      }
      setCollaboratingOn(collaborations);
    } catch (error) {
      console.error('Error loading my activity:', error);
    }
  };
  if (!selectedToken) {
    return /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
      className: "empty-state"
    }, /*#__PURE__*/React.createElement("div", {
      className: "empty-icon"
    }, "\uD83E\uDD1D"), /*#__PURE__*/React.createElement("h3", null, "Select an Identity Token"), /*#__PURE__*/React.createElement("p", null, "Choose a token from the Identity tab to view social features")));
  }

  // Calculate total projects
  const totalProjects = projectStats ? Object.values(projectStats).reduce((a, b) => a + b, 0) : 0;
  const isNearProjectLimit = totalProjects >= MAX_PROJECTS * 0.9;
  return /*#__PURE__*/React.createElement("div", {
    className: "social-tab"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tab-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h2", null, "Social Hub"), /*#__PURE__*/React.createElement("p", {
    className: "tab-description"
  }, "Build reputation, showcase projects, and receive endorsements"))), isNearProjectLimit && activeSection === 'projects' && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'rgba(245, 158, 11, 0.1)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '1.5rem'
    }
  }, "\u26A0\uFE0F"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: '600',
      color: 'var(--warning)',
      marginBottom: '4px'
    }
  }, "Approaching Project Limit"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.9rem',
      color: 'var(--text-secondary)'
    }
  }, "You have ", totalProjects, "/", MAX_PROJECTS, " total projects across all statuses."))), projectStats && activeSection === 'projects' && /*#__PURE__*/React.createElement(Card, {
    style: {
      marginBottom: '24px'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      marginBottom: '16px',
      color: 'var(--teal-light)'
    }
  }, "\uD83D\uDCCA Project Statistics"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: '16px'
    }
  }, projectStatuses.map((status, idx) => {
    const count = projectStats[idx] || 0;
    const colors = ['#667eea', '#4facfe', '#43e97b', '#fa709a'];
    const icons = ['📋', '🚀', '✅', '❌'];
    return /*#__PURE__*/React.createElement("div", {
      key: idx,
      style: {
        textAlign: 'center',
        padding: '16px',
        background: `${colors[idx]}15`,
        borderRadius: '12px',
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '1.5rem',
        marginBottom: '8px'
      }
    }, icons[idx]), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '1.8rem',
        fontWeight: 'bold',
        color: colors[idx]
      }
    }, count), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: '0.85rem',
        color: 'var(--text-secondary)',
        marginTop: '4px'
      }
    }, status));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '16px',
      background: 'rgba(6, 182, 212, 0.1)',
      borderRadius: '12px',
      border: isNearProjectLimit ? '2px solid var(--warning)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '1.5rem',
      marginBottom: '8px'
    }
  }, "\uD83D\uDCC1"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '1.8rem',
      fontWeight: 'bold',
      color: isNearProjectLimit ? 'var(--warning)' : 'var(--teal-light)'
    }
  }, totalProjects, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '0.9rem',
      color: 'var(--text-muted)',
      marginLeft: '4px'
    }
  }, "/", MAX_PROJECTS)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '0.85rem',
      color: 'var(--text-secondary)',
      marginTop: '4px'
    }
  }, "Total Projects")))), /*#__PURE__*/React.createElement("div", {
    className: "social-nav"
  }, /*#__PURE__*/React.createElement("button", {
    className: `social-nav-btn ${activeSection === 'reputation' ? 'active' : ''}`,
    onClick: () => setActiveSection('reputation')
  }, "\u2B50 Reputation"), /*#__PURE__*/React.createElement("button", {
    className: `social-nav-btn ${activeSection === 'projects' ? 'active' : ''}`,
    onClick: () => setActiveSection('projects')
  }, "\uD83D\uDCC1 Projects", projectStats && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: '6px',
      background: 'rgba(255,255,255,0.2)',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '0.75rem'
    }
  }, totalProjects)), /*#__PURE__*/React.createElement("button", {
    className: `social-nav-btn ${activeSection === 'endorsements' ? 'active' : ''}`,
    onClick: () => setActiveSection('endorsements')
  }, "\uD83D\uDC4D Endorsements", Object.keys(endorsementCounts).length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: '6px',
      background: 'rgba(255,255,255,0.2)',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '0.75rem'
    }
  }, Object.keys(endorsementCounts).length))), activeSection === 'reputation' && /*#__PURE__*/React.createElement(ReputationSection, {
    reputation: reputation,
    reviews: reviews,
    reviewsWritten: reviewsWritten,
    loading: loading,
    contracts: contracts,
    selectedToken: selectedToken,
    userTokens: userTokens,
    showNotification: showNotification,
    onReload: loadSocialData,
    hasReviewedCache: hasReviewedCache,
    setHasReviewedCache: setHasReviewedCache,
    MAX_SCORE: MAX_SCORE
  }), activeSection === 'projects' && /*#__PURE__*/React.createElement(ProjectsSection, {
    projects: projects,
    collaboratingOn: collaboratingOn,
    loading: loading,
    contracts: contracts,
    selectedToken: selectedToken,
    showNotification: showNotification,
    onReload: () => {
      loadSocialData();
      loadProjectStats();
    },
    MAX_PROJECTS: MAX_PROJECTS,
    MAX_COLLABORATORS: MAX_COLLABORATORS
  }), activeSection === 'endorsements' && /*#__PURE__*/React.createElement(EndorsementsSection, {
    endorsements: endorsements,
    endorsementCounts: endorsementCounts,
    loading: loading,
    contracts: contracts,
    selectedToken: selectedToken,
    userTokens: userTokens,
    showNotification: showNotification,
    onReload: loadSocialData
  }), /*#__PURE__*/React.createElement("style", null, `
                .social-tab {
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

                .social-nav {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 30px;
                    border-bottom: 2px solid rgba(14, 116, 144, 0.3);
                }

                .social-nav-btn {
                    background: transparent;
                    border: none;
                    color: var(--gray-light);
                    padding: 12px 24px;
                    font-size: 15px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border-bottom: 3px solid transparent;
                    margin-bottom: -2px;
                    display: flex;
                    align-items: center;
                }

                .social-nav-btn:hover {
                    color: var(--teal-light);
                }

                .social-nav-btn.active {
                    color: var(--teal-light);
                    border-bottom-color: var(--teal);
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
                    .social-nav {
                        overflow-x: auto;
                    }

                    .social-nav-btn {
                        white-space: nowrap;
                        padding: 12px 16px;
                        font-size: 14px;
                    }
                }
            `));
};