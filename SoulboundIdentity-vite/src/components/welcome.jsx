import React from 'react';
import { Button } from './ui';

export function WelcomeScreen({ onConnect, loading }) {
    return (
        <div className="welcome-screen">
            <div className="welcome-content slide-in">
                <div className="welcome-icon">⬡</div>
                <h1>Welcome to SoulBound Identity</h1>
                <p className="welcome-description">
                    A decentralized professional identity system built on blockchain technology.
                    Create your soulbound token, manage credentials, and build your professional reputation.
                </p>
                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon">🔐</div>
                        <h3>Soulbound Tokens</h3>
                        <p>Non-transferable identity credentials that stay with you forever</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">📜</div>
                        <h3>Professional Credentials</h3>
                        <p>Manage degrees, certifications, work experience, and skills</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🤝</div>
                        <h3>Social Features</h3>
                        <p>Build reputation, showcase projects, and receive endorsements</p>
                    </div>
                    <div className="feature-card">
                        <div className="feature-icon">🔒</div>
                        <h3>Privacy Control</h3>
                        <p>Control who can view your information with granular access control</p>
                    </div>
                </div>
                <Button onClick={onConnect} disabled={loading} style={{ padding: '16px 48px', fontSize: '16px' }}>
                    {loading ? 'Connecting...' : 'Connect Wallet to Get Started'}
                </Button>
            </div>

            <style>{`
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
            `}</style>
        </div>
    );
}
