import React from 'react';
import * as LucideIcons from 'lucide-react';
import { motion } from 'framer-motion';
import { useSuggestions } from '../hooks/useSuggestions';
import { Lightbulb } from 'lucide-react';

const CATEGORY_LABELS = {
    files: 'Files',
    storage: 'Storage',
    shares: 'Sharing',
    account: 'Account',
};

const SuggestedQueries = ({ onPick, compact = false }) => {
    const { grouped, loading } = useSuggestions();

    if (loading) return null;

    const categories = Object.keys(grouped);
    if (categories.length === 0) return null;

    // Compact = only show 4 total (one from each category)
    const items = compact
        ? categories.slice(0, 4).map((cat) => grouped[cat][0]).filter(Boolean)
        : null;

    const Icon = (name) => {
        const C = LucideIcons[name];
        return C ? <C size={16} /> : <LucideIcons.Sparkles size={16} />;
    };

    if (compact) {
        return (
            <div className="asst-suggestions">
                <div className="asst-suggestions-title">
                    <Lightbulb size={14} />
                    <span>Try asking</span>
                </div>
                <div className="asst-suggestion-grid">
                    {items.map((q) => (
                        <motion.button
                            key={q.id}
                            className="asst-suggestion-btn"
                            whileHover={{ y: -2 }}
                            onClick={() => onPick(q.query_text, { intent_id: q.intent_id, suggestion_id: q.id })}
                        >
                            <span className="asst-suggestion-icon">{Icon(q.icon_name)}</span>
                            <span>{q.query_text}</span>
                        </motion.button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="asst-suggestions">
            {categories.map((cat) => (
                <div key={cat} style={{ marginBottom: 20 }}>
                    <div className="asst-suggestions-title">
                        <Lightbulb size={14} />
                        <span>{CATEGORY_LABELS[cat] || cat}</span>
                    </div>
                    <div className="asst-suggestion-grid">
                        {grouped[cat].map((q) => (
                            <motion.button
                                key={q.id}
                                className="asst-suggestion-btn"
                                whileHover={{ y: -2 }}
                                onClick={() => onPick(q.query_text, { intent_id: q.intent_id, suggestion_id: q.id })}
                            >
                                <span className="asst-suggestion-icon">{Icon(q.icon_name)}</span>
                                <span>{q.query_text}</span>
                            </motion.button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SuggestedQueries;
