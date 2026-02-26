// All React components and providers
// Destructure React hooks for easier use
const { useState, useEffect, useCallback, useMemo } = React;

// ============================================
// THEME PROVIDER & CONTEXT
// ============================================
ThemeContext = React.createContext({
    theme: 'dark'
});

ThemeProvider = function ({ children }) {
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

useTheme = () => {
    return React.useContext(ThemeContext);
};
