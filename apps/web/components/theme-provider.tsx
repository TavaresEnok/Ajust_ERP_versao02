'use client';

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';

const ThemeContext = createContext({ dark: true, ready: false, toggle: () => {} });
function subscribeTheme(callback: () => void) {
  window.addEventListener('ajust-theme', callback);
  return () => window.removeEventListener('ajust-theme', callback);
}
function readTheme() {
  const saved = document.cookie.match(/(?:^|; )ajust-theme=(light|dark)(?:;|$)/);
  return saved ? saved[1] === 'dark' : true;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const dark = useSyncExternalStore(subscribeTheme, readTheme, () => true);
  const ready = useSyncExternalStore(
    subscribeTheme,
    () => true,
    () => false,
  );
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);

  const toggle = () => {
    const next = !dark;
    document.cookie = `ajust-theme=${next ? 'dark' : 'light'}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.style.colorScheme = next ? 'dark' : 'light';
    window.dispatchEvent(new Event('ajust-theme'));
  };

  return <ThemeContext.Provider value={{ dark, ready, toggle }}>{children}</ThemeContext.Provider>;
}

export const useAppTheme = () => useContext(ThemeContext);
