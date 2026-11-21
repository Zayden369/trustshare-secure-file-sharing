import React from 'react';
import { motion } from 'framer-motion';
import { PieChart } from 'lucide-react';

const COLOR_MAP = {
    documents: '#808080',
    media: '#808080',
    archives: '#a0a0a0',
    other: '#a0a0a0',
};

const StorageBreakdownCard = ({ result }) => {
    const categories = result?.categories || [];

    if (categories.length === 0) {
        return (
            <div className="asst-card">
                <div className="asst-card-empty">
                    <div className="asst-card-empty-title">No files uploaded yet</div>
                </div>
            </div>
        );
    }

    return (
        <div className="asst-card">
            <div className="asst-card-body">
                {/* Header */}
                <div className="asst-storage-header">
                    <div className="asst-card-icon-box">
                        <PieChart size={20} />
                    </div>
                    <div>
                        <div className="asst-card-title">Storage Breakdown</div>
                        <div className="asst-card-subtitle">
                            Total: <strong>{result?.total}</strong>
                        </div>
                    </div>
                </div>

                {/* Category bars */}
                <div className="asst-breakdown-list">
                    {categories.map((cat, idx) => {
                        const color = COLOR_MAP[cat.name.toLowerCase()] || '#a0a0a0';
                        return (
                            <div key={cat.name}>
                                <div className="asst-breakdown-item-header">
                                    <div className="asst-breakdown-label">
                                        <span
                                            className="asst-breakdown-dot"
                                            style={{ background: color }}
                                        />
                                        <span className="asst-breakdown-name">{cat.name}</span>
                                        <span className="asst-breakdown-count">({cat.count} files)</span>
                                    </div>
                                    <div className="asst-breakdown-size">{cat.size}</div>
                                </div>
                                <div className="asst-breakdown-bar-track">
                                    <motion.div
                                        className="asst-breakdown-bar-fill"
                                        style={{ background: color }}
                                        initial={{ width: 0 }}
                                        animate={{ width: `${cat.percent}%` }}
                                        transition={{ delay: idx * 0.1, duration: 0.6 }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default StorageBreakdownCard;
