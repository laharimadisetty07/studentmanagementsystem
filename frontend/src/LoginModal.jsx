import React, { useState, useEffect } from "react";
import { loginAdmin, formatApiError } from "./api";

/**
 * LoginModal component — Multi-Role Secure Authentication.
 * Supports Admin, Faculty, and Student roles with instant demo credentials.
 */
const LoginModal = ({ isOpen, onClose, onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isLoading) onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isLoading]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please enter both username/email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginAdmin(username.trim(), password);
      const { access_token, user } = res.data;
      localStorage.setItem("student_admin_token", access_token);
      localStorage.setItem("student_admin_user", JSON.stringify(user));
      onLoginSuccess(user);
      onClose();
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        "Invalid username/email or password.";
      setError(detail);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = (u, p) => {
    setUsername(u);
    setPassword(p);
    setError("");
  };

  return (
    <div className="modal-overlay" onClick={isLoading ? undefined : onClose}>
      <div
        className="modal-card login-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-dialog-title"
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">🔐</span>
            <div>
              <h2 id="login-dialog-title" className="modal-title">
                Portal Authentication
              </h2>
              <p className="login-modal-subtitle">
                Role-based access for Admins, Faculty, and Students
              </p>
            </div>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (() => {
            const isPending = error.startsWith("PENDING:");
            const isRejected = error.startsWith("REJECTED:");
            const isDeactivated = error.startsWith("DEACTIVATED:");
            const isAccountIssue = isPending || isRejected || isDeactivated;
            const icon = isPending ? "⏳" : isRejected ? "❌" : isDeactivated ? "🚫" : "⚠️";
            const bgColor = isPending
              ? "rgba(245,158,11,0.15)"
              : isRejected
              ? "rgba(239,68,68,0.12)"
              : isDeactivated
              ? "rgba(100,116,139,0.15)"
              : "rgba(239,68,68,0.12)";
            const borderColor = isPending ? "#f59e0b" : isRejected ? "#ef4444" : isDeactivated ? "#64748b" : "#ef4444";
            return (
              <div
                style={{
                  padding: "12px 16px",
                  background: bgColor,
                  border: `1px solid ${borderColor}40`,
                  borderRadius: 10,
                  color: borderColor,
                  fontSize: isAccountIssue ? "0.83rem" : "0.875rem",
                  fontWeight: isAccountIssue ? 500 : 600,
                  lineHeight: 1.5,
                  marginBottom: 12,
                }}
              >
                {icon} {error.replace(/^(PENDING|REJECTED|DEACTIVATED):\s*/, "")}
                {isPending && (
                  <p style={{ margin: "6px 0 0", fontSize: "0.78rem", opacity: 0.8 }}>
                    Contact your administrator to get your account approved.
                  </p>
                )}
              </div>
            );
          })()}

          {/* Quick Demo Selector */}
          <div className="demo-role-selector">
            <span className="demo-role-title">💡 One-Click Demo Logins:</span>
            <div className="demo-role-buttons">
              <button
                type="button"
                className="btn-demo-chip"
                onClick={() => handleFillDemo("admin", "admin123")}
                title="Full Admin access (CRUD students, attendance, marks, reports)"
              >
                🛡️ Admin
              </button>
              <button
                type="button"
                className="btn-demo-chip"
                onClick={() => handleFillDemo("faculty", "faculty123")}
                title="Faculty access (manage attendance and marks for Computer Science)"
              >
                👨‍🏫 Faculty (CS)
              </button>
              <button
                type="button"
                className="btn-demo-chip"
                onClick={() => handleFillDemo("rahul", "student123")}
                title="Student access (view only own profile, attendance, and marks for Rahul Sharma)"
              >
                🎓 Student (Rahul)
              </button>
              <button
                type="button"
                className="btn-demo-chip"
                onClick={() => handleFillDemo("priya", "student123")}
                title="Student access (view only own profile, attendance, and marks for Priya Patel)"
              >
                🎓 Student (Priya)
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label" htmlFor="login-username">
              Username or Student Email
            </label>
            <input
              id="login-username"
              type="text"
              className="form-input"
              placeholder="e.g. admin, faculty, or rahul@example.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="login-role-notes">
            <div className="role-note-item">
              <strong>Admin:</strong> Full CRUD on students, marks &amp; attendance.
            </div>
            <div className="role-note-item">
              <strong>Faculty:</strong> Manage attendance and marks for students.
            </div>
            <div className="role-note-item">
              <strong>Student:</strong> View personal profile, attendance &amp; results.
            </div>
          </div>

          <div className="login-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? "Authenticating…" : "🚀 Sign In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;
