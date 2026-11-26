import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import useInitialScrollRestoration from "./useInitialScrollRestoration";

/**
 * Auto-scroll to top when route changes.
 * Uses multiple techniques for reliability.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  const previousPath = useRef(pathname);
  const cancelRestore = useInitialScrollRestoration(pathname);

  useEffect(() => {
    // Let the browser restore a reload or initial deep link. Reset only on a new route.
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    cancelRestore.current?.();

    // Function to scroll everything
    const scrollAll = () => {
      const behavior = "instant";

      // Window scroll
      window.scrollTo({ top: 0, left: 0, behavior });

      // Document scroll (fallback)
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      // Any custom scroll containers
      [
        ".page-wrapper",
        ".main-area",
        ".page-container",
        ".app-shell",
      ].forEach((selector) => {
        const el = document.querySelector(selector);
        if (el && el.scrollTop > 0) {
          try {
            el.scrollTo({ top: 0, behavior });
          } catch (e) {
            el.scrollTop = 0;
          }
        }
      });
    };

    // Run immediately
    scrollAll();

  }, [pathname, cancelRestore]);

  return null;
}
