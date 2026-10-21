import React, { useState, useEffect } from "react";
import { fetchFacultyDashboard, formatApiError } from "./api";

const FacultyDashboard = ({ onNavigateTab, currentUser }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchFacultyDashboard();
      setData(res.data);
    } catch (err) {
      setError(formatApiError(err, "Failed to load faculty dashboard."));
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
        <p>Loading faculty portal & class schedule...</p>
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

  return (
    <div className="faculty-dashboard-container">
      {/* ── Welcome Banner ── */}
      <div className="dash-hero-banner faculty-hero-gradient">
        <div className="dash-hero-content">
          <div className="dash-hero-badge">👨‍🏫 Department Faculty Portal</div>
          <h2>Welcome, {currentUser?.username || "Faculty Member"}!</h2>
          <p>
            Authorized Department: <strong>{data.department}</strong>. Manage lecture attendance, evaluate semester grades, and coordinate examination schedules.
          </p>
        </div>
        <div className="dash-quick-cta-group">
          <button className="btn btn-primary" onClick={() => onNavigateTab("attendance")}>
            📋 Record Attendance
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigateTab("marks")}>
            📈 Enter Marks
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigateTab("timetable")}>
            🗓️ View Timetable
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigateTab("announcements")}>
            📢 Post Notice
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="stat-cards">
        <div className="stat-card stat-info">
          <div className="stat-icon">🎓</div>
          <div className="stat-content">
            <span className="stat-label">Department Students</span>
            <span className="stat-value">{data.total_dept_students}</span>
            <span className="stat-meta">{data.department}</span>
          </div>
        </div>

        <div className={`stat-card ${data.today_attendance_recorded ? "stat-success" : "stat-warning"}`}>
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <span className="stat-label">Today's Attendance</span>
            <span className="stat-value">
              {data.today_attendance_recorded ? "Recorded ✅" : "Pending ⏳"}
            </span>
            <span className="stat-meta">
              {data.today_attendance_recorded
                ? `${data.today_present_count} Present, ${data.today_absent_count} Absent`
                : "Needs submission"}
            </span>
          </div>
        </div>

        <div className="stat-card stat-primary">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <span className="stat-label">Department Score Avg</span>
            <span className="stat-value">{data.dept_avg_marks_pct}%</span>
            <span className="stat-meta">Academic evaluation</span>
          </div>
        </div>

        <div className="stat-card stat-purple">
          <div className="stat-icon">⏰</div>
          <div className="stat-content">
            <span className="stat-label">Today's Classes</span>
            <span className="stat-value">{data.today_classes?.length || 0}</span>
            <span className="stat-meta">Lectures & labs today</span>
          </div>
        </div>
      </div>

      {/* ── Middle Grid: Today's Classes & Upcoming Exams ── */}
      <div className="dashboard-grid-2col">
        {/* Today's Classes Schedule */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>🗓️ Today's Lecture Schedule ({new Date().toLocaleDateString('en-US', { weekday: 'long' })})</h3>
            <button className="btn-link" onClick={() => onNavigateTab("timetable")}>
              Full Weekly Schedule →
            </button>
          </div>
          <div className="dash-card-body">
            {data.today_classes && data.today_classes.length > 0 ? (
              <div className="timetable-cards-feed">
                {data.today_classes.map((cls) => (
                  <div key={cls.id} className="timetable-feed-card">
                    <div className="tf-time-badge">
                      <span>{cls.start_time}</span>
                      <small>to {cls.end_time}</small>
                    </div>
                    <div className="tf-info">
                      <h4>{cls.subject}</h4>
                      <p>
                        Year {cls.year} • {cls.room} • Faculty: {cls.faculty_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-schedule-box">
                <span className="empty-icon">☕</span>
                <p>No lectures scheduled for today on the timetable.</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Department Exams */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>📝 Upcoming Examinations ({data.department})</h3>
            <button className="btn-link" onClick={() => onNavigateTab("exams")}>
              All Schedules →
            </button>
          </div>
          <div className="dash-card-body">
            {data.upcoming_exams && data.upcoming_exams.length > 0 ? (
              <div className="exam-cards-feed">
                {data.upcoming_exams.map((ex) => (
                  <div key={ex.id} className="exam-feed-card">
                    <div className="ex-date-col">
                      <span className="ex-date-day">{new Date(ex.exam_date).getDate()}</span>
                      <span className="ex-date-mon">
                        {new Date(ex.exam_date).toLocaleDateString([], { month: "short" })}
                      </span>
                    </div>
                    <div className="ex-details-col">
                      <h4>{ex.subject}</h4>
                      <p className="ex-meta-row">
                        <span>Year {ex.year} ({ex.semester})</span>
                        <span>•</span>
                        <span>{ex.start_time} - {ex.end_time}</span>
                        <span>•</span>
                        <span className="ex-room-chip">{ex.room}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-schedule-box">
                <span className="empty-icon">🎉</span>
                <p>No exams currently scheduled in {data.department}.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom: Department Notices ── */}
      <div className="dash-card">
        <div className="dash-card-header">
          <h3>📢 Department Notices & Announcements</h3>
          <button className="btn-link" onClick={() => onNavigateTab("announcements")}>
            Post New Notice →
          </button>
        </div>
        <div className="dash-card-body">
          {data.recent_announcements && data.recent_announcements.length > 0 ? (
            <div className="announcements-grid-row">
              {data.recent_announcements.map((ann) => (
                <div key={ann.id} className={`mini-ann-card ${ann.is_pinned ? "pinned-card" : ""}`}>
                  <div className="ann-card-header">
                    <span className={`ann-category-tag cat-${ann.category.toLowerCase()}`}>
                      {ann.category}
                    </span>
                    {ann.is_pinned && <span className="pin-badge">📌 Pinned</span>}
                    <span className="ann-audience-tag">For: {ann.target_role}</span>
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
            <p className="empty-subtext">No notices posted for your department.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacultyDashboard;
