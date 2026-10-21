import React, { useState, useEffect } from "react";
import { fetchAdminDashboard, formatApiError } from "./api";
import RegisterStudentModal from "./RegisterStudentModal";

const AdminDashboard = ({ onNavigateTab, onOpenAddStudent }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAdminDashboard();
      setData(res.data);
    } catch (err) {
      setError(formatApiError(err, "Failed to load admin dashboard."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>Loading institution analytics & system overview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <p>⚠️ {error}</p>
        <button className="btn btn-secondary" onClick={loadData}>
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  const totalGrades = Object.values(data.grade_distribution || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="admin-dashboard-container">
      {/* ── Welcome Banner ── */}
      <div className="dash-hero-banner admin-hero-gradient">
        <div className="dash-hero-content">
          <div className="dash-hero-badge">🛡️ Institutional Administration</div>
          <h2>Admin Control Center & Analytics</h2>
          <p>
            Real-time monitoring across all academic departments, faculty operations, student performance, and compliance audit logs.
          </p>
        </div>
        <div className="dash-quick-cta-group">
          {/* Primary: Register New Student */}
          <button
            className="btn btn-primary"
            onClick={() => setShowRegister(true)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            🎓 Register New Student
          </button>
          {onOpenAddStudent && (
            <button className="btn btn-secondary" onClick={onOpenAddStudent}>
              + Quick Add
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => onNavigateTab("attendance")}>
            📋 Attendance
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigateTab("marks")}>
            📈 Marks & Grades
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigateTab("accounts")}>
            🔐 Manage Accounts
          </button>
        </div>
      </div>

      {/* Register Student Modal */}
      {showRegister && (
        <RegisterStudentModal
          onClose={() => setShowRegister(false)}
          onSuccess={() => {
            setShowRegister(false);
            loadData();
          }}
        />
      )}

      {/* ── Stat Cards ── */}
      <div className="stat-cards">
        <div className="stat-card stat-primary">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <span className="stat-label">Total Students</span>
            <span className="stat-value">{data.total_students}</span>
            <span className="stat-meta">Active enrollment</span>
          </div>
        </div>

        <div className="stat-card stat-info">
          <div className="stat-icon">👨‍🏫</div>
          <div className="stat-content">
            <span className="stat-label">Total Faculty</span>
            <span className="stat-value">{data.total_faculty}</span>
            <span className="stat-meta">Authorized professors</span>
          </div>
        </div>

        <div className="stat-card stat-success">
          <div className="stat-icon">🏛️</div>
          <div className="stat-content">
            <span className="stat-label">Academic Departments</span>
            <span className="stat-value">{data.total_departments}</span>
            <span className="stat-meta">Degree disciplines</span>
          </div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <span className="stat-label">Overall Attendance</span>
            <span className="stat-value">{data.overall_attendance_pct}%</span>
            <span className="stat-meta">Campus-wide rate</span>
          </div>
        </div>

        <div className="stat-card stat-purple">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <span className="stat-label">Upcoming Exams</span>
            <span className="stat-value">{data.upcoming_exams_count}</span>
            <span className="stat-meta">Scheduled assessments</span>
          </div>
        </div>
      </div>

      {/* ── Middle Grid: Grade Distribution & Department Enrollment ── */}
      <div className="dashboard-grid-2col">
        {/* Grade Distribution */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>📊 Grade Distribution Transcript</h3>
            <span className="dash-header-sub">{totalGrades} graded subjects</span>
          </div>
          <div className="dash-card-body">
            {totalGrades === 0 ? (
              <p className="empty-subtext">No marks entries recorded yet.</p>
            ) : (
              <div className="grade-dist-bars">
                {Object.entries(data.grade_distribution || {}).map(([grade, count]) => {
                  const pct = totalGrades > 0 ? Math.round((count / totalGrades) * 100) : 0;
                  return (
                    <div key={grade} className="grade-bar-row">
                      <span className={`grade-chip grade-chip-${grade.toLowerCase().replace('+', 'plus')}`}>
                        {grade}
                      </span>
                      <div className="grade-bar-track">
                        <div
                          className={`grade-bar-fill fill-${grade.toLowerCase().replace('+', 'plus')}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="grade-bar-label">
                        {count} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Department Enrollment */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>🏛️ Department Enrollment</h3>
            <span className="dash-header-sub">{data.department_stats?.length || 0} active branches</span>
          </div>
          <div className="dash-card-body">
            <div className="dept-breakdown-list">
              {data.department_stats && data.department_stats.length > 0 ? (
                data.department_stats.map((dept) => (
                  <div key={dept.department} className="dept-stat-row">
                    <div className="dept-name-col">
                      <span className="dept-dot" />
                      <strong>{dept.department}</strong>
                    </div>
                    <span className="dept-count-badge">{dept.students} Students</span>
                  </div>
                ))
              ) : (
                <p className="empty-subtext">No department records yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Grid: Recent Audit Logs & Recent Announcements ── */}
      <div className="dashboard-grid-2col">
        {/* Recent Audit Logs */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>🔒 Recent Security & Mutation Audit Logs</h3>
            <button className="btn-link" onClick={() => onNavigateTab("audit")}>
              View All Logs →
            </button>
          </div>
          <div className="dash-card-body">
            {data.recent_audit_logs && data.recent_audit_logs.length > 0 ? (
              <div className="mini-audit-feed">
                {data.recent_audit_logs.slice(0, 6).map((log) => (
                  <div key={log.id} className="mini-audit-item">
                    <div className="audit-item-top">
                      <span className={`audit-badge badge-${log.action.toLowerCase()}`}>
                        {log.action}
                      </span>
                      <span className="audit-entity-tag">{log.entity_type}</span>
                      <span className="audit-time">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="audit-details-text">{log.details}</p>
                    <span className="audit-actor-sub">
                      By <strong>{log.performed_by_name}</strong> ({log.performed_by_role})
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-subtext">No audit entries recorded yet.</p>
            )}
          </div>
        </div>

        {/* Recent Announcements */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>📢 Campus Notices & Announcements</h3>
            <button className="btn-link" onClick={() => onNavigateTab("announcements")}>
              Manage Notices →
            </button>
          </div>
          <div className="dash-card-body">
            {data.recent_announcements && data.recent_announcements.length > 0 ? (
              <div className="mini-ann-list">
                {data.recent_announcements.slice(0, 4).map((ann) => (
                  <div key={ann.id} className={`mini-ann-card ${ann.is_pinned ? "pinned-card" : ""}`}>
                    <div className="ann-card-header">
                      <span className={`ann-category-tag cat-${ann.category.toLowerCase()}`}>
                        {ann.category}
                      </span>
                      {ann.is_pinned && <span className="pin-badge">📌 Pinned</span>}
                      <span className="ann-audience-tag">To: {ann.target_role}</span>
                    </div>
                    <h4>{ann.title}</h4>
                    <p>{ann.content}</p>
                    <div className="ann-footer-meta">
                      <span>By {ann.author_name}</span>
                      <span>{new Date(ann.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-subtext">No active announcements.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
