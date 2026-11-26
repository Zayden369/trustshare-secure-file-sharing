import { useEffect, useRef } from 'react';

const keyFor = path => `trustshare:scroll:${path}`;

// Native restoration can run while a lazy route still shows its opening screen.
// Store only a per-tab viewport offset, and restore after that route has layout.
export default function useInitialScrollRestoration(pathname) {
  const currentPath = useRef(pathname);
  const initialPath = useRef(pathname);
  const cancelRestore = useRef(null);
  currentPath.current = pathname;

  useEffect(() => {
    const save = () => {
      try { sessionStorage.setItem(keyFor(currentPath.current), String(window.scrollY)); }
      catch { /* Storage may be disabled; navigation remains usable. */ }
    };
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, []);

  useEffect(() => {
    const navigation = performance.getEntriesByType?.('navigation')?.[0];
    const isReload = navigation?.type === 'reload' || performance.navigation?.type === 1;
    if (!isReload) return;
    let target;
    try { target = Number(sessionStorage.getItem(keyFor(initialPath.current))); }
    catch { return; }
    if (!Number.isFinite(target) || target <= 0) return;

    let done = false, frame = 0, deadline, resizeObserver, mutationObserver;
    const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const finish = () => {
      done = true;
      cancelAnimationFrame(frame);
      clearTimeout(deadline);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('load', attempt);
      window.removeEventListener('pageshow', attempt);
      window.removeEventListener('resize', attempt);
      inputs.forEach(event => window.removeEventListener(event, finish));
    };
    function attempt() {
      if (done || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (done || document.readyState !== 'complete') return;
        if (document.documentElement.scrollHeight < target + window.innerHeight) return;
        window.scrollTo({ top: target, left: 0, behavior: 'instant' });
        finish();
      });
    }

    cancelRestore.current = finish;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(attempt);
      resizeObserver.observe(document.body);
    }
    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(attempt);
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }
    window.addEventListener('load', attempt);
    window.addEventListener('pageshow', attempt);
    window.addEventListener('resize', attempt);
    inputs.forEach(event => window.addEventListener(event, finish, { passive: true }));
    deadline = setTimeout(finish, 10000);
    attempt();
    return finish;
  }, []);

  return cancelRestore;
}
