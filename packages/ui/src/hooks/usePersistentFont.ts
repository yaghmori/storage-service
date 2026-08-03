'use client';

import { FontKey } from '@workspace/ui/config/fonts';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'font';
const COOKIE_KEY = 'font';

export function usePersistentFont(defaultFont: FontKey = 'inter') {
  const [font, setFontState] = useState<FontKey>(defaultFont);

  useEffect(() => {
    // Load from localStorage
    const stored = localStorage.getItem(STORAGE_KEY) as FontKey | null;
    if (stored) setFontState(stored);
  }, []);

  const setFont = (newFont: FontKey) => {
    setFontState(newFont);
    localStorage.setItem(STORAGE_KEY, newFont);
    document.cookie = `${COOKIE_KEY}=${newFont}; path=/; max-age=31536000`;
  };

  const fontClass = `font-${font}`;

  return { font, fontClass, setFont };
}
