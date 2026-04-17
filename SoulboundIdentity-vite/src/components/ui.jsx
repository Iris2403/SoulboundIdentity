import React, { useState, useEffect } from 'react';
import { CONFIG } from '../contracts';

// LoadingSpinner defined first so MetadataDisplay can reference it
export function LoadingSpinner() {
    return (
        <div className="loading-spinner">
            <div className="spinner"></div>
        </div>
    );
}

export function Checkbox({
    label,
    checked,
    onChange,
    disabled = false,
    id,
    name
}) {
    const generatedId = React.useId();
    const checkboxId = id || `checkbox-${generatedId}`;

    return (
        <label
            htmlFor={checkboxId}
            className={`checkbox-label ${disabled ? 'disabled' : ''}`}
        >
            <input
                id={checkboxId}
                name={name}
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
                className="checkbox-input"
                aria-checked={checked}
            />
            <span className="checkbox-custom" aria-hidden="true"></span>
            <span className="checkbox-text">{label}</span>
        </label>
    );
}

export function TransactionStatus({ pendingTxs }) {
    const activeTxs = pendingTxs.filter(tx => tx.status === 'pending');

    if (activeTxs.length === 0) return null;

    return (
        <div className="tx-status-widget">
            <div className="tx-widget-header">
                <span>⏳ Pending Transactions</span>
            </div>
            {activeTxs.map(tx => (
                <div key={tx.id} className="tx-item">
                    <div className="loading-spinner loading-small">
                        <div className="spinner"></div>
                    </div>
                    <span className="tx-description">{tx.description}</span>
                    <a
                        href={`${CONFIG.BLOCK_EXPLORER}/tx/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tx-link"
                    >
                        View →
                    </a>
                </div>
            ))}
        </div>
    );
}

export function GasEstimate({ gasEstimate }) {
    if (!gasEstimate) return null;

    return (
        <div className="gas-estimate">
            <div className="gas-estimate-header">
                <span>⛽ Gas Estimate</span>
            </div>
            <div className="gas-details">
                <div className="gas-item">
                    <span className="gas-label">Limit:</span>
                    <span className="gas-value">{gasEstimate.gasLimit}</span>
                </div>
                <div className="gas-item">
                    <span className="gas-label">Price:</span>
                    <span className="gas-value">{gasEstimate.gasPrice} Gwei</span>
                </div>
                <div className="gas-item">
                    <span className="gas-label">Estimated Cost:</span>
                    <span className="gas-value">{parseFloat(gasEstimate.estimatedCost).toFixed(6)} ETH</span>
                </div>
            </div>
        </div>
    );
}

export function MetadataDisplay({ cid, showNotification }) {
    const [metadata, setMetadata] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        // Create AbortController to cancel fetch if component unmounts
        const abortController = new AbortController();
        let timeoutId;

        const fetchMetadata = async () => {
            try {
                setLoading(true);
                setError(false);

                // Set a 10-second timeout for the fetch
                timeoutId = setTimeout(() => {
                    abortController.abort();
                }, 10000);

                const response = await fetch(`${CONFIG.IPFS_GATEWAY}${cid}`, {
                    signal: abortController.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) throw new Error('Failed to fetch metadata');
                const data = await response.json();
                setMetadata(data);
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.warn('Metadata fetch aborted or timed out');
                    setError(true);
                    if (showNotification) {
                        showNotification('Metadata loading timed out', 'warning');
                    }
                } else {
                    console.error('Failed to fetch IPFS data:', error);
                    setError(true);
                    if (showNotification) {
                        showNotification('Failed to load metadata', 'error');
                    }
                }
            } finally {
                setLoading(false);
            }
        };

        if (cid) {
            fetchMetadata();
        }

        // Cleanup: abort fetch if component unmounts
        return () => {
            abortController.abort();
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [cid, showNotification]);

    if (loading) return <LoadingSpinner />;
    if (error || !metadata) {
        return (
            <div className="metadata-error">
                <p>Failed to load metadata</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    IPFS gateway may be slow or unavailable
                </p>
            </div>
        );
    }

    return (
        <div className="metadata-display">
            <h4>Profile Information</h4>
            {metadata.name && (
                <div className="metadata-item">
                    <strong>Name:</strong> {metadata.name}
                </div>
            )}
            {metadata.bio && (
                <div className="metadata-item">
                    <strong>Bio:</strong> {metadata.bio}
                </div>
            )}
            {metadata.email && (
                <div className="metadata-item">
                    <strong>Email:</strong> {metadata.email}
                </div>
            )}
            {metadata.location && (
                <div className="metadata-item">
                    <strong>Location:</strong> {metadata.location}
                </div>
            )}
            {metadata.image && (
                <div className="metadata-image-container">
                    <img
                        src={`${CONFIG.IPFS_GATEWAY}${metadata.image}`}
                        alt="Profile"
                        className="metadata-image"
                    />
                </div>
            )}
        </div>
    );
}

export function Card({ children, className = '', style = {} }) {
    return (
        <div className={`card ${className}`} style={style}>
            {children}
        </div>
    );
}

export function Button({ children, onClick, disabled = false, variant = 'primary', className = '', style = {} }) {
    return (
        <button
            className={`btn btn-${variant} ${className}`}
            onClick={onClick}
            disabled={disabled}
            style={style}
        >
            {children}
        </button>
    );
}

export function Input({ label, value, onChange, type = 'text', placeholder = '', required = false, id, name }) {
    const generatedId = React.useId();
    const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-') || generatedId}`;
    const inputName = name || inputId;

    return (
        <div className="input-group">
            {label && (
                <label className="input-label" htmlFor={inputId}>
                    {label}{required && ' *'}
                </label>
            )}
            <input
                id={inputId}
                name={inputName}
                className="input-field"
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                autoComplete={type === 'email' ? 'email' : type === 'text' ? 'on' : 'off'}
            />
        </div>
    );
}

export function Select({ label, value, onChange, options, required = false, id, name }) {
    const generatedId = React.useId();
    const selectId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-') || generatedId}`;
    const selectName = name || selectId;

    return (
        <div className="input-group">
            {label && (
                <label className="input-label" htmlFor={selectId}>
                    {label}{required && ' *'}
                </label>
            )}
            <select
                id={selectId}
                name={selectName}
                className="input-field"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
            >
                <option value="">Select...</option>
                {options.map((opt, idx) => (
                    <option key={idx} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}

export function TextArea({ label, value, onChange, placeholder = '', rows = 4, id, name }) {
    const generatedId = React.useId();
    const textareaId = id || `textarea-${label?.toLowerCase().replace(/\s+/g, '-') || generatedId}`;
    const textareaName = name || textareaId;

    return (
        <div className="input-group">
            {label && (
                <label className="input-label" htmlFor={textareaId}>
                    {label}
                </label>
            )}
            <textarea
                id={textareaId}
                name={textareaName}
                className="input-field"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
            />
        </div>
    );
}

export function Modal({ isOpen, onClose, title, children }) {
    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return React.createElement('div', {
        className: 'modal-overlay',
        onClick: handleOverlayClick,
        style: {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
        }
    },
        React.createElement('div', {
            className: 'modal-content',
            onClick: (e) => e.stopPropagation()
        },
            React.createElement('div', { className: 'modal-header' },
                React.createElement('h2', null, title),
                React.createElement('button', {
                    className: 'modal-close',
                    onClick: onClose
                }, '×')
            ),
            React.createElement('div', { className: 'modal-body' }, children)
        )
    );
}
