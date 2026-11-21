import React from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCircle } from 'lucide-react';

const NotificationsCard = ({ result }) => {
    const notifs = result?.notifications || [];
    const total = result?.total_matched || 0;

    if (notifs.length === 0) {
        return (
            <div className="asst-card">
                <div className="asst-card-empty">
                    <CheckCircle size={32} style={{ color: '#a0a0a0', marginBottom: 8 }} />
                    <div className="asst-card-empty-title">All caught up!</div>
                    <div className="asst-card-empty-subtitle">
                        No {result?.unread_only ? 'unread ' : ''}notifications
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="asst-card">
            {/* Header */}
            <div className="asst-card-header">
                <div className="asst-card-header-left">
                    <div className="asst-card-icon-box">
                        <Bell size={16} />
                    </div>
                    <div className="asst-card-title">Notifications</div>
                </div>
                <span className="asst-card-meta">{total} total</span>
            </div>

            {/* Notif rows */}
            <div className="asst-card-body-flush">
                {notifs.map((n, idx) => (
                    <motion.div
                        key={idx}
                        className={`asst-notif-row ${n.is_read ? 'read' : ''}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                    >
                        <span className={`asst-notif-dot ${n.is_read ? 'read' : ''}`} />
                        <div className="asst-notif-content">
                            <div className="asst-notif-title">{n.title}</div>
                            {n.message && (
                                <div className="asst-notif-message">{n.message}</div>
                            )}
                            <div className="asst-notif-time">{n.created}</div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default NotificationsCard;
