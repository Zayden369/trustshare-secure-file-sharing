// client/src/features/analytics/components/charts/DepartmentDonut.js
import React, { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import Card from "../shared/Card";
import ChartTooltip from "./ChartTooltip";
import { DonutSkeleton } from "../shared/Skeleton";
import EmptyState from "../shared/EmptyState";
import useChartTheme from '../../hooks/useChartTheme';

export default function DepartmentDonut({
  byDepartment: sourceDepartments = [],
  loading = false,
  config = {},
}) {
  const ct = useChartTheme();
  const byDepartment = sourceDepartments.map((item,index)=>({...item,color:ct.series[index%ct.series.length]}));
  const title = config.title || "Sharing by Department";
  const [activeIndex, setActiveIndex] = useState(null);

  const total = byDepartment.reduce((s, d) => s + (d.value || 0), 0);
  const activeItem = activeIndex !== null ? byDepartment[activeIndex] : null;

  return (
    <Card delay={0.2}>
      <h3 className="an-card-title" style={{ marginBottom: "16px" }}>
        {title}
      </h3>

      {loading ? (
        <DonutSkeleton legendRows={5} size={140} />
      ) : !byDepartment.length ? (
        <EmptyState message="No sharing data yet." />
      ) : (
        <motion.div
          className="an-donut-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{ display: "flex", alignItems: "center", gap: "24px" }}
        >
          <div
            style={{
              position: "relative",
              width: 140,
              height: 140,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byDepartment}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={64}
                    cornerRadius={5}
                    paddingAngle={3}
                    dataKey="value"
                    animationDuration={800}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {byDepartment.map((d, index) => (
                      <Cell
                        key={d.name}
                        fill={d.color}
                        opacity={
                          activeIndex === null || activeIndex === index ? 1 : 0.35
                        }
                        style={{
                          transition: "opacity 0.2s ease",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div
              style={{
                position: "relative",
                zIndex: 1,
                textAlign: "center",
                pointerEvents: "none",
                maxWidth: 74,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--an-text-primary)",
                  lineHeight: 1.1,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.5px",
                }}
              >
                {activeItem ? `${activeItem.value}%` : `${total}%`}
              </div>

              <div
                style={{
                  fontSize: 10,
                  color: "var(--an-text-tertiary)",
                  marginTop: 3,
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {activeItem ? activeItem.name : "Total"}
              </div>
            </div>
          </div>

          <div className="an-donut-legend" style={{ flex: 1 }}>
            {byDepartment.map((d, index) => {
              const isHovered = activeIndex === index;

              return (
                <div
                  key={d.name}
                  className="an-donut-legend-row"
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  style={{
                    cursor: "pointer",
                    opacity: activeIndex === null || isHovered ? 1 : 0.45,
                    transition: "opacity 0.2s ease",
                  }}
                >
                  <span
                    className="an-donut-legend-dot"
                    style={{ background: d.color }}
                  />
                  <span className="an-donut-legend-name">{d.name}</span>
                  <span className="an-donut-legend-value">{d.value}%</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </Card>
  );
}
