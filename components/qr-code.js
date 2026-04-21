QRCodeDisplay = function ({ tokenId, contractAddress, size = 160 }) {
    const canvasRef = useRef(null);
    const [qrError, setQrError] = useState(null);
    const { addToast } = useToast();

    const qrValue = useMemo(
        () => `${CONFIG.BLOCK_EXPLORER}/token/${contractAddress}/${tokenId}`,
        [tokenId, contractAddress]
    );

    useEffect(() => {
        if (!canvasRef.current) return;
        if (typeof QRious === 'undefined') {
            setQrError('QR library unavailable');
            return;
        }
        try {
            new QRious({
                element: canvasRef.current,
                value: qrValue,
                size: size,
                background: '#f5f3ff',
                backgroundAlpha: 1,
                foreground: '#5b21b6',
                foregroundAlpha: 1,
                level: 'M',
                padding: 12
            });
            setQrError(null);
        } catch (err) {
            console.error('QR generation error:', err);
            setQrError('Failed to render QR code');
        }
    }, [qrValue, size]);

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
        addToast('Token URL copied!', 'success');
    };

    return (
        <div className="qr-panel">
            <p className="qr-label">Scan to share</p>

            <div className="qr-canvas-wrap">
                {qrError ? (
                    <div className="qr-error">{qrError}</div>
                ) : (
                    <canvas ref={canvasRef} />
                )}
            </div>

            <div className="qr-btns">
                <button
                    className="qr-btn qr-primary"
                    onClick={handleDownload}
                    disabled={!!qrError}
                    title="Download QR as PNG"
                >
                    ↓ PNG
                </button>
                <button
                    className="qr-btn qr-secondary"
                    onClick={handleCopyUrl}
                    title="Copy token URL"
                >
                    Copy URL
                </button>
            </div>

            <style>{`
                .qr-panel {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                }

                .qr-label {
                    font-size: 11px;
                    font-weight: 700;
                    color: #c4b5fd;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin: 0;
                }

                .qr-canvas-wrap {
                    padding: 10px;
                    background: #f5f3ff;
                    border-radius: 12px;
                    border: 2px solid rgba(139, 92, 246, 0.5);
                    box-shadow: 0 0 24px rgba(139, 92, 246, 0.25), 0 4px 16px rgba(0,0,0,0.3);
                    line-height: 0;
                }

                .qr-error {
                    width: 160px;
                    padding: 16px;
                    color: var(--error, #ef4444);
                    font-size: 12px;
                    text-align: center;
                }

                .qr-btns {
                    display: flex;
                    gap: 8px;
                }

                .qr-btn {
                    padding: 7px 14px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 600;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }

                .qr-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }

                .qr-primary {
                    background: #7c3aed;
                    border: none;
                    color: white;
                }

                .qr-primary:hover:not(:disabled) {
                    background: #8b5cf6;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.5);
                }

                .qr-secondary {
                    background: transparent;
                    border: 1px solid rgba(139, 92, 246, 0.5);
                    color: #a78bfa;
                }

                .qr-secondary:hover {
                    background: rgba(139, 92, 246, 0.12);
                    border-color: rgba(139, 92, 246, 0.8);
                    transform: translateY(-1px);
                }
            `}</style>
        </div>
    );
};
