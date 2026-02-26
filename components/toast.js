// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================
ToastContext = React.createContext({
    addToast: () => { }
});

Toast = function ({ message, type, onClose }) {
    return (
        <div className={`toast toast-${type}`}>
            <div className="toast-icon">
                {type === 'success' && '✅'}
                {type === 'error' && '❌'}
                {type === 'warning' && '⚠️'}
                {type === 'info' && 'ℹ️'}
            </div>
            <div className="toast-message">{message}</div>
            <button className="toast-close" onClick={onClose}>×</button>
        </div>
    );
}

ToastProvider = function ({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const value = useMemo(() => ({ addToast }), [addToast]);

    return React.createElement(
        ToastContext.Provider,
        { value: value },
        children,
        React.createElement(
            'div',
            { className: 'toast-container' },
            toasts.map(toast =>
                React.createElement(Toast, {
                    key: toast.id,
                    message: toast.message,
                    type: toast.type,
                    onClose: () => removeToast(toast.id)
                })
            )
        )
    );
}

useToast = () => {
    return React.useContext(ToastContext);
};
