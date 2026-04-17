import React from 'react';

export function TabNavigation({ activeTab, setActiveTab, userTokens }) {
    const tabs = [
        { id: 'identity', label: 'Identity', icon: '👤' },
        { id: 'credentials', label: 'Credentials', icon: '📜', disabled: userTokens.length === 0 },
        { id: 'access', label: 'Access Control', icon: '🔐', disabled: userTokens.length === 0 },
        { id: 'social', label: 'Social', icon: '🤝', disabled: userTokens.length === 0 },
        { id: 'analytics', label: 'Analytics', icon: '📊', disabled: userTokens.length === 0 },
        { id: 'events', label: 'View Identities', icon: '🔍', disabled: false },
    ];

    return (
        <nav className="tab-navigation">
            <div className="tab-container">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`tab ${activeTab === tab.id ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
                        onClick={() => !tab.disabled && setActiveTab(tab.id)}
                        disabled={tab.disabled}
                    >
                        <span className="tab-icon">{tab.icon}</span>
                        <span className="tab-label">{tab.label}</span>
                    </button>
                ))}
            </div>

            <style>{`
                .tab-navigation {
                    background: rgba(26, 35, 50, 0.8);
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid rgba(14, 116, 144, 0.3);
                    position: sticky;
                    top: 90px;
                    z-index: 90;
                }

                .tab-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 20px;
                    display: flex;
                    gap: 8px;
                    overflow-x: auto;
                }

                .tab {
                    background: transparent;
                    border: none;
                    color: var(--gray-light);
                    padding: 16px 24px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-family: 'Work Sans', sans-serif;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.3s ease;
                    border-bottom: 3px solid transparent;
                    white-space: nowrap;
                }

                .tab:hover:not(.disabled) {
                    color: var(--teal-light);
                }

                .tab.active {
                    color: var(--teal-light);
                    border-bottom-color: var(--teal);
                }

                .tab.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .tab-icon {
                    font-size: 20px;
                }

                .tab-label {
                    font-weight: 500;
                }

                @media (max-width: 768px) {
                    .tab {
                        padding: 12px 16px;
                        font-size: 13px;
                    }

                    .tab-icon {
                        font-size: 18px;
                    }
                }
            `}</style>
        </nav>
    );
}
