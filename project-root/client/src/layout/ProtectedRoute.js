import React from "react";
import { Navigate } from "react-router-dom";
import BootScreen from "../components/BootScreen";
import { useAuth } from "../context/AuthContext";

// FIX ISS-L4: Moved inline CSS to ProtectedRoute.css
import "./ProtectedRoute.css";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <BootScreen/>;
  }

  if (!user) return <Navigate to="/login" replace />;

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
