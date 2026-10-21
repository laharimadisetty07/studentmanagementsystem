import React, { useEffect, useState, useCallback } from "react";
import { getStats } from "./api";

/**
 * Dashboard component — shows live statistics from the database:
 *  - Total students, departments, active years, latest addition
 *  - Year-wise statistics (distribution bar chart)
 *  - Department-wise statistics (department counts)
 *  - Recently added students
 */

const YEAR_LABELS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th"];

const YEAR_COLORS = [
  "",
  "#6366f1",
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
];

const DEPT_COLORS = {
  "computer science": "#6366f1",
  "information technology": "#8b5cf6",
  engineering: "#3b82f6",
  mathematics: "#10b981",
  physics: "#f59e0b",
  chemistry: "#ef4444",
  biology: "#14b8a6",
  commerce: "#f97316",
  arts: "#ec4899",
};

const getDeptColor = (dept = "") => {
  const key = dept.toLowerCase();
  for (const [k, v] of Object.entries(DEPT_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "#6366f1";
};

const Dashboard = ({ refreshTrigger }) => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getStats();
      setStats(res.data);
    } catch {
      // fail silently — dashboard is supplementary
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats, refreshTrigger]);

  if (isLoading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="skeleton-cell" style={{ height: 85, borderRadius: 12 }} />
          <div className="skeleton-cell" style={{ height: 85, borderRadius: 12 }} />
          <div className="skeleton-cell" style={{ height: 85, borderRadius: 12 }} />
          <div className="skeleton-cell" style={{ height: 85, borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const yearBreakdown = stats.year_breakdown || [];
  const deptBreakdown = stats.department_breakdown || [];
  const maxYearCount = Math.max(...(yearBreakdown.map((y) => y.count).concat([1])));
  const maxDeptCount = Math.max(...(deptBreakdown.map((d) => d.count).concat([1])));

  return (
    <div className="dashboard">
      {/* ── Top stat cards ── */}
      <div className="stat-cards">
        <div className="stat-card stat-card-primary">
          <div className="stat-icon">🎓</div>
          <div className="stat-info">
            <span className="stat-value">{stats.total_students}</span>
            <span className="stat-label">Total Students</span>
          </div>
        </div>

        <div className="stat-card stat-card-purple">
          <div className="stat-icon">🏛️</div>
          <div className="stat-info">
            <span className="stat-value">{stats.total_departments}</span>
            <span className="stat-label">Departments</span>
          </div>
        </div>

        <div className="stat-card stat-card-teal">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <span className="stat-value">{yearBreakdown.length}</span>
            <span className="stat-label">Active Years</span>
          </div>
        </div>

        {stats.recent_students && stats.recent_students.length > 0 && (
          <div className="stat-card stat-card-amber">
            <div className="stat-icon">🆕</div>
            <div className="stat-info">
              <span className="stat-value" style={{ fontSize: "1.1rem", wordBreak: "break-word" }}>
                {stats.recent_students[0].name.split(" ")[0]}
              </span>
              <span className="stat-label">Latest Enrolled</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Middle/Bottom: Visual Analytics ── */}
      {(yearBreakdown.length > 0 || deptBreakdown.length > 0 || stats.recent_students?.length > 0) && (
        <div className="dashboard-bottom">
          {/* Year-wise Breakdown */}
          {yearBreakdown.length > 0 && (
            <div className="dashboard-panel">
              <h3 className="panel-title">📈 Year-wise Statistics</h3>
              <div className="year-bars">
                {yearBreakdown.map(({ year, count }) => (
                  <div key={year} className="year-bar-row">
                    <span className="year-bar-label">
                      {YEAR_LABELS[year] || `Y${year}`} Year
                    </span>
                    <div className="year-bar-track">
                      <div
                        className="year-bar-fill"
                        style={{
                          width: `${(count / maxYearCount) * 100}%`,
                          background: YEAR_COLORS[year] || "#6366f1",
                        }}
                      />
                    </div>
                    <span className="year-bar-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Department Breakdown */}
          {deptBreakdown.length > 0 && (
            <div className="dashboard-panel">
              <h3 className="panel-title">🏛️ Department Breakdown</h3>
              <div className="year-bars">
                {deptBreakdown.map(({ department, count }) => (
                  <div key={department} className="year-bar-row">
                    <span className="year-bar-label dept-bar-label" title={department}>
                      {department}
                    </span>
                    <div className="year-bar-track">
                      <div
                        className="year-bar-fill"
                        style={{
                          width: `${(count / maxDeptCount) * 100}%`,
                          background: getDeptColor(department),
                        }}
                      />
                    </div>
                    <span className="year-bar-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recently Added */}
          {stats.recent_students && stats.recent_students.length > 0 && (
            <div className="dashboard-panel">
              <h3 className="panel-title">🕐 Recently Added</h3>
              <ul className="recent-list">
                {stats.recent_students.map((s) => (
                  <li key={s.id} className="recent-item">
                    <div
                      className="recent-avatar"
                      style={{ background: getDeptColor(s.department) }}
                    >
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="recent-info">
                      <span className="recent-name">{s.name}</span>
                      <span className="recent-meta">
                        {s.department} · {YEAR_LABELS[s.year] || s.year} Year
                      </span>
                    </div>
                    <span className="id-badge" style={{ marginLeft: "auto", flexShrink: 0 }}>
                      #{s.id}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
