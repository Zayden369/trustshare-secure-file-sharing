import React from 'react';

export default function DashboardLoading() {
  return <div aria-label="Loading dashboard" className="dashboard-loading" role="status" aria-live="polite"><div className="dashboard-loading-caption">Preparing your workspace</div><div className="dashboard-skeleton dashboard-skeleton-header"/><div className="dashboard-loading-grid">{[0,1,2,3].map(item=><div className="dashboard-skeleton dashboard-skeleton-card" key={item}/>)}</div><div aria-hidden="true">{[0,1,2].map(item=><div className="dashboard-skeleton dashboard-skeleton-panel" key={item}/>)}</div><span className="sr-only">Loading dashboard data</span></div>;
}
