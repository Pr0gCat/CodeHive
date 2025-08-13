'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: 'light' | 'dark';
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  actualTheme: 'light',
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'codehive-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  const [actualTheme, setActualTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    let systemTheme: 'light' | 'dark' = 'light';
    
    if (theme === 'system') {
      systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }

    const resolvedTheme = theme === 'system' ? systemTheme : theme;
    
    root.classList.add(resolvedTheme);
    setActualTheme(resolvedTheme);

    // 設置 CSS 變量
    if (resolvedTheme === 'dark') {
      root.style.setProperty('--background', '222 84% 4.9%');
      root.style.setProperty('--foreground', '210 40% 98%');
      root.style.setProperty('--muted', '217 32% 17.5%');
      root.style.setProperty('--muted-foreground', '215 20% 65%');
      root.style.setProperty('--popover', '222 84% 4.9%');
      root.style.setProperty('--popover-foreground', '210 40% 98%');
      root.style.setProperty('--card', '222 84% 4.9%');
      root.style.setProperty('--card-foreground', '210 40% 98%');
      root.style.setProperty('--border', '217 32% 17.5%');
      root.style.setProperty('--input', '217 32% 17.5%');
      root.style.setProperty('--primary', '210 40% 90%');
      root.style.setProperty('--primary-foreground', '222 84% 4.9%');
      root.style.setProperty('--secondary', '217 32% 17.5%');
      root.style.setProperty('--secondary-foreground', '210 40% 98%');
      root.style.setProperty('--accent', '217 32% 17.5%');
      root.style.setProperty('--accent-foreground', '210 40% 98%');
      root.style.setProperty('--destructive', '0 62% 30%');
      root.style.setProperty('--destructive-foreground', '210 40% 98%');
      root.style.setProperty('--ring', '212 72% 59%');
    } else {
      root.style.setProperty('--background', '0 0% 100%');
      root.style.setProperty('--foreground', '222 84% 4.9%');
      root.style.setProperty('--muted', '210 40% 96%');
      root.style.setProperty('--muted-foreground', '215 16% 47%');
      root.style.setProperty('--popover', '0 0% 100%');
      root.style.setProperty('--popover-foreground', '222 84% 4.9%');
      root.style.setProperty('--card', '0 0% 100%');
      root.style.setProperty('--card-foreground', '222 84% 4.9%');
      root.style.setProperty('--border', '214 32% 91%');
      root.style.setProperty('--input', '214 32% 91%');
      root.style.setProperty('--primary', '222 47% 11%');
      root.style.setProperty('--primary-foreground', '210 40% 98%');
      root.style.setProperty('--secondary', '210 40% 96%');
      root.style.setProperty('--secondary-foreground', '222 47% 11%');
      root.style.setProperty('--accent', '210 40% 96%');
      root.style.setProperty('--accent-foreground', '222 47% 11%');
      root.style.setProperty('--destructive', '0 84% 60%');
      root.style.setProperty('--destructive-foreground', '210 40% 98%');
      root.style.setProperty('--ring', '222 84% 4.9%');
    }
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (theme === 'system') {
        const systemTheme = mediaQuery.matches ? 'dark' : 'light';
        setActualTheme(systemTheme);
        
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(systemTheme);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
    actualTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};