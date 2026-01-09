// Main application entry point
// This file orchestrates loading and initializing all modules

// ============================================
// ROOT APP WRAPPER WITH PROVIDERS  
// ============================================
AppRoot = function() {
    const [isReady, setIsReady] = React.useState(false);

    React.useEffect(() => {
        // Wait one tick to ensure providers are mounted
        const timer = setTimeout(() => setIsReady(true), 0);
        return () => clearTimeout(timer);
    }, []);

    if (!isReady) {
        return React.createElement('div', {
            style: {
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                background: '#0a0e1a',
                color: '#06b6d4',
                fontSize: '1.2rem',
                fontFamily: 'Arial, sans-serif'
            }
        }, 'Initializing...');
    }

    return React.createElement(
        ThemeProvider,
        null,
        React.createElement(
            ToastProvider,
            null,
            React.createElement(App, null)
        )
    );
}

// Render the app
console.log('✅ Rendering app...');
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(AppRoot, null));
console.log('✅ App rendered!');
