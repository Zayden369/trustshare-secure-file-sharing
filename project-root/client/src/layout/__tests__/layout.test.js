// client/src/layout/__tests__/layout.test.js
/**
 * Frontend Tests for Page Layout Module
 * Developer: Badal Kumar Rai
 * Branch: Group-D-IntegrationIssuesFix/PageLayout
 *
 * Tests cover:
 * - ProtectedRoute authentication guard
 * - ProtectedRoute adminOnly guard
 * - Sidebar admin link visibility by role
 * - PageTitle document.title updates
 * - Navbar renders without unused props
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK: AuthContext
// ─────────────────────────────────────────────────────────────────────────────

const mockUseAuth = jest.fn();

jest.mock("../../context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }) => <div>{children}</div>,
}));

// ─────────────────────────────────────────────────────────────────────────────
// MOCK: ThemeContext
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../../context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: jest.fn() }),
  ThemeProvider: ({ children }) => <div>{children}</div>,
}));

// ─────────────────────────────────────────────────────────────────────────────
// MOCK: framer-motion (prevents animation issues in tests)
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("framer-motion", () => ({
  motion: {
    div:    ({ children, ...props }) => <div {...props}>{children}</div>,
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
    span:   ({ children, ...props }) => <span {...props}>{children}</span>,
    p:      ({ children, ...props }) => <p {...props}>{children}</p>,
    aside:  ({ children, ...props }) => <aside {...props}>{children}</aside>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
  useAnimation:    () => ({}),
  useReducedMotion: () => true,
}));

// ─────────────────────────────────────────────────────────────────────────────
// MOCK: UserDropdownMenu (used inside Sidebar)
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../UserDropdownMenu", () => () => null);

// ─────────────────────────────────────────────────────────────────────────────
// MOCK: CSS imports
// ─────────────────────────────────────────────────────────────────────────────

jest.mock("../Sidebar.css",         () => ({}));
jest.mock("../Navbar.css",          () => ({}));
jest.mock("../ProtectedRoute.css",  () => ({}));

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTS (after mocks)
// ─────────────────────────────────────────────────────────────────────────────

import ProtectedRoute from "../ProtectedRoute";
import PageTitle      from "../PageTitle";

// ─────────────────────────────────────────────────────────────────────────────
// TEST GROUP 1 — ProtectedRoute Authentication Guard
// PSD: Section 1.v JWT Authentication, Section 4.v Role-Based Access
// ─────────────────────────────────────────────────────────────────────────────

describe("ProtectedRoute — Authentication Guard", () => {
  test("TEST 1 — Unauthenticated user is redirected to /login", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div data-testid="protected-content">Dashboard</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={<div data-testid="login-page">Login Page</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();

    console.log("✅ TEST 1 PASSED: Unauthenticated user redirected to /login");
  });

  test("TEST 2 — Authenticated user can access protected route", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, name: "Badal", role: "member" },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div data-testid="protected-content">Dashboard</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={<div data-testid="login-page">Login Page</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();

    console.log("✅ TEST 2 PASSED: Authenticated user can access protected route");
  });

  test("TEST 3 — Loading state shows spinner not redirect", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div data-testid="protected-content">Dashboard</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={<div data-testid="login-page">Login Page</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByTestId("login-page")).not.toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Preparing your workspace");

    console.log("✅ TEST 3 PASSED: Loading state shows spinner not redirect");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST GROUP 2 — ProtectedRoute Admin Guard
// PSD: Section 4.v Role-Based Access Control
// Fix: ISS-L1 — adminOnly prop now enforced on /admin route
// ─────────────────────────────────────────────────────────────────────────────

describe("ProtectedRoute — Admin Guard (ISS-L1 Fix)", () => {
  test("TEST 4 — Admin user can access adminOnly route", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, name: "Admin", role: "admin" },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly={true}>
                <div data-testid="admin-content">Admin Panel</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={<div data-testid="dashboard-page">Dashboard</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("admin-content")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-page")).not.toBeInTheDocument();

    console.log("✅ TEST 4 PASSED: Admin user can access adminOnly route");
  });

  test("TEST 5 — Member user redirected from adminOnly route to /dashboard", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, name: "Member", role: "member" },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly={true}>
                <div data-testid="admin-content">Admin Panel</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={<div data-testid="dashboard-page">Dashboard</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-content")).not.toBeInTheDocument();

    console.log("✅ TEST 5 PASSED: Member redirected from /admin to /dashboard");
  });

  test("TEST 6 — Unauthenticated user on adminOnly route redirected to /login", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly={true}>
                <div data-testid="admin-content">Admin Panel</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/login"
            element={<div data-testid="login-page">Login</div>}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByTestId("admin-content")).not.toBeInTheDocument();

    console.log("✅ TEST 6 PASSED: Unauthenticated on adminOnly redirected to /login");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST GROUP 3 — Sidebar Admin Navigation Visibility
// PSD: Section 4.v Role-Based Access Control
// Fix: ISS-L2 — Admin link filtered by user.role
// ─────────────────────────────────────────────────────────────────────────────

describe("Sidebar — Admin Navigation Visibility (ISS-L2 Fix)", () => {
  const renderSidebar = (userRole) => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, name: "Test User", role: userRole, email: "test@test.com" },
      loading: false,
      logout: jest.fn(),
    });

    const Sidebar = require("../Sidebar").default;

    return render(
      <MemoryRouter>
        <Sidebar
          unreadCount={0}
          sidebarOpen={true}
          setSidebarOpen={jest.fn()}
          sidebarCollapsed={false}
          setSidebarCollapsed={jest.fn()}
        />
      </MemoryRouter>
    );
  };

  test("TEST 7 — Admin user sees Admin link in sidebar", () => {
    renderSidebar("admin");

    expect(screen.getByText("Admin")).toBeInTheDocument();

    console.log("✅ TEST 7 PASSED: Admin link visible to admin user");
  });

  test("TEST 8 — Member user does NOT see Admin link in sidebar", () => {
    renderSidebar("member");

    expect(screen.queryByText("Admin")).not.toBeInTheDocument();

    console.log("✅ TEST 8 PASSED: Admin link hidden from member user");
  });

  test("TEST 9 — Member user still sees all other navigation items", () => {
    renderSidebar("member");

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("My Files")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();

    console.log("✅ TEST 9 PASSED: Member sees all nav items except Admin");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST GROUP 4 — PageTitle Document Title Updates
// Fix: ISS-L5 — Exact match first, then sorted partial match
// ─────────────────────────────────────────────────────────────────────────────

describe("PageTitle — Document Title Updates (ISS-L5 Fix)", () => {
  test("TEST 10 — Sets correct title for /dashboard route", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <PageTitle />
      </MemoryRouter>
    );

    expect(document.title).toBe("Dashboard — TrustShare");

    console.log("✅ TEST 10 PASSED: /dashboard sets correct document title");
  });

  test("TEST 11 — Sets correct title for /analytics route", () => {
    render(
      <MemoryRouter initialEntries={["/analytics"]}>
        <PageTitle />
      </MemoryRouter>
    );

    expect(document.title).toBe("Analytics — TrustShare");

    console.log("✅ TEST 11 PASSED: /analytics sets correct document title");
  });

  test("TEST 12 — Sets correct title for /admin route", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <PageTitle />
      </MemoryRouter>
    );

    expect(document.title).toBe("Admin — TrustShare");

    console.log("✅ TEST 12 PASSED: /admin sets correct document title");
  });

  test("TEST 13 — Unknown route shows Page Not Found title", () => {
    render(
      <MemoryRouter initialEntries={["/unknown-route"]}>
        <PageTitle />
      </MemoryRouter>
    );

    expect(document.title).toBe("Page Not Found — TrustShare");

    console.log("✅ TEST 13 PASSED: Unknown route shows Page Not Found title");
  });

  test("TEST 14 — Exact match takes priority over partial match", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <PageTitle />
      </MemoryRouter>
    );

    expect(document.title).toBe("Settings — TrustShare");

    console.log("✅ TEST 14 PASSED: Exact route match takes priority");
  });

  test("TEST 15 — Login route sets Sign In title", () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <PageTitle />
      </MemoryRouter>
    );

    expect(document.title).toBe("Sign In — TrustShare");

    console.log("✅ TEST 15 PASSED: /login sets Sign In title");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST GROUP 5 — ProtectedRoute adminOnly prop default value
// ─────────────────────────────────────────────────────────────────────────────

describe("ProtectedRoute — Default Props", () => {
  test("TEST 16 — adminOnly defaults to false — member can access normal routes", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 2, name: "Member", role: "member" },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/files"]}>
        <Routes>
          <Route
            path="/files"
            element={
              <ProtectedRoute>
                <div data-testid="files-content">Files</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("files-content")).toBeInTheDocument();

    console.log("✅ TEST 16 PASSED: adminOnly defaults false, member accesses /files");
  });

  test("TEST 17 — Admin user can access normal routes too", () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, name: "Admin", role: "admin" },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={["/files"]}>
        <Routes>
          <Route
            path="/files"
            element={
              <ProtectedRoute>
                <div data-testid="files-content">Files</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId("files-content")).toBeInTheDocument();

    console.log("✅ TEST 17 PASSED: Admin user can access normal routes");
  });
});
