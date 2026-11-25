import React from 'react';
import { motion } from 'framer-motion';
import BrandMark from '../../../components/BrandMark';
import SuggestedQueries from './SuggestedQueries';

const EmptyState = ({ botName = 'TrustShare Assistant', onPickSuggestion, compact = false }) => {
    return (
        <div className="asst-empty">
            <motion.div
                className="asst-empty-icon"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            >
                <BrandMark/>
            </motion.div>
            <motion.h2
                className="asst-empty-title"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
            >
                Your workspace, in conversation.
            </motion.h2>
            <motion.p
                className="asst-empty-subtitle"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
            >
                Ask {botName} about your files, storage or sharing. Start with a suggestion below.
            </motion.p>
            <motion.div
                style={{ width: '100%', maxWidth: 720 }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
            >
                <SuggestedQueries onPick={onPickSuggestion} compact={compact} />
            </motion.div>
        </div>
    );
};

export default EmptyState;
