'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const ThemeContext = createContext({ dark: false, ready: false, toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      const saved = document.cookie.match(/(?:^|; )ajust-theme=(light|dark)(?:;|$)/);
      const next = saved ? saved[1] === 'dark' : media.matches;
      document.documentElement.classList.toggle('dark', next);
      document.documentElement.style.colorScheme = next ? 'dark' : 'light';
      setDark(next);
    };
    sync();
    setReady(true);
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const toggle = () => {
    const next = !dark;
    document.cookie = `ajust-theme=${next ? 'dark' : 'light'}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.style.colorScheme = next ? 'dark' : 'light';
    setDark(next);
  };

  return <ThemeContext.Provider value={{ dark, ready, toggle }}>{children}</ThemeContext.Provider>;
}

export const useAppTheme = () => useContext(ThemeContext);
