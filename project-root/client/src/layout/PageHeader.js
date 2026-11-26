import React from "react";
import { motion } from "framer-motion";
import "./PageHeader.css";

export default function PageHeader({
  title,
  subtitle,
  buttonText,
  buttonIcon,
  onButtonClick,
}) {
  return (
    <div className="page-header">
      <div className="page-header-left">
        <motion.h1
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        >
          {title}
        </motion.h1>
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.3,
              delay: 0.05,
              ease: [0.32, 0.72, 0, 1],
            }}
          >
            {subtitle}
          </motion.p>
        )}
      </div>

      {buttonText && (
        <motion.button
          className="page-header-btn"
          onClick={onButtonClick}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.3,
            delay: 0.1,
            ease: [0.32, 0.72, 0, 1],
          }}
          whileHover={{
            y: -2,
            boxShadow: "0 12px 24px rgba(96, 96, 96, 0.35)",
          }}
          whileTap={{ scale: 0.97 }}
        >
          {buttonIcon}
          {buttonText}
        </motion.button>
      )}
    </div>
  );
}
