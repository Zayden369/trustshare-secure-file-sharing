// client/src/layout/FaviconBadge.js

import { useEffect } from "react";

export default function FaviconBadge({ count = 0 }) {
  useEffect(() => {
    // Update page title with unread count
    const baseTitle = document.title.replace(/^\(\d+\)\s*/, "");

    if (count > 0) {
      document.title = `(${count}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }

    // Draw badge on favicon
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");

    // Load original favicon
    const img = new Image();
    img.crossOrigin = "anonymous";

    // Use existing favicon or default
    const existingFavicon = document.querySelector('link[rel="icon"]');
    img.src = existingFavicon?.href || "/favicon.ico";

    img.onload = () => {
      // Draw original favicon
      ctx.drawImage(img, 0, 0, 32, 32);

      if (count > 0) {
        // Draw red circle
        const radius = 9;
        const x = 32 - radius;
        const y = radius;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = "#606060";
        ctx.fill();

        // Draw white border
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw count text
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(count > 99 ? "99+" : String(count), x, y + 1);
      }

      // Update favicon
      let link = document.querySelector('link[rel="icon"][data-dynamic]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        link.setAttribute("data-dynamic", "true");
        document.head.appendChild(link);
      }
      link.href = canvas.toDataURL("image/png");
    };

    img.onerror = () => {
      // If original favicon can't load, just skip
    };
  }, [count]);

  return null;
}
