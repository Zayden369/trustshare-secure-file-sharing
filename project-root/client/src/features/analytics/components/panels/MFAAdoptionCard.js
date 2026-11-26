// client/src/features/analytics/components/panels/MFAAdoptionCard.js

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell,
  ResponsiveContainer,
} from "recharts";
import { Shield, ShieldCheck, ShieldOff, Lightbulb } from "lucide-react";
import Card from "../shared/Card";
import { MFAAdoptionSkeleton } from "../shared/Skeleton";

export default function MFAAdoptionCard({
  mfaData = null,
  loading = false,
  config = {},
}) {
  const title = config.title || "MFA Adoption";
  const subtitle = config.subtitle || "Multi-factor authentication usage";
  const meta = config.meta || "across all users";
  const emptyMsg = config.empty || "No user data available.";
  const enabledLabel = config.enabled_label || "MFA Enabled";
  const disabledLabel = config.disabled_label || "MFA Disabled";
  const recLow = config.recommendation_low || "Enable MFA for better security";
  const recGood = config.recommendation_good || "Great adoption rate!";

  const [displayPct, setDisplayPct] = useState(0);

  useEffect(() => {
    if (!mfaData?.adoption_pct && mfaData?.adoption_pct !== 0) return;
    const target = mfaData.adoption_pct;
    const duration = 1200;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPct(target * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [mfaData?.adoption_pct]);

  // Loading state
  if (loading) {
    return (
      <Card delay={0.3}>
        <div className="an-card-header">
          <div>
            <h3 className="an-card-title">{title}</h3>
            <p className="an-chart-meta" style={{ marginTop: 4 }}>
              {subtitle}
            </p>
          </div>
        </div>
        <MFAAdoptionSkeleton />
      </Card>
    );
  }

  // Empty state
  if (!mfaData || mfaData.total_users === 0) {
    return (
      <Card delay={0.3}>
        <div className="an-card-header">
          <div>
            <h3 className="an-card-title">{title}</h3>
            <p className="an-chart-meta" style={{ marginTop: 4 }}>
              {subtitle}
            </p>
          </div>
        </div>
        <div className="an-mfa-empty">
          <Shield size={40} strokeWidth={1.5} />
          <p>{emptyMsg}</p>
        </div>
      </Card>
    );
  }

  const {
    total_users,
    mfa_enabled,
    mfa_disabled,
    adoption_pct,
    status,
    color,
  } = mfaData;

  // Data for donut
  const chartData = [
    { name: enabledLabel, value: mfa_enabled, color: color || "#a0a0a0" },
    { name: disabledLabel, value: mfa_disabled, color: "var(--an-top-file-track-bg)" },
  ];

  // Recommendation based on adoption
  const isGoodAdoption = adoption_pct >= 50;
  const recommendation = isGoodAdoption ? recGood : recLow;

  return (
    <Card delay={0.3}>
      <div className="an-card-header">
        <div>
          <h3 className="an-card-title">{title}</h3>
          <p className="an-chart-meta" style={{ marginTop: 4 }}>
            {subtitle}
          </p>
        </div>
        <motion.div
          className="an-mfa-status-badge"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          style={{
            background: `${color}15`,
            color: color,
            borderColor: `${color}30`,
          }}
        >
          {status}
        </motion.div>
      </div>

      <div className="an-mfa-container">
        {/* Donut with center percentage */}
        <div className="an-mfa-chart">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={44}
                outerRadius={65}
                dataKey="value"
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
                animationDuration={1200}
                animationBegin={200}
              >
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.color}
                    stroke="var(--an-card-bg)"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Center percentage */}
          <div className="an-mfa-center">
            <div
              className="an-mfa-center-num"
              style={{ color: color }}
            >
              {Math.round(displayPct)}
              <span className="an-mfa-center-pct">%</span>
            </div>
            <div className="an-mfa-center-label">
              Adopted
            </div>
          </div>
        </div>

        {/* Stats + recommendation */}
        <div className="an-mfa-info">
          {/* Stats rows */}
          <div className="an-mfa-stats">
            <motion.div
              className="an-mfa-stat"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <div
                className="an-mfa-stat-icon"
                style={{
                  background: `${color}20`,
                  color: color,
                }}
              >
                <ShieldCheck size={16} strokeWidth={2.5} />
              </div>
              <div className="an-mfa-stat-body">
                <div className="an-mfa-stat-value">
                  {mfa_enabled.toLocaleString()}
                </div>
                <div className="an-mfa-stat-label">{enabledLabel}</div>
              </div>
            </motion.div>

            <motion.div
              className="an-mfa-stat"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              <div className="an-mfa-stat-icon an-mfa-stat-icon--disabled">
                <ShieldOff size={16} strokeWidth={2.5} />
              </div>
              <div className="an-mfa-stat-body">
                <div className="an-mfa-stat-value">
                  {mfa_disabled.toLocaleString()}
                </div>
                <div className="an-mfa-stat-label">{disabledLabel}</div>
              </div>
            </motion.div>
          </div>

          {/* Total users indicator */}
          <motion.div
            className="an-mfa-total"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.4 }}
          >
            <span className="an-mfa-total-label">Total Users</span>
            <span className="an-mfa-total-value">
              {total_users.toLocaleString()}
            </span>
          </motion.div>

          {/* Recommendation */}
          <motion.div
            className={`an-mfa-recommendation ${isGoodAdoption ? "an-mfa-recommendation--good" : "an-mfa-recommendation--warn"
              }`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
          >
            <Lightbulb size={13} strokeWidth={2.5} />
            <span>{recommendation}</span>
          </motion.div>
        </div>
      </div>
    </Card>
  );
}
