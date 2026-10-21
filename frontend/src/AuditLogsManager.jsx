import React, { useState, useEffect } from "react";
import { fetchAuditLogs, formatApiError } from "./api";

const AuditLogsManager = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const loadLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { limit: 100 };
      if (entityFilter !== "all") params.entity_type = entityFilter;
      if (actionFilter !== "all") params.action = actionFilter;

      const res = await fetchAuditLogs(params);
      setLogs(res.data);
    } catch (err) {
      setError(formatApiError(err, "Failed to load audit logs."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [entityFilter, actionFilter]);

  return (
    <div className="module-container">
      {/* ── Header ── */}
      <div className="module-header-card">
        <div className="module-header-title">
          <h2>🔒 Security & Compliance Audit Trail</h2>
          <p>
            Administrative audit logs tracking all student profile creations, attendance recordings, and marks modifications with timestamps and actor identities.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={loadLogs}>
          🔄 Refresh Log
        </button>
      </div>

      {/* ── Filter Controls ── */}
      <div className="module-controls-bar">
        <div className="filter-group">
          <label>Target Resource:</label>
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Resources</option>
            <option value="attendance">Attendance Records</option>
            <option value="marks">Marks & Evaluations</option>
            <option value="students">Student Profiles</option>
            <option value="timetables">Timetable Schedules</option>
            <option value="exams">Exam Schedules</option>
            <option value="announcements">Announcements</option>
          </select>

          <label>Action Type:</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        <span className="results-count">
          Showing <strong>{logs.length}</strong> log events
        </span>
      </div>

      {/* ── Audit Logs Table ── */}
      {loading ? (
        <div className="dashboard-loading">
          <div className="spinner" />
          <p>Loading audit trail...</p>
        </div>
      ) : error ? (
        <div className="dashboard-error">
          <p>⚠️ {error}</p>
          <button className="btn btn-secondary" onClick={loadLogs}>Retry</button>
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-schedule-box">
          <span className="empty-icon">🛡️</span>
          <h3>No Audit Log Events</h3>
          <p>No logged changes found for the current filter criteria.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="student-table audit-log-table">
            <thead>
              <tr>
                <th style={{ width: "160px" }}>Timestamp</th>
                <th style={{ width: "95px" }}>Action</th>
                <th style={{ width: "120px" }}>Entity</th>
                <th style={{ width: "170px" }}>Performed By</th>
                <th>Change Description</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="log-time-cell">
                    <span className="log-date">
                      {new Date(log.timestamp).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span className="log-clock">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </td>
                  <td>
                    <span className={`audit-badge badge-${log.action.toLowerCase()}`}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <span className="audit-entity-tag">
                      {log.entity_type}
                    </span>
                  </td>
                  <td>
                    <div className="log-actor-box">
                      <strong>{log.performed_by_name}</strong>
                      <span className="log-actor-role">({log.performed_by_role})</span>
                    </div>
                  </td>
                  <td className="log-details-cell">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditLogsManager;
