import React from 'react';
import { motion } from 'framer-motion';
import { Settings, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

const NotConfiguredState = ({ status, onGoToAdmin }) => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    return (
        <div className="asst-empty">
            <motion.div
                className="asst-empty-icon"
                style={{
                    background: 'linear-gradient(135deg, #a0a0a0, #606060)',
                    boxShadow: '0 12px 32px rgba(160, 160, 160, 0.35)',
                }}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
            >
                <ShieldAlert size={36} />
            </motion.div>
            <h2 className="asst-empty-title">Setup Required</h2>
            <p className="asst-empty-subtitle">
                {status?.message ||
                    'The AI Assistant needs to be configured before you can start chatting.'}
            </p>

            {isAdmin ? (
                <motion.button
                    className="asst-not-configured-btn"
                    onClick={onGoToAdmin}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <Settings size={18} />
                    Configure Now
                </motion.button>
            ) : (
                <p style={{ fontSize: 13, color: 'var(--asst-text-muted)' }}>
                    Please contact your administrator to enable this feature.
                </p>
            )}
        </div>
    );
};

export default NotConfiguredState;
