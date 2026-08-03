import * as React from 'react';

/**
 * Evaluates a CSS media query and returns its current match state.
 *
 * Uses `useSyncExternalStore` so that on the client the value is read
 * synchronously on the very first render. This avoids a Drawer→Sheet (or
 * vice‑versa) remount in `ResponsiveSheet`/`ResponsiveDialog`, which would
 * otherwise cause Base UI to mount the popup with `open=true` and skip the
 * `data-starting-style` enter animation.
 *
 * On the server we return `false` (mobile-first default). The first client
 * render then commits with the correct value via the synchronous snapshot.
 */
export function useMediaQuery(query?: string) {
  const mediaQuery = query ? `(${query})` : '(min-width: 768px)';

  const subscribe = React.useCallback(
    (callback: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
        return () => {};
      }
      const matcher = window.matchMedia(mediaQuery);
      matcher.addEventListener('change', callback);
      return () => matcher.removeEventListener('change', callback);
    },
    [mediaQuery]
  );

  const getSnapshot = React.useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') {
      return false;
    }
    return window.matchMedia(mediaQuery).matches;
  }, [mediaQuery]);

  const getServerSnapshot = React.useCallback(() => false, []);

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}




