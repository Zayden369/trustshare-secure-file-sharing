// client/src/features/analytics/components/panels/TopActiveUsers.js

import React from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Award, User } from "lucide-react";
import Card from "../shared/Card";
import { TopUsersSkeleton } from "../shared/Skeleton";
import EmptyState from "../shared/EmptyState";

const RANK_COLORS = {
  1: { color: "#a0a0a0", bg: "rgba(160, 160, 160, 0.12)", icon: Trophy },
  2: { color: "#a0a0a0", bg: "rgba(160, 160, 160, 0.15)", icon: Medal },
  3: { color: "#808080", bg: "rgba(128, 128, 128, 0.12)", icon: Award },
};

const AVATAR_COLORS = [
  "linear-gradient(135deg, #808080, #606060)",
  "linear-gradient(135deg, #808080, #808080)",
  "linear-gradient(135deg, #a0a0a0, #a0a0a0)",
  "linear-gradient(135deg, #a0a0a0, #606060)",
  "linear-gradient(135deg, #808080, #808080)",
];

export default function TopActiveUsers({
  users = [],
  loading = false,
  config = {},
}) {
  const title = config.title || "Top Active Users";
  const subtitle = config.subtitle || "Most active workspace members";

  return (
    <Card delay={0.35} noPadding>
      <div className="an-card-header an-card-header--border">
        <div>
          <h3 className="an-card-title">{title}</h3>
          <p className="an-chart-meta" style={{ marginTop: 4 }}>
            {subtitle}
          </p>
        </div>
        {!loading && users.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="an-topusers-badge"
          >
            Top {users.length}
          </motion.div>
        )}
      </div>

      {loading ? (
        <TopUsersSkeleton rows={5} />
      ) : !users.length ? (
        <div className="an-topusers-empty">
          <EmptyState message="No user activity yet." />
        </div>
      ) : (
        <div className="an-topusers-list">
          {users.map((user, i) => {
            const rankInfo = RANK_COLORS[user.rank];
            const RankIcon = rankInfo?.icon || User;
            const avatarBg = AVATAR_COLORS[i % AVATAR_COLORS.length];

            return (
              <motion.div
                key={user.id}
                className="an-topuser-row"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 0.2 + i * 0.08,
                  duration: 0.4,
                  ease: [0.32, 0.72, 0, 1],
                }}
                whileHover={{ x: 2, transition: { duration: 0.15 } }}
              >
                <div className="an-topuser-rank">
                  {rankInfo ? (
                    <div
                      className="an-topuser-rank-medal"
                      style={{
                        background: rankInfo.bg,
                        color: rankInfo.color,
                      }}
                    >
                      <RankIcon size={14} strokeWidth={2.5} />
                    </div>
                  ) : (
                    <span className="an-topuser-rank-num">
                      #{user.rank}
                    </span>
                  )}
                </div>

                <div
                  className="an-topuser-avatar"
                  style={{ background: avatarBg }}
                >
                  <span>{user.initials}</span>
                </div>

                <div className="an-topuser-info">
                  <div className="an-topuser-top">
                    <span className="an-topuser-name">{user.name}</span>
                    <span className="an-topuser-count">
                      {user.activity.toLocaleString()}
                    </span>
                  </div>
                  <div className="an-topuser-bottom">
                    <span className="an-topuser-email">{user.email}</span>
                    <span className="an-topuser-events">
                      {user.activity === 1 ? "event" : "events"}
                    </span>
                  </div>

                  <div className="an-topuser-track">
                    <motion.div
                      className="an-topuser-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${user.pct}%` }}
                      transition={{
                        delay: 0.4 + i * 0.08,
                        duration: 0.8,
                        ease: [0.32, 0.72, 0, 1],
                      }}
                      style={{ background: avatarBg }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
