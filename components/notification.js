Notification = function ({ message, type, onClose }) {
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };

    return (
        <div className={`notification notification-${type} slide-in`}>
            <span className="notification-icon">{icons[type]}</span>
            <span className="notification-message">{message}</span>
            <button className="notification-close" onClick={onClose}>&times;</button>

            <style>{`
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--navy);
                    border-radius: 12px;
                    padding: 16px 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
                    z-index: 2000;
                    border: 2px solid;
                    max-width: 400px;
                }

                .notification-success {
                    border-color: var(--success);
                }

                .notification-error {
                    border-color: var(--error);
                }

                .notification-warning {
                    border-color: var(--warning);
                }

                .notification-info {
                    border-color: var(--sky);
                }

                .notification-icon {
                    font-size: 20px;
                    font-weight: bold;
                }

                .notification-success .notification-icon {
                    color: var(--success);
                }

                .notification-error .notification-icon {
                    color: var(--error);
                }

                .notification-warning .notification-icon {
                    color: var(--warning);
                }

                .notification-info .notification-icon {
                    color: var(--sky);
                }

                .notification-message {
                    flex: 1;
                    color: var(--beige);
                    font-size: 14px;
                }

                .notification-close {
                    background: none;
                    border: none;
                    color: var(--gray);
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                }

                .notification-close:hover {
                    color: var(--beige);
                }

                @media (max-width: 768px) {
                    .notification {
                        left: 20px;
                        right: 20px;
                        max-width: none;
                    }
                }
            `}</style>
        </div>
    );
}
