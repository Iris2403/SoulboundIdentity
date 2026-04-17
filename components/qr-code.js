QRCodeDisplay = function ({ tokenId, contractAddress, size = 200 }) {
    const canvasRef = useRef(null);
    const [qrError, setQrError] = useState(null);
    const { addToast } = useToast();

    const qrValue = `${CONFIG.BLOCK_EXPLORER}/token/${contractAddress}/${tokenId}`;

    useEffect(() => {
        if (!canvasRef.current) return;
        if (typeof QRCode === 'undefined') {
            setQrError('QR Code library not available');
            return;
        }
        setQrError(null);
        QRCode.toCanvas(canvasRef.current, qrValue, {
            width: size,
            margin: 2,
            color: {
                dark: '#0e7490',
                light: '#0a0e1a'
            }
        }, (err) => {
            if (err) {
                console.error('QR generation error:', err);
                setQrError('Failed to generate QR code');
            }
        });
    }, [tokenId, contractAddress, size]);

    const handleDownload = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = `identity-token-${tokenId}.png`;
        link.href = canvasRef.current.toDataURL('image/png');
        link.click();
        addToast('QR code downloaded!', 'success');
    };

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(qrValue);
        addToast('Token URL copied to clipboard!', 'success');
    };

    return (
        <div className="qr-container">
            {qrError ? (
                <div style={{ color: 'var(--error)', fontSize: '14px', padding: '16px' }}>{qrError}</div>
            ) : (
                <div className="qr-canvas-wrapper">
                    <canvas ref={canvasRef} />
                </div>
            )}

            <p className="qr-url-text">{qrValue}</p>

            <div className="qr-actions">
                <button className="qr-btn qr-btn-primary" onClick={handleDownload} disabled={!!qrError}>
                    &#x2B07;&#xFE0F; Download PNG
                </button>
                <button className="qr-btn qr-btn-secondary" onClick={handleCopyUrl}>
                    &#x1F4CB; Copy URL
                </button>
            </div>

            <style>{`
                .qr-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 16px;
                }

                .qr-canvas-wrapper {
                    padding: 12px;
                    background: #0a0e1a;
                    border-radius: 12px;
                    border: 1px solid rgba(14, 116, 144, 0.4);
                    display: inline-block;
                    box-shadow: 0 0 20px rgba(14, 116, 144, 0.15);
                }

                .qr-url-text {
                    font-size: 11px;
                    color: var(--gray);
                    text-align: center;
                    max-width: 260px;
                    word-break: break-all;
                    line-height: 1.5;
                    margin: 0;
                }

                .qr-actions {
                    display: flex;
                    gap: 10px;
                }

                .qr-btn {
                    padding: 9px 18px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    transition: all 0.25s ease;
                    white-space: nowrap;
                }

                .qr-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }

                .qr-btn-primary {
                    background: var(--teal);
                    border: none;
                    color: white;
                }

                .qr-btn-primary:hover:not(:disabled) {
                    background: var(--teal-light);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(14, 116, 144, 0.4);
                }

                .qr-btn-secondary {
                    background: transparent;
                    border: 1px solid var(--teal);
                    color: var(--teal-light);
                }

                .qr-btn-secondary:hover {
                    background: rgba(14, 116, 144, 0.1);
                    transform: translateY(-1px);
                }
            `}</style>
        </div>
    );
};
