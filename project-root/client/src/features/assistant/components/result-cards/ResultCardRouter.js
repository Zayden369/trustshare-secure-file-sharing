import React from 'react';
import FileListCard from './FileListCard';
import StorageCard from './StorageCard';
import StorageBreakdownCard from './StorageBreakdownCard';
import SharesCard from './SharesCard';
import ProfileCard from './ProfileCard';
import SessionsCard from './SessionsCard';
import NotificationsCard from './NotificationsCard';

const ResultCardRouter = ({ functionName, result }) => {
    if (result?.error) {
        return (
            <div className="asst-msg-bubble assistant" style={{ borderColor: 'rgba(96, 96, 96,0.3)' }}>
                <div style={{ color: '#606060', fontWeight: 600, marginBottom: 6 }}>
                    ⚠️ {functionName}
                </div>
                <div style={{ fontSize: 13, color: 'var(--asst-text-secondary)' }}>
                    {result.message || 'Function encountered an error.'}
                </div>
            </div>
        );
    }

    switch (functionName) {
        case 'list_files':
        case 'search_files':
            return <FileListCard result={result} />;
        case 'get_storage_info':
            return <StorageCard result={result} />;
        case 'get_storage_breakdown':
            return <StorageBreakdownCard result={result} />;
        case 'find_shares':
            return <SharesCard result={result} />;
        case 'get_user_profile':
            return <ProfileCard result={result} />;
        case 'list_active_sessions':
            return <SessionsCard result={result} />;
        case 'get_notifications':
            return <NotificationsCard result={result} />;
        default:
            return (
                <div className="asst-msg-bubble assistant">
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--asst-text-secondary)' }}>
                        {functionName}
                    </div>
                    <pre style={{
                        fontSize: 12,
                        background: 'var(--asst-bg-input)',
                        padding: 12,
                        borderRadius: 8,
                        overflow: 'auto',
                        maxHeight: 300,
                    }}>
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            );
    }
};

export default ResultCardRouter;
