import React from "react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import Breadcrumbs from "./Breadcrumbs";
import "./PageContainer.css";

// Pages where breadcrumbs should NOT show
const HIDE_BREADCRUMBS = ["/dashboard"];

export default function PageContainer({ children }) {
  const location = useLocation();

  const showBreadcrumbs = !HIDE_BREADCRUMBS.includes(location.pathname);

  return (
    <div className="page-wrapper">
      <motion.div
        key={location.pathname}
        className="page-container"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.35,
          ease: [0.32, 0.72, 0, 1],
        }}
      >
        {showBreadcrumbs && <Breadcrumbs />}
        {children}
      </motion.div>
    </div>
  );
}
