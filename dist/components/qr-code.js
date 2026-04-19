QRCodeDisplay = function ({
  tokenId,
  contractAddress,
  size = 160
}) {
  const canvasRef = useRef(null);
  const [qrError, setQrError] = useState(null);
  const {
    addToast
  } = useToast();
  const qrValue = useMemo(() => `${CONFIG.BLOCK_EXPLORER}/token/${contractAddress}/${tokenId}`, [tokenId, contractAddress]);
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
        background: '#0a0e1a',
        backgroundAlpha: 1,
        foreground: '#0e7490',
        foregroundAlpha: 1,
        level: 'M',
        padding: 10
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
  return /*#__PURE__*/React.createElement("div", {
    className: "qr-panel"
  }, /*#__PURE__*/React.createElement("p", {
    className: "qr-label"
  }, "Scan to share"), /*#__PURE__*/React.createElement("div", {
    className: "qr-canvas-wrap"
  }, qrError ? /*#__PURE__*/React.createElement("div", {
    className: "qr-error"
  }, qrError) : /*#__PURE__*/React.createElement("canvas", {
    ref: canvasRef
  })), /*#__PURE__*/React.createElement("div", {
    className: "qr-btns"
  }, /*#__PURE__*/React.createElement("button", {
    className: "qr-btn qr-primary",
    onClick: handleDownload,
    disabled: !!qrError,
    title: "Download QR as PNG"
  }, "\u2193 PNG"), /*#__PURE__*/React.createElement("button", {
    className: "qr-btn qr-secondary",
    onClick: handleCopyUrl,
    title: "Copy token URL"
  }, "Copy URL")), /*#__PURE__*/React.createElement("style", null, `
                .qr-panel {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                }

                .qr-label {
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--gray);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    margin: 0;
                }

                .qr-canvas-wrap {
                    padding: 8px;
                    background: #0a0e1a;
                    border-radius: 10px;
                    border: 1px solid rgba(14, 116, 144, 0.4);
                    box-shadow: 0 0 16px rgba(14, 116, 144, 0.12);
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
                    gap: 6px;
                }

                .qr-btn {
                    padding: 6px 12px;
                    border-radius: 6px;
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
                    background: var(--teal);
                    border: none;
                    color: white;
                }

                .qr-primary:hover:not(:disabled) {
                    background: var(--teal-light);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 10px rgba(14, 116, 144, 0.35);
                }

                .qr-secondary {
                    background: transparent;
                    border: 1px solid rgba(14, 116, 144, 0.5);
                    color: var(--teal-light);
                }

                .qr-secondary:hover {
                    background: rgba(14, 116, 144, 0.1);
                    transform: translateY(-1px);
                }
            `));
};