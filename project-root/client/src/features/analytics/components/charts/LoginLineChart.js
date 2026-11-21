// client/src/features/analytics/components/charts/LoginLineChart.js
/**
 * Login Activity — dual line chart (Success + Failed).
 */

import React from "react";
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import Card, { CardHeader } from "../shared/Card";
import ChartTooltip from "./ChartTooltip";
import { LineChartSkeleton } from "../shared/Skeleton";
import EmptyState from "../shared/EmptyState";
import useChartTheme from "../../hooks/useChartTheme";

export default function LoginLineChart({
  loginActivity = [],
  loading = false,
  config = {},
}) {
  const ct = useChartTheme();

  const title        = config.title         || "Login Activity";
  const successLabel = config.success_label || "Success";
  const failedLabel  = config.failed_label  || "Failed";

  const totalSuccess = loginActivity.reduce((s, d) => s + (d.success || 0), 0);
  const totalFailed  = loginActivity.reduce((s, d) => s + (d.failed  || 0), 0);
  const total        = totalSuccess + totalFailed;
  const successRate  = total > 0 ? Math.round((totalSuccess / total) * 100) : 0;

  const rateColor =
    successRate >= 90 ? "var(--an-kpi-emerald)"
    : successRate >= 75 ? "var(--an-kpi-amber)"
    : "var(--an-kpi-red)";

  const rateBg =
    successRate >= 90 ? "var(--an-kpi-emerald-bg)"
    : successRate >= 75 ? "var(--an-kpi-amber-bg)"
    : "var(--an-kpi-red-bg)";

  const Legend = () => (
    <div className="an-chart-legend">
      <span className="an-legend-item">
        <span
          className="an-legend-dot"
          style={{ background: ct.successStroke }}
        />
        {successLabel}
      </span>
      <span className="an-legend-item">
        <span
          className="an-legend-dot"
          style={{ background: ct.failedStroke }}
        />
        {failedLabel}
      </span>

      {/* ✅ NEW: Success rate badge */}
      {loginActivity.length > 0 && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.4, ease: [0.32, 0.72, 0, 1] }}
          style={{
            fontSize:     11,
            fontWeight:   600,
            padding:      "3px 10px",
            borderRadius: 999,
            background:   rateBg,
            color:        rateColor,
            letterSpacing: "-0.05px",
            border:       `1px solid ${rateColor}30`,
          }}
        >
          {successRate}% success
        </motion.span>
      )}
    </div>
  );

  return (
    <Card delay={0.1} className="an-chart-card">
      <CardHeader
        title={title}
        right={!loading && <Legend />}
      />

      {loading ? (
        <LineChartSkeleton height={200} />
      ) : !loginActivity.length ? (
        <EmptyState message="No login activity data yet." />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <LineChart
              data={loginActivity}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={ct.gridStroke} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: ct.axisTickFontSize, fill: ct.axisTickFill }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: ct.axisTickFontSize, fill: ct.axisTickFill }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />

              <Line
                type="monotone"
                dataKey="success"
                name={successLabel}
                stroke={ct.successStroke}
                strokeWidth={2}
                dot={false}
                animationDuration={1200}
              />
              <Line
                type="monotone"
                dataKey="failed"
                name={failedLabel}
                strokeDasharray="5 4"
                stroke={ct.failedStroke}
                strokeWidth={2}
                dot={{ fill: ct.failedDotFill, r: 3 }}
                animationDuration={1400}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </Card>
  );
}
