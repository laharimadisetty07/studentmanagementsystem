import React, { useState, useEffect } from "react";
import { fetchStudentDashboard, downloadReportCardPdf, formatApiError } from "./api";

const StudentDashboard = ({ onNavigateTab }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchStudentDashboard();
      setData(res.data);
    } catch (err) {
      setError(formatApiError(err, "Failed to load student dashboard."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDownloadReportCard = async () => {
    if (!data?.student) return;
    try {
      setDownloadingPdf(true);
      setDownloadMsg("Generating official report card PDF...");
      await downloadReportCardPdf(data.student.id, data.student.name);
      setDownloadMsg("Report card downloaded successfully! ✅");
      setTimeout(() => setDownloadMsg(""), 3500);
    } catch (err) {
      setDownloadMsg("❌ Failed to download report card: " + formatApiError(err));
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner" />
        <p>Loading your academic profile & schedule...</p>
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

  if (!data || !data.student) return null;

  const { student, overall_attendance_pct, attendance_status, total_subjects_graded, overall_marks_pct, overall_grade } = data;

  return (
    <div className="student-dashboard-container">
      {/* ── Student Hero Profile Banner ── */}
      <div className="dash-hero-banner student-hero-gradient">
        <div className="student-hero-avatar">
          {student.name.charAt(0).toUpperCase()}
        </div>
        <div className="dash-hero-content">
          <div className="dash-hero-badge">🎓 Student Academic Portal</div>
          <h2>{student.name}</h2>
          <div className="student-hero-chips">
            <span className="hero-chip">Roll ID: #{student.id}</span>
            <span className="hero-chip">{student.department}</span>
            <span className="hero-chip">Year {student.year}</span>
            <span className="hero-chip">{student.email}</span>
          </div>
        </div>
        <div className="dash-quick-cta-group">
          <button
            className="btn btn-primary btn-report-card"
            onClick={handleDownloadReportCard}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? "Generating PDF..." : "📄 Download Report Card"}
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigateTab("profile")}>
            👤 Full Profile
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigateTab("attendance")}>
            📋 Attendance
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigateTab("marks")}>
            📈 Marks & Grades
          </button>
        </div>
      </div>

      {downloadMsg && (
        <div className={`download-feedback-banner ${downloadMsg.includes("❌") ? "feedback-error" : "feedback-success"}`}>
          {downloadMsg}
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="stat-cards">
        <div className="stat-card stat-primary">
          <div className="stat-icon">🏆</div>
          <div className="stat-content">
            <span className="stat-label">Academic Grade</span>
            <span className="stat-value">{overall_grade || "N/A"}</span>
            <span className="stat-meta">Overall standing</span>
          </div>
        </div>

        <div className="stat-card stat-info">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <span className="stat-label">Marks Percentage</span>
            <span className="stat-value">{overall_marks_pct}%</span>
            <span className="stat-meta">{total_subjects_graded} subjects graded</span>
          </div>
        </div>

        <div className={`stat-card ${overall_attendance_pct >= 75 ? "stat-success" : "stat-danger"}`}>
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <span className="stat-label">Attendance Rate</span>
            <span className="stat-value">{overall_attendance_pct}%</span>
            <span className="stat-meta">{attendance_status}</span>
          </div>
        </div>

        <div className="stat-card stat-purple">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <span className="stat-label">Scheduled Exams</span>
            <span className="stat-value">{data.upcoming_exams?.length || 0}</span>
            <span className="stat-meta">Semester exams</span>
          </div>
        </div>
      </div>

      {/* ── Middle Grid: Today's Classes & Upcoming Exams ── */}
      <div className="dashboard-grid-2col">
        {/* Today's Lectures */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>🗓️ Today's Classes ({new Date().toLocaleDateString('en-US', { weekday: 'long' })})</h3>
            <button className="btn-link" onClick={() => onNavigateTab("timetable")}>
              Weekly Timetable →
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
                        Room: <strong className="room-highlight">{cls.room}</strong> • Faculty: {cls.faculty_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-schedule-box">
                <span className="empty-icon">☕</span>
                <p>No lectures scheduled for today on your timetable.</p>
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Examinations */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h3>📝 Upcoming Exam Schedule</h3>
            <button className="btn-link" onClick={() => onNavigateTab("exams")}>
              Full Schedule →
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
                        <span>{ex.semester}</span>
                        <span>•</span>
                        <span>{ex.start_time} - {ex.end_time}</span>
                        <span>•</span>
                        <span className="ex-room-chip">Hall: {ex.room}</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-schedule-box">
                <span className="empty-icon">🎉</span>
                <p>No exams currently scheduled for your class.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Campus & Department Notices ── */}
      <div className="dash-card">
        <div className="dash-card-header">
          <h3>📢 Notices & Announcements</h3>
          <button className="btn-link" onClick={() => onNavigateTab("announcements")}>
            View All Notices →
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
            <p className="empty-subtext">No active notices.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
