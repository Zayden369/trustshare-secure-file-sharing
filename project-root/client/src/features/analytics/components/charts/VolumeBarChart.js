// client/src/features/analytics/components/charts/VolumeBarChart.js

import React, { useId } from "react";
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import Card, { CardHeader } from "../shared/Card";
import ChartTooltip from "./ChartTooltip";
import { BarChartSkeleton } from "../shared/Skeleton";
import EmptyState from "../shared/EmptyState";
import useChartTheme from "../../hooks/useChartTheme";

export default function VolumeBarChart({
  volumeWeekly = [],
  loading = false,
  config = {},
}) {
  const ct = useChartTheme();
  const patternId = `downloads-${useId().replace(/:/g,'')}`;

  const title = config.title || "Upload / Download Volume";
  const uploadLabel = config.upload_label || "Uploads";
  const downloadLabel = config.download_label || "Downloads";

  const Legend = () => (
    <div className="an-chart-legend">
      <span className="an-legend-item">
        <span className="an-legend-dot" style={{ background: ct.uploadFill }} />
        {uploadLabel}
      </span>
      <span className="an-legend-item">
        <span className="an-legend-dot" style={{ background: ct.downloadFill }} />
        {downloadLabel}
      </span>
    </div>
  );

  return (
    <Card delay={0.1} className="an-chart-card">
      <CardHeader
        title={title}
        right={!loading && <Legend />}
      />

      {loading ? (
        <BarChartSkeleton height={200} />
      ) : !volumeWeekly.length ? (
        <EmptyState message="No volume data yet." />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <ResponsiveContainer width="100%" height="100%" minHeight={200}>
            <BarChart
              data={volumeWeekly}
              barGap={3}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs><pattern id={patternId} width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill={ct.downloadFill}/><path d="M0 6L6 0" stroke={ct.tooltipBg} strokeWidth="1"/></pattern></defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={ct.gridStroke}
                vertical={false}
              />
              <XAxis
                dataKey="week"
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

              <Bar
                dataKey="uploads"
                name={uploadLabel}
                fill={ct.uploadFill}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                animationDuration={1200}
              />
              <Bar
                dataKey="downloads"
                name={downloadLabel}
                fill={`url(#${patternId})`}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                animationDuration={1400}
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </Card>
  );
}
