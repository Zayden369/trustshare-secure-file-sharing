// client/src/features/analytics/components/charts/FileTypeDonut.js

import React from "react";
import {
  PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import Card from "../shared/Card";
import ChartTooltip from "./ChartTooltip";
import { DonutSkeleton } from "../shared/Skeleton";
import EmptyState from "../shared/EmptyState";
import useChartTheme from '../../hooks/useChartTheme';

export default function FileTypeDonut({
  fileTypes: sourceFileTypes = [],
  loading = false,
  config = {},
}) {
  const ct = useChartTheme();
  const fileTypes = sourceFileTypes.map((item,index)=>({...item,color:ct.series[index%ct.series.length]}));
  const title = config.title || "File Type Distribution";
  const subtitle = config.subtitle || "Breakdown by file format";

  const totalFiles = fileTypes.reduce((sum, t) => sum + (t.count || 0), 0);

  return (
    <Card delay={0.3}>
      {/* Header */}
      <div className="an-card-header">
        <div>
          <h3 className="an-card-title">{title}</h3>
          <p className="an-chart-meta" style={{ marginTop: 4 }}>
            {subtitle}
          </p>
        </div>
        {!loading && fileTypes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="an-filetype-badge"
          >
            {totalFiles} {totalFiles === 1 ? "file" : "files"}
          </motion.div>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <DonutSkeleton legendRows={5} size={180} showCenter />
      ) : !fileTypes.length ? (
        <EmptyState message="No files uploaded yet." />
      ) : (
        <motion.div
          className="an-filetype-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          {/* Donut */}
          <div className="an-filetype-chart">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={fileTypes}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  dataKey="count"
                  nameKey="type"
                  paddingAngle={3}
                  animationDuration={1200}
                  animationBegin={200}
                >
                  {fileTypes.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      style={{
                        filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.06))",
                        cursor: "pointer",
                        transition: "opacity 0.2s ease",
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<FileTypeTooltip totalFiles={totalFiles} />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center label */}
            <AnimatePresence>
              <motion.div
                key="center"
                className="an-filetype-center"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.6,
                  duration: 0.4,
                  ease: [0.32, 0.72, 0, 1]
                }}
              >
                <div className="an-filetype-center-num">{totalFiles}</div>
                <div className="an-filetype-center-label">
                  {totalFiles === 1 ? "File" : "Files"}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Legend */}
          <div className="an-filetype-legend">
            {fileTypes.slice(0, 6).map((type, i) => {
              const pct = totalFiles > 0
                ? ((type.count / totalFiles) * 100).toFixed(1)
                : 0;
              return (
                <motion.div
                  key={type.type}
                  className="an-filetype-item"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: 0.3 + i * 0.06,
                    duration: 0.35,
                    ease: [0.32, 0.72, 0, 1],
                  }}
                  whileHover={{ x: -2, transition: { duration: 0.15 } }}
                >
                  <div className="an-filetype-item-left">
                    <span
                      className="an-filetype-dot"
                      style={{ background: type.color }}
                    />
                    <span className="an-filetype-name">{type.type}</span>
                  </div>
                  <div className="an-filetype-item-right">
                    <span className="an-filetype-count">{type.count}</span>
                    <span className="an-filetype-pct">{pct}%</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}
    </Card>
  );
}


function FileTypeTooltip({ active, payload, totalFiles }) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const pct = totalFiles > 0
    ? ((data.count / totalFiles) * 100).toFixed(1)
    : 0;

  return (
    <div className="an-tooltip">
      <p className="an-tooltip-label" style={{ color: data.color }}>
        {data.type}
      </p>
      <div className="an-tooltip-row">
        <span
          className="an-tooltip-dot"
          style={{ background: data.color }}
        />
        <span className="an-tooltip-name">Files</span>
        <span className="an-tooltip-value">{data.count}</span>
      </div>
      <div className="an-tooltip-row">
        <span
          className="an-tooltip-dot"
          style={{ background: data.color, opacity: 0.6 }}
        />
        <span className="an-tooltip-name">Size</span>
        <span className="an-tooltip-value">{data.size_mb} MB</span>
      </div>
      <div className="an-tooltip-row">
        <span
          className="an-tooltip-dot"
          style={{ background: data.color, opacity: 0.3 }}
        />
        <span className="an-tooltip-name">Share</span>
        <span className="an-tooltip-value">{pct}%</span>
      </div>
    </div>
  );
}
