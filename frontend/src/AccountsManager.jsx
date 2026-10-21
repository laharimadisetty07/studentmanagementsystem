import React, { useState, useEffect, useCallback } from "react";
import {
  listStudentAccounts,
  updateAccountStatus,
  resetStudentPassword,
  formatApiError,
} from "./api";
import RegisterStudentModal from "./RegisterStudentModal";

const STATUS_META = {
  pending:     { label: "Pending Approval", color: "#f59e0b", bg: "rgba(245,158,11,0.15)", icon: "⏳" },
  approved:    { label: "Active / Approved", color: "#10b981", bg: "rgba(16,185,129,0.15)", icon: "✅" },
  rejected:    { label: "Rejected",          color: "#ef4444", bg: "rgba(239,68,68,0.15)",  icon: "❌" },
  deactivated: { label: "Deactivated",       color: "#64748b", bg: "rgba(100,116,139,0.15)",icon: "🚫" },
};

const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: "0.72rem",
        fontWeight: 700,
        background: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.color}40`,
      }}
    >
      {meta.icon} {meta.label}
    </span>
  );
};

const AccountsManager = () => {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [filterStatus, setFilterStatus] = useState(""); // "" = all
  const [resetModal, setResetModal] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  const notify = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = filterStatus ? { status: filterStatus } : {};
      const res = await listStudentAccounts(params);
      setAccounts(res.data);
    } catch (err) {
      notify("error", formatApiError(err, "Failed to load student accounts."));
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, notify]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleStatusChange = async (userId, username, newStatus) => {
    const labels = {
      approved: "approve",
      rejected: "reject",
      deactivated: "deactivate",
      pending: "set to pending",
    };
    if (
      !window.confirm(
        `Are you sure you want to ${labels[newStatus] || newStatus} the account for "${username}"?`
      )
    )
      return;

    try {
      await updateAccountStatus(userId, newStatus);
      const actionLabel = {
        approved: "✅ Approved",
        rejected: "❌ Rejected",
        deactivated: "🚫 Deactivated",
        pending: "⏳ Set to Pending",
      }[newStatus] || newStatus;
      notify("success", `${actionLabel}: Account "${username}" updated.`);
      loadAccounts();
    } catch (err) {
      notify("error", `❌ ${formatApiError(err, "Failed to update account status.")}`);
    }
  };

  const handleBulkApprove = async (pendingAccounts) => {
    if (!window.confirm(`Approve all ${pendingAccounts.length} pending accounts?`)) return;
    let success = 0;
    for (const acct of pendingAccounts) {
      try {
        await updateAccountStatus(acct.user_id, "approved");
        success++;
      } catch {}
    }
    notify("success", `✅ Approved ${success} of ${pendingAccounts.length} pending accounts.`);
    loadAccounts();
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      notify("error", "Password must be at least 6 characters.");
      return;
    }
    setIsResetting(true);
    try {
      await resetStudentPassword(resetModal.userId, newPassword);
      notify("success", `🔑 Password for "${resetModal.username}" has been reset.`);
      setResetModal(null);
      setNewPassword("");
    } catch (err) {
      notify("error", `❌ ${formatApiError(err, "Failed to reset password.")}`);
    } finally {
      setIsResetting(false);
    }
  };

  const pendingAccounts = accounts.filter((a) => a.account_status === "pending");
  const filteredAccounts = filterStatus
    ? accounts
    : accounts; // already filtered by API

  return (
    <div className="student-list-container">
      {/* Toast */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Register New Student Modal */}
      {showRegister && (
        <RegisterStudentModal
          onClose={() => setShowRegister(false)}
          onSuccess={(student) => {
            setShowRegister(false);
            notify("success", `🎉 "${student.name}" registered! Check Pending Approvals if status is pending.`);
            loadAccounts();
          }}
        />
      )}

      {/* ── Page Header ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#f1f5f9", marginBottom: 4 }}>
            🔐 Student Account Management
          </h2>
          <p style={{ color: "#64748b", fontSize: "0.83rem", margin: 0 }}>
            Register new students, manage approval status, and reset passwords.
          </p>
        </div>
        <button
          id="register-student-btn"
          className="btn btn-primary"
          onClick={() => setShowRegister(true)}
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <span style={{ fontSize: "1.1rem" }}>🎓</span>
          Register New Student
        </button>
      </div>

      {/* ── Pending Approvals Section ── */}
      {pendingAccounts.length > 0 && !filterStatus && (
        <div
          style={{
            marginBottom: 28,
            padding: "18px 20px",
            background: "rgba(245,158,11,0.07)",
            border: "1px solid rgba(245,158,11,0.25)",
            borderRadius: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <div>
              <h3 style={{ color: "#fbbf24", fontWeight: 800, fontSize: "1rem", margin: 0 }}>
                ⏳ Pending Approvals ({pendingAccounts.length})
              </h3>
              <p style={{ color: "#78716c", fontSize: "0.78rem", margin: "2px 0 0" }}>
                These students cannot log in until you approve them.
              </p>
            </div>
            {pendingAccounts.length > 1 && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: "0.8rem", padding: "6px 14px" }}
                onClick={() => handleBulkApprove(pendingAccounts)}
              >
                ✅ Approve All ({pendingAccounts.length})
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {pendingAccounts.map((acct) => (
              <div
                key={acct.user_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.15)",
                  borderRadius: 10,
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <p style={{ fontWeight: 700, color: "#f1f5f9", margin: 0, fontSize: "0.9rem" }}>
                    {acct.student_name || "Unknown"}
                    <span style={{ color: "#475569", fontWeight: 400, marginLeft: 8, fontSize: "0.8rem" }}>
                      @{acct.username}
                    </span>
                  </p>
                  <p style={{ color: "#64748b", fontSize: "0.78rem", margin: "2px 0 0" }}>
                    {acct.student_email} · {acct.student_department}, Year {acct.student_year}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    className="action-btn edit-btn"
                    onClick={() => handleStatusChange(acct.user_id, acct.username, "approved")}
                    style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                  >
                    ✅ Approve
                  </button>
                  <button
                    className="action-btn delete-btn"
                    onClick={() => handleStatusChange(acct.user_id, acct.username, "rejected")}
                    style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Controls ── */}
      <div className="controls-row" style={{ marginBottom: 16 }}>
        <select
          className="filter-select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ minWidth: 200 }}
        >
          <option value="">All Student Accounts</option>
          <option value="pending">⏳ Pending Approval</option>
          <option value="approved">✅ Approved / Active</option>
          <option value="rejected">❌ Rejected</option>
          <option value="deactivated">🚫 Deactivated</option>
        </select>
        <button className="btn btn-secondary" onClick={loadAccounts} disabled={isLoading}>
          🔄 Refresh
        </button>
        <span className="results-count">
          {isLoading
            ? "Loading…"
            : `${filteredAccounts.length} account${filteredAccounts.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <p style={{ color: "#94a3b8" }}>Loading accounts…</p>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔐</div>
          <h3 className="empty-title">No Accounts Found</h3>
          <p className="empty-subtitle">
            {filterStatus
              ? `No "${filterStatus}" accounts. Try a different filter.`
              : "No student portal accounts yet. Click \"Register New Student\" to add one."}
          </p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowRegister(true)}>
            🎓 Register First Student
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="student-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Status</th>
                <th>Student Name</th>
                <th>Email</th>
                <th>Dept / Year</th>
                <th style={{ minWidth: 300 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((acct, idx) => (
                <tr key={acct.user_id} className="table-row" style={{ "--row-idx": idx }}>
                  <td>
                    <span className="id-badge">#{acct.user_id}</span>
                  </td>
                  <td>
                    <code style={{ color: "#a5b4fc", fontSize: "0.85rem" }}>{acct.username}</code>
                  </td>
                  <td>
                    <StatusBadge status={acct.account_status} />
                  </td>
                  <td>
                    <span className="student-name">
                      {acct.student_name || <em style={{ color: "#475569" }}>No student linked</em>}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: "#64748b", fontSize: "0.82rem" }}>
                      {acct.student_email || "—"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {acct.student_department && (
                        <span className="dept-badge" style={{ "--dept-color": "#6366f1", fontSize: "0.75rem" }}>
                          {acct.student_department}
                        </span>
                      )}
                      {acct.student_year && (
                        <span className="year-chip" style={{ fontSize: "0.75rem" }}>
                          Year {acct.student_year}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="td-actions">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {acct.account_status !== "approved" && (
                        <button
                          className="action-btn edit-btn"
                          onClick={() => handleStatusChange(acct.user_id, acct.username, "approved")}
                          title="Allow this student to log in"
                        >
                          ✅ Approve
                        </button>
                      )}
                      {acct.account_status !== "rejected" && (
                        <button
                          className="action-btn delete-btn"
                          onClick={() => handleStatusChange(acct.user_id, acct.username, "rejected")}
                          title="Decline this account"
                        >
                          ❌ Reject
                        </button>
                      )}
                      {acct.account_status === "approved" && (
                        <button
                          className="action-btn"
                          style={{
                            background: "rgba(100,116,139,0.15)",
                            color: "#94a3b8",
                            border: "1px solid rgba(100,116,139,0.3)",
                          }}
                          onClick={() => handleStatusChange(acct.user_id, acct.username, "deactivated")}
                          title="Suspend account"
                        >
                          🚫 Deactivate
                        </button>
                      )}
                      {acct.account_status === "deactivated" && (
                        <button
                          className="action-btn edit-btn"
                          onClick={() => handleStatusChange(acct.user_id, acct.username, "approved")}
                          title="Re-activate account"
                        >
                          🔓 Re-activate
                        </button>
                      )}
                      <button
                        className="action-btn"
                        style={{
                          background: "rgba(99,102,241,0.12)",
                          color: "#a5b4fc",
                          border: "1px solid rgba(99,102,241,0.25)",
                        }}
                        onClick={() => {
                          setResetModal({ userId: acct.user_id, username: acct.username });
                          setNewPassword("");
                        }}
                        title="Reset student password"
                      >
                        🔑 Reset Pwd
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="table-footer">
            {filteredAccounts.length} student account{filteredAccounts.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div className="modal-overlay" onClick={() => setResetModal(null)}>
          <div
            className="modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440 }}
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <span className="modal-icon">🔑</span>
                <h2 className="modal-title">Reset Password</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setResetModal(null)}>✕</button>
            </div>
            <div style={{ padding: "20px 24px 24px" }}>
              <p style={{ color: "#94a3b8", fontSize: "0.875rem", marginBottom: 16 }}>
                Set a new password for{" "}
                <code style={{ color: "#a5b4fc" }}>{resetModal.username}</code>.
                Share it securely with the student.
              </p>
              <div className="form-group">
                <label className="form-label">
                  New Password <span className="required">*</span>
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                />
              </div>
              <div className="form-actions" style={{ marginTop: 20 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setResetModal(null)}
                  disabled={isResetting}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleResetPassword}
                  disabled={isResetting || newPassword.length < 6}
                >
                  {isResetting ? "Resetting…" : "🔑 Set Password"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsManager;
