Header = function ({
  account,
  onConnect,
  loading
}) {
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const {
    addToast
  } = useToast();
  const copyAddress = () => {
    navigator.clipboard.writeText(account);
    addToast('Address copied to clipboard!', 'success');
  };
  const switchAccount = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{
          eth_accounts: {}
        }]
      });
      // This will trigger MetaMask to let user choose account
      window.location.reload();
    } catch (error) {
      console.error('Error switching account:', error);
    }
  };
  return /*#__PURE__*/React.createElement("header", {
    className: "header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "header-content"
  }, /*#__PURE__*/React.createElement("div", {
    className: "header-left"
  }, /*#__PURE__*/React.createElement("h1", {
    className: "logo"
  }, /*#__PURE__*/React.createElement("span", {
    className: "logo-icon"
  }, "\u2B21"), "SoulBound Identity"), /*#__PURE__*/React.createElement("p", {
    className: "tagline"
  }, "Decentralized Professional Network")), /*#__PURE__*/React.createElement("div", {
    className: "header-right"
  }, account ? /*#__PURE__*/React.createElement("div", {
    className: "account-info"
  }, /*#__PURE__*/React.createElement("div", {
    className: "account-badge",
    onClick: () => setShowAccountMenu(!showAccountMenu)
  }, /*#__PURE__*/React.createElement("div", {
    className: "account-dot"
  }), /*#__PURE__*/React.createElement("span", null, shortenAddress(account)), /*#__PURE__*/React.createElement("span", {
    className: "dropdown-arrow"
  }, "\u25BC")), showAccountMenu && /*#__PURE__*/React.createElement("div", {
    className: "account-menu"
  }, /*#__PURE__*/React.createElement("button", {
    className: "menu-item",
    onClick: copyAddress
  }, "\uD83D\uDCCB Copy Address"), /*#__PURE__*/React.createElement("button", {
    className: "menu-item",
    onClick: switchAccount
  }, "\uD83D\uDD04 Switch Account"), /*#__PURE__*/React.createElement("div", {
    className: "menu-divider"
  }), /*#__PURE__*/React.createElement("div", {
    className: "menu-address"
  }, account))) : /*#__PURE__*/React.createElement(Button, {
    onClick: onConnect,
    disabled: loading
  }, loading ? 'Connecting...' : 'Connect Wallet'))), /*#__PURE__*/React.createElement("style", null, `
                .header {
                    background: rgba(26, 35, 50, 0.95);
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid rgba(14, 116, 144, 0.3);
                    padding: 20px 0;
                    position: sticky;
                    top: 0;
                    z-index: 100;
                }

                .header-content {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .header-left {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .logo {
                    font-family: 'Playfair Display', serif;
                    font-size: 28px;
                    font-weight: 700;
                    color: var(--teal-light);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .logo-icon {
                    font-size: 32px;
                    color: var(--sky);
                }

                .tagline {
                    font-size: 13px;
                    color: var(--gray);
                    font-weight: 300;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                    margin-left: 44px;
                }

                .account-info {
                    position: relative;
                    display: flex;
                    align-items: center;
                }

                .account-badge {
                    background: rgba(14, 116, 144, 0.2);
                    border: 1px solid var(--teal);
                    border-radius: 24px;
                    padding: 10px 20px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .account-badge:hover {
                    background: rgba(14, 116, 144, 0.3);
                    transform: translateY(-1px);
                }

                .account-dot {
                    width: 8px;
                    height: 8px;
                    background: var(--success);
                    border-radius: 50%;
                    animation: pulse 2s ease-in-out infinite;
                }

                .dropdown-arrow {
                    font-size: 10px;
                    color: var(--gray);
                    transition: transform 0.3s ease;
                }

                .account-menu {
                    position: absolute;
                    top: 100%;
                    right: 0;
                    margin-top: 8px;
                    background: rgba(26, 35, 50, 0.98);
                    border: 1px solid var(--teal);
                    border-radius: 12px;
                    padding: 8px;
                    min-width: 250px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
                    animation: slideIn 0.2s ease-out;
                    z-index: 1000;
                }

                .menu-item {
                    width: 100%;
                    background: transparent;
                    border: none;
                    color: var(--beige);
                    padding: 12px 16px;
                    text-align: left;
                    cursor: pointer;
                    border-radius: 6px;
                    font-size: 14px;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .menu-item:hover {
                    background: rgba(14, 116, 144, 0.3);
                }

                .menu-divider {
                    height: 1px;
                    background: rgba(14, 116, 144, 0.3);
                    margin: 8px 0;
                }

                .menu-address {
                    padding: 12px 16px;
                    font-size: 11px;
                    color: var(--gray);
                    font-family: monospace;
                    word-break: break-all;
                    background: rgba(14, 116, 144, 0.1);
                    border-radius: 6px;
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @media (max-width: 768px) {
                    .header-content {
                        flex-direction: column;
                        gap: 16px;
                    }

                    .tagline {
                        margin-left: 0;
                    }
                }
            `));
};