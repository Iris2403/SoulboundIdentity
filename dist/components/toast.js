// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================
ToastContext = React.createContext({
  addToast: () => {}
});
Toast = function ({
  message,
  type,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `toast toast-${type}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "toast-icon"
  }, type === 'success' && '✅', type === 'error' && '❌', type === 'warning' && '⚠️', type === 'info' && 'ℹ️'), /*#__PURE__*/React.createElement("div", {
    className: "toast-message"
  }, message), /*#__PURE__*/React.createElement("button", {
    className: "toast-close",
    onClick: onClose
  }, "\xD7"));
};
ToastProvider = function ({
  children
}) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, {
      id,
      message,
      type
    }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);
  const removeToast = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  const value = useMemo(() => ({
    addToast
  }), [addToast]);
  return React.createElement(ToastContext.Provider, {
    value: value
  }, children, React.createElement('div', {
    className: 'toast-container'
  }, toasts.map(toast => React.createElement(Toast, {
    key: toast.id,
    message: toast.message,
    type: toast.type,
    onClose: () => removeToast(toast.id)
  }))));
};
useToast = () => {
  return React.useContext(ToastContext);
};