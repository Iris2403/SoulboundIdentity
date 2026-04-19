WelcomeScreen = function ({
  onConnect,
  loading
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "welcome-screen"
  }, /*#__PURE__*/React.createElement("div", {
    className: "welcome-content slide-in"
  }, /*#__PURE__*/React.createElement("div", {
    className: "welcome-icon"
  }, "\u2B21"), /*#__PURE__*/React.createElement("h1", null, "Welcome to SoulBound Identity"), /*#__PURE__*/React.createElement("p", {
    className: "welcome-description"
  }, "A decentralized professional identity system built on blockchain technology. Create your soulbound token, manage credentials, and build your professional reputation."), /*#__PURE__*/React.createElement("div", {
    className: "features-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "feature-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "feature-icon"
  }, "\uD83D\uDD10"), /*#__PURE__*/React.createElement("h3", null, "Soulbound Tokens"), /*#__PURE__*/React.createElement("p", null, "Non-transferable identity credentials that stay with you forever")), /*#__PURE__*/React.createElement("div", {
    className: "feature-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "feature-icon"
  }, "\uD83D\uDCDC"), /*#__PURE__*/React.createElement("h3", null, "Professional Credentials"), /*#__PURE__*/React.createElement("p", null, "Manage degrees, certifications, work experience, and skills")), /*#__PURE__*/React.createElement("div", {
    className: "feature-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "feature-icon"
  }, "\uD83E\uDD1D"), /*#__PURE__*/React.createElement("h3", null, "Social Features"), /*#__PURE__*/React.createElement("p", null, "Build reputation, showcase projects, and receive endorsements")), /*#__PURE__*/React.createElement("div", {
    className: "feature-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "feature-icon"
  }, "\uD83D\uDD12"), /*#__PURE__*/React.createElement("h3", null, "Privacy Control"), /*#__PURE__*/React.createElement("p", null, "Control who can view your information with granular access control"))), /*#__PURE__*/React.createElement(Button, {
    onClick: onConnect,
    disabled: loading,
    style: {
      padding: '16px 48px',
      fontSize: '16px'
    }
  }, loading ? 'Connecting...' : 'Connect Wallet to Get Started')), /*#__PURE__*/React.createElement("style", null, `
                .welcome-screen {
                    min-height: calc(100vh - 120px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                }

                .welcome-content {
                    max-width: 900px;
                    text-align: center;
                }

                .welcome-icon {
                    font-size: 80px;
                    color: var(--teal-light);
                    margin-bottom: 24px;
                }

                .welcome-content h1 {
                    font-size: 48px;
                    color: var(--beige);
                    margin-bottom: 16px;
                }

                .welcome-description {
                    font-size: 18px;
                    color: var(--gray-light);
                    margin-bottom: 48px;
                    line-height: 1.6;
                }

                .features-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 24px;
                    margin-bottom: 48px;
                }

                .feature-card {
                    background: rgba(45, 62, 80, 0.5);
                    border: 1px solid rgba(14, 116, 144, 0.3);
                    border-radius: 12px;
                    padding: 24px;
                    transition: all 0.3s ease;
                }

                .feature-card:hover {
                    transform: translateY(-4px);
                    border-color: var(--teal);
                    box-shadow: 0 8px 24px rgba(14, 116, 144, 0.2);
                }

                .feature-icon {
                    font-size: 40px;
                    margin-bottom: 16px;
                }

                .feature-card h3 {
                    font-size: 18px;
                    color: var(--teal-light);
                    margin-bottom: 8px;
                }

                .feature-card p {
                    font-size: 14px;
                    color: var(--gray-light);
                    line-height: 1.5;
                }

                @media (max-width: 768px) {
                    .welcome-content h1 {
                        font-size: 32px;
                    }

                    .welcome-description {
                        font-size: 16px;
                    }
                }
            `));
};