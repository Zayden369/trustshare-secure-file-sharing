import React from "react";

export default function Activity() {
  return (
    <div className="page-wrapper">
      <div className="page-header">
        <h1>Activity</h1>
        <p>Monitor recent file activity and user actions.</p>
      </div>

      <div
        style={{
          marginTop: "24px",
          padding: "32px",
          borderRadius: "16px",
          background: "var(--card-bg, #fff)",
          border: "1px solid #e0e0e0",
          textAlign: "center",
        }}
      >
        <h3>No recent activity</h3>
        <p>Recent file uploads, downloads, shares, and logins will appear here.</p>
      </div>
    </div>
  );
}
