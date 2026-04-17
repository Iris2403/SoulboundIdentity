import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from './components/theme';
import { ToastProvider } from './components/toast';
import { App } from './components/app-component';
import './styles.css';

function AppRoot() {
    const [isReady, setIsReady] = React.useState(false);

    React.useEffect(() => {
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

    return (
        <ThemeProvider>
            <ToastProvider>
                <App />
            </ToastProvider>
        </ThemeProvider>
    );
}

console.log('✅ Rendering app...');
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AppRoot />);
console.log('✅ App rendered!');
