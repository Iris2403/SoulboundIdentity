// ============================================
// IMPROVED CHECKBOX COMPONENT
// ============================================
Checkbox = ({
  label,
  checked,
  onChange,
  disabled = false,
  id,
  name
}) => {
  const generatedId = React.useId();
  const checkboxId = id || `checkbox-${generatedId}`;
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: checkboxId,
    className: `checkbox-label ${disabled ? 'disabled' : ''}`
  }, /*#__PURE__*/React.createElement("input", {
    id: checkboxId,
    name: name,
    type: "checkbox",
    checked: checked,
    onChange: e => onChange(e.target.checked),
    disabled: disabled,
    className: "checkbox-input",
    "aria-checked": checked
  }), /*#__PURE__*/React.createElement("span", {
    className: "checkbox-custom",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "checkbox-text"
  }, label));
};

// ============================================
// TRANSACTION STATUS WIDGET
// ============================================
TransactionStatus = function ({
  pendingTxs
}) {
  const activeTxs = pendingTxs.filter(tx => tx.status === 'pending');
  if (activeTxs.length === 0) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "tx-status-widget"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tx-widget-header"
  }, /*#__PURE__*/React.createElement("span", null, "\u23F3 Pending Transactions")), activeTxs.map(tx => /*#__PURE__*/React.createElement("div", {
    key: tx.id,
    className: "tx-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "loading-spinner loading-small"
  }, /*#__PURE__*/React.createElement("div", {
    className: "spinner"
  })), /*#__PURE__*/React.createElement("span", {
    className: "tx-description"
  }, tx.description), /*#__PURE__*/React.createElement("a", {
    href: `${CONFIG.BLOCK_EXPLORER}/tx/${tx.hash}`,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "tx-link"
  }, "View \u2192"))));
};

// ============================================
// GAS ESTIMATE DISPLAY
// ============================================
GasEstimate = function ({
  gasEstimate
}) {
  if (!gasEstimate) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "gas-estimate"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gas-estimate-header"
  }, /*#__PURE__*/React.createElement("span", null, "\u26FD Gas Estimate")), /*#__PURE__*/React.createElement("div", {
    className: "gas-details"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gas-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gas-label"
  }, "Limit:"), /*#__PURE__*/React.createElement("span", {
    className: "gas-value"
  }, gasEstimate.gasLimit)), /*#__PURE__*/React.createElement("div", {
    className: "gas-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gas-label"
  }, "Price:"), /*#__PURE__*/React.createElement("span", {
    className: "gas-value"
  }, gasEstimate.gasPrice, " Gwei")), /*#__PURE__*/React.createElement("div", {
    className: "gas-item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "gas-label"
  }, "Estimated Cost:"), /*#__PURE__*/React.createElement("span", {
    className: "gas-value"
  }, parseFloat(gasEstimate.estimatedCost).toFixed(6), " ETH"))));
};

// ============================================
// IPFS METADATA DISPLAY
// ============================================
MetadataDisplay = function ({
  cid,
  showNotification
}) {
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
  if (loading) return /*#__PURE__*/React.createElement(LoadingSpinner, null);
  if (error || !metadata) {
    return /*#__PURE__*/React.createElement("div", {
      className: "metadata-error"
    }, /*#__PURE__*/React.createElement("p", null, "Failed to load metadata"), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: '0.875rem',
        color: 'var(--text-muted)'
      }
    }, "IPFS gateway may be slow or unavailable"));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "metadata-display"
  }, /*#__PURE__*/React.createElement("h4", null, "Profile Information"), metadata.name && /*#__PURE__*/React.createElement("div", {
    className: "metadata-item"
  }, /*#__PURE__*/React.createElement("strong", null, "Name:"), " ", metadata.name), metadata.bio && /*#__PURE__*/React.createElement("div", {
    className: "metadata-item"
  }, /*#__PURE__*/React.createElement("strong", null, "Bio:"), " ", metadata.bio), metadata.email && /*#__PURE__*/React.createElement("div", {
    className: "metadata-item"
  }, /*#__PURE__*/React.createElement("strong", null, "Email:"), " ", metadata.email), metadata.location && /*#__PURE__*/React.createElement("div", {
    className: "metadata-item"
  }, /*#__PURE__*/React.createElement("strong", null, "Location:"), " ", metadata.location), metadata.image && /*#__PURE__*/React.createElement("div", {
    className: "metadata-image-container"
  }, /*#__PURE__*/React.createElement("img", {
    src: `${CONFIG.IPFS_GATEWAY}${metadata.image}`,
    alt: "Profile",
    className: "metadata-image"
  })));
};

// Styled Components
Card = ({
  children,
  className = '',
  style = {}
}) => /*#__PURE__*/React.createElement("div", {
  className: `card ${className}`,
  style: style
}, children);
Button = ({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  className = '',
  style = {}
}) => /*#__PURE__*/React.createElement("button", {
  className: `btn btn-${variant} ${className}`,
  onClick: onClick,
  disabled: disabled,
  style: style
}, children);
Input = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  required = false,
  id,
  name
}) => {
  const generatedId = React.useId();
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, '-') || generatedId}`;
  const inputName = name || inputId;
  return /*#__PURE__*/React.createElement("div", {
    className: "input-group"
  }, label && /*#__PURE__*/React.createElement("label", {
    className: "input-label",
    htmlFor: inputId
  }, label, required && ' *'), /*#__PURE__*/React.createElement("input", {
    id: inputId,
    name: inputName,
    className: "input-field",
    type: type,
    value: value,
    onChange: e => onChange(e.target.value),
    placeholder: placeholder,
    required: required,
    autoComplete: type === 'email' ? 'email' : type === 'text' ? 'on' : 'off'
  }));
};
Select = ({
  label,
  value,
  onChange,
  options,
  required = false,
  id,
  name
}) => {
  const generatedId = React.useId();
  const selectId = id || `select-${label?.toLowerCase().replace(/\s+/g, '-') || generatedId}`;
  const selectName = name || selectId;
  return /*#__PURE__*/React.createElement("div", {
    className: "input-group"
  }, label && /*#__PURE__*/React.createElement("label", {
    className: "input-label",
    htmlFor: selectId
  }, label, required && ' *'), /*#__PURE__*/React.createElement("select", {
    id: selectId,
    name: selectName,
    className: "input-field",
    value: value,
    onChange: e => onChange(e.target.value),
    required: required
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Select..."), options.map((opt, idx) => /*#__PURE__*/React.createElement("option", {
    key: idx,
    value: opt.value
  }, opt.label))));
};
TextArea = ({
  label,
  value,
  onChange,
  placeholder = '',
  rows = 4,
  id,
  name
}) => {
  const generatedId = React.useId();
  const textareaId = id || `textarea-${label?.toLowerCase().replace(/\s+/g, '-') || generatedId}`;
  const textareaName = name || textareaId;
  return /*#__PURE__*/React.createElement("div", {
    className: "input-group"
  }, label && /*#__PURE__*/React.createElement("label", {
    className: "input-label",
    htmlFor: textareaId
  }, label), /*#__PURE__*/React.createElement("textarea", {
    id: textareaId,
    name: textareaName,
    className: "input-field",
    value: value,
    onChange: e => onChange(e.target.value),
    placeholder: placeholder,
    rows: rows
  }));
};
Modal = function ({
  isOpen,
  onClose,
  title,
  children
}) {
  if (!isOpen) return null;
  const handleOverlayClick = e => {
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
  }, React.createElement('div', {
    className: 'modal-content',
    onClick: e => e.stopPropagation()
  }, React.createElement('div', {
    className: 'modal-header'
  }, React.createElement('h2', null, title), React.createElement('button', {
    className: 'modal-close',
    onClick: onClose
  }, '×')), React.createElement('div', {
    className: 'modal-body'
  }, children)));
};
LoadingSpinner = () => /*#__PURE__*/React.createElement("div", {
  className: "loading-spinner"
}, /*#__PURE__*/React.createElement("div", {
  className: "spinner"
}));