import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ROUTE_TITLES = {
  "/":                "Your files. Your control.",
  "/dashboard":       "Dashboard",
  "/files":           "My Files",
  "/my-files":        "My Files",
  "/sharing":         "Sharing",
  "/shared-with-me":  "Shared with Me",
  "/activity":        "Activity",
  "/notifications":   "Notifications",
  "/analytics":       "Analytics",
  "/assistant":       "AI Assistant",
  "/admin":           "Admin",
  "/settings":        "Settings",
  "/login":           "Sign In",
  "/signup":          "Create Account",
  "/verify-otp":      "Verify OTP",
  "/forgot-password": "Forgot Password",
  "/reset-password":  "Reset Password",
  "/s":               "Public Vault",
};

const APP_NAME = "TrustShare";

export default function PageTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (ROUTE_TITLES[pathname]) {
      document.title = `${ROUTE_TITLES[pathname]} — ${APP_NAME}`;
      return;
    }

    const matchedKey = Object.keys(ROUTE_TITLES)
      .sort((a, b) => b.length - a.length)
      .find((key) => key !== "/" && pathname.startsWith(key));

    const pageTitle = matchedKey
      ? ROUTE_TITLES[matchedKey]
      : "Page Not Found";

    document.title = `${pageTitle} — ${APP_NAME}`;
  }, [pathname]);

  return null;
}
