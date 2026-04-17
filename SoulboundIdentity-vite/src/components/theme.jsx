import React, { useMemo, useEffect } from 'react';

export const ThemeContext = React.createContext({
    theme: 'dark'
});

export function ThemeProvider({ children }) {
    // Always use dark mode
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
    }, []);

    const value = useMemo(() => ({ theme: 'dark' }), []);

    return React.createElement(
        ThemeContext.Provider,
        { value: value },
        children
    );
}

export function useTheme() {
    return React.useContext(ThemeContext);
}
