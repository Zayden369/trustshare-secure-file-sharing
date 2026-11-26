// client/src/layout/ToastProvider.js
/**
 * Premium toast notification system.
 * Glassmorphism + smooth animations + auto-dismiss progress.
 *
 * Usage:
 *   import { useToast } from '../layout/ToastProvider';
 *   const toast = useToast();
 *   toast.success("File uploaded!", "Your file is now encrypted and stored securely.");
 *   toast.error("Upload failed", "File exceeds maximum size of 100MB.");
 *   toast.info("Processing", "Encrypting your file...");
 *   toast.warning("Storage warning", "You're at 85% capacity.");
 */

import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
  Sparkles,
} from "lucide-react";
import "./ToastProvider.css";

const ToastContext = createContext(null);

let toastId = 0;

const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    duration: 4000,
    accentColor: "#a0a0a0",
    gradientFrom: "rgba(160, 160, 160, 0.15)",
    gradientTo: "rgba(160, 160, 160, 0)",
  },
  error: {
    icon: XCircle,
    duration: 6000,
    accentColor: "#606060",
    gradientFrom: "rgba(96, 96, 96, 0.15)",
    gradientTo: "rgba(96, 96, 96, 0)",
  },
  warning: {
    icon: AlertTriangle,
    duration: 5000,
    accentColor: "#a0a0a0",
    gradientFrom: "rgba(160, 160, 160, 0.15)",
    gradientTo: "rgba(160, 160, 160, 0)",
  },
  info: {
    icon: Info,
    duration: 4000,
    accentColor: "#606060",
    gradientFrom: "rgba(96, 96, 96, 0.15)",
    gradientTo: "rgba(96, 96, 96, 0)",
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(
    (title, description = "", type = "info", duration) => {
      const id = ++toastId;
      const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
      const finalDuration = duration || config.duration;

      setToasts((prev) => [...prev, { id, title, description, type, config }]);

      if (finalDuration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, finalDuration);
      }

      return id;
    },
    []
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (title, desc, dur) => addToast(title, desc, "success", dur),
    error: (title, desc, dur) => addToast(title, desc, "error", dur),
    warning: (title, desc, dur) => addToast(title, desc, "warning", dur),
    info: (title, desc, dur) => addToast(title, desc, "info", dur),
    remove: removeToast,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}

      <div className="premium-toast-container">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => {
            const Icon = t.config.icon;
            const dur = t.config.duration / 1000;

            return (
              <motion.div
                key={t.id}
                className={`premium-toast premium-toast--${t.type}`}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.92, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: 80, scale: 0.9, filter: "blur(4px)" }}
                transition={{
                  duration: 0.35,
                  ease: [0.32, 0.72, 0, 1],
                  layout: { duration: 0.25 },
                }}
              >
                {/* Left accent gradient */}
                <div
                  className="premium-toast-accent"
                  style={{
                    background: `linear-gradient(180deg, ${t.config.gradientFrom}, ${t.config.gradientTo})`,
                  }}
                />

                {/* Icon with glow */}
                <div className="premium-toast-icon-wrap">
                  <div
                    className="premium-toast-icon-glow"
                    style={{
                      background: t.config.gradientFrom,
                      boxShadow: `0 0 20px ${t.config.gradientFrom}`,
                    }}
                  />
                  <div
                    className="premium-toast-icon"
                    style={{ color: t.config.accentColor }}
                  >
                    <Icon size={18} strokeWidth={2.5} />
                  </div>
                </div>

                {/* Content */}
                <div className="premium-toast-content">
                  <div className="premium-toast-title">{t.title}</div>
                  {t.description && (
                    <div className="premium-toast-desc">{t.description}</div>
                  )}
                </div>

                {/* Close button */}
                <motion.button
                  className="premium-toast-close"
                  onClick={() => removeToast(t.id)}
                  aria-label="Dismiss"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={14} />
                </motion.button>

                {/* Auto-dismiss progress */}
                <motion.div
                  className="premium-toast-progress"
                  style={{ background: t.config.accentColor }}
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{
                    duration: dur,
                    ease: "linear",
                  }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    console.warn("useToast must be used within ToastProvider");
    return {
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
      remove: () => {},
    };
  }
  return ctx;
}
