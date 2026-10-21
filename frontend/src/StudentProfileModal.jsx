import React, { useState, useEffect, useCallback } from "react";
import { getStudentProfile, downloadStudentReportPDF, downloadReportCardPdf, formatApiError } from "./api";

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

const getGradeColor = (grade = "") => {
  switch (grade) {
    case "A+":
    case "A":
      return "#10b981";
    case "B":
      return "#3b82f6";
    case "C":
      return "#f59e0b";
    case "D":
      return "#f97316";
    default:
      return "#ef4444";
  }
};

const StudentProfileModal = ({
  studentId,
  onClose,
  onEditStudent,
  onOpenAttendance,
  onOpenMarks,
  userRole = "admin",
}) => {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingReportCard, setIsDownloadingReportCard] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "attendance" | "marks"

  const fetchProfile = useCallback(async () => {
    if (!studentId) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await getStudentProfile(studentId);
      setProfile(res.data);
    } catch (err) {
      setError(formatApiError(err, "Failed to load student profile."));
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!studentId) return null;

  const handleDownloadPdf = async () => {
    if (!profile) return;
    setIsDownloadingPdf(true);
    try {
      await downloadStudentReportPDF(profile.student.id, profile.student.name);
    } catch (err) {
      alert(`PDF download failed: ${formatApiError(err)}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadReportCard = async () => {
    if (!profile) return;
    setIsDownloadingReportCard(true);
    try {
      await downloadReportCardPdf(profile.student.id, profile.student.name);
    } catch (err) {
      alert(`Report card download failed: ${formatApiError(err)}`);
    } finally {
      setIsDownloadingReportCard(false);
    }
  };

  const student = profile?.student;
  const attendance = profile?.attendance_summary;
  const academic = profile?.academic_summary;
  const deptColor = getDeptColor(student?.department);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card profile-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="profile-modal-header">
          <div className="profile-header-main">
            <div className="profile-avatar" style={{ background: deptColor }}>
              {student ? student.name.charAt(0).toUpperCase() : "🎓"}
            </div>
            <div className="profile-title-group">
              <div className="profile-name-row">
                <h2 className="profile-name">{student ? student.name : "Loading Student…"}</h2>
                {student && <span className="id-badge">#{student.id}</span>}
              </div>
              {student && (
                <div className="profile-meta-badges">
                  <span className="dept-badge" style={{ "--dept-color": deptColor }}>
                    {student.department}
                  </span>
                  <span className="year-chip">Year {student.year}</span>
                </div>
              )}
            </div>
          </div>

          <div className="profile-header-actions">
            <button
              className="btn btn-secondary btn-pdf"
              onClick={handleDownloadReportCard}
              disabled={isDownloadingReportCard || !profile}
              title="Download formal academic report card PDF"
            >
              {isDownloadingReportCard ? "⏳ Generating Card…" : "📜 Report Card"}
            </button>
            <button
              className="btn btn-secondary btn-pdf"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf || !profile}
              title="Download official PDF report summary"
            >
              {isDownloadingPdf ? "⏳ Generating PDF…" : "📄 PDF Summary"}
            </button>
            <button
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="profile-nav-tabs">
          <button
            className={`profile-tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            👤 Overview
          </button>
          <button
            className={`profile-tab ${activeTab === "attendance" ? "active" : ""}`}
            onClick={() => setActiveTab("attendance")}
          >
            📋 Attendance ({attendance ? `${attendance.percentage}%` : "—"})
          </button>
          <button
            className={`profile-tab ${activeTab === "marks" ? "active" : ""}`}
            onClick={() => setActiveTab("marks")}
          >
            📊 Marks &amp; Results ({academic ? academic.overall_grade : "—"})
          </button>
        </div>

        {/* Content Body */}
        <div className="profile-body">
          {isLoading ? (
            <div className="profile-loading">
              <div className="skeleton-cell" style={{ height: 60, borderRadius: 10 }} />
              <div className="skeleton-cell" style={{ height: 120, borderRadius: 10 }} />
              <div className="skeleton-cell" style={{ height: 120, borderRadius: 10 }} />
            </div>
          ) : error ? (
            <div className="profile-error-banner">⚠️ {error}</div>
          ) : profile ? (
            <>
              {/* Tab 1: Overview */}
              {activeTab === "overview" && (
                <div className="profile-overview-tab">
                  {/* Demographics Card */}
                  <div className="profile-section-card">
                    <h3 className="profile-section-title">📌 Contact &amp; Academic Info</h3>
                    <div className="profile-info-grid">
                      <div className="profile-info-item">
                        <span className="info-icon">📧</span>
                        <div>
                          <span className="info-label">Email Address</span>
                          <a href={`mailto:${student.email}`} className="info-value email-link">
                            {student.email}
                          </a>
                        </div>
                      </div>

                      <div className="profile-info-item">
                        <span className="info-icon">📞</span>
                        <div>
                          <span className="info-label">Phone Number</span>
                          <a href={`tel:${student.phone}`} className="info-value phone-link">
                            {student.phone}
                          </a>
                        </div>
                      </div>

                      <div className="profile-info-item">
                        <span className="info-icon">🏛️</span>
                        <div>
                          <span className="info-label">Department</span>
                          <span className="info-value">{student.department}</span>
                        </div>
                      </div>

                      <div className="profile-info-item">
                        <span className="info-icon">📅</span>
                        <div>
                          <span className="info-label">Current Year</span>
                          <span className="info-value">Year {student.year}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Highlights Grid */}
                  <div className="profile-highlights-grid">
                    {/* Attendance highlight */}
                    <div className="highlight-card">
                      <div className="highlight-header">
                        <span className="highlight-title">📋 Attendance Rate</span>
                        <span
                          className="status-pill"
                          style={{
                            background: attendance.percentage >= 75 ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                            color: attendance.percentage >= 75 ? "#10b981" : "#ef4444",
                          }}
                        >
                          {attendance.percentage >= 75 ? "Good" : "Warning"}
                        </span>
                      </div>
                      <div className="highlight-value-row">
                        <span className="highlight-big-number">{attendance.percentage}%</span>
                        <span className="highlight-subtext">
                          {attendance.present_days} / {attendance.total_days} sessions present
                        </span>
                      </div>
                      <div className="year-bar-track" style={{ height: 8, marginTop: 8 }}>
                        <div
                          className="year-bar-fill"
                          style={{
                            width: `${Math.min(100, attendance.percentage)}%`,
                            background: attendance.percentage >= 75 ? "#10b981" : "#ef4444",
                          }}
                        />
                      </div>
                    </div>

                    {/* Academic highlight */}
                    <div className="highlight-card">
                      <div className="highlight-header">
                        <span className="highlight-title">📊 Academic Grade</span>
                        <span
                          className="grade-badge"
                          style={{ background: getGradeColor(academic.overall_grade) }}
                        >
                          {academic.overall_grade}
                        </span>
                      </div>
                      <div className="highlight-value-row">
                        <span className="highlight-big-number">{academic.overall_percentage}%</span>
                        <span className="highlight-subtext">
                          {academic.total_marks_obtained} / {academic.total_max_marks} total marks
                        </span>
                      </div>
                      <div className="year-bar-track" style={{ height: 8, marginTop: 8 }}>
                        <div
                          className="year-bar-fill"
                          style={{
                            width: `${Math.min(100, academic.overall_percentage)}%`,
                            background: getGradeColor(academic.overall_grade),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Attendance */}
              {activeTab === "attendance" && (
                <div className="profile-attendance-tab">
                  <div className="attendance-metric-cards">
                    <div className="att-metric-box">
                      <span className="att-metric-num">{attendance.total_days}</span>
                      <span className="att-metric-label">Total Days</span>
                    </div>
                    <div className="att-metric-box att-present">
                      <span className="att-metric-num">{attendance.present_days}</span>
                      <span className="att-metric-label">Present</span>
                    </div>
                    <div className="att-metric-box att-absent">
                      <span className="att-metric-num">{attendance.absent_days}</span>
                      <span className="att-metric-label">Absent</span>
                    </div>
                    <div className="att-metric-box att-late">
                      <span className="att-metric-num">{attendance.late_days}</span>
                      <span className="att-metric-label">Late</span>
                    </div>
                    <div className="att-metric-box att-pct">
                      <span className="att-metric-num">{attendance.percentage}%</span>
                      <span className="att-metric-label">Attendance</span>
                    </div>
                  </div>

                  <div className="profile-section-card" style={{ marginTop: 14 }}>
                    <div className="section-header-flex">
                      <h4 className="profile-section-title">📅 Recent Attendance History</h4>
                      {userRole !== "student" && onOpenAttendance && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { onClose(); onOpenAttendance(student.id); }}
                        >
                          ➕ Record Today
                        </button>
                      )}
                    </div>

                    {profile.recent_attendance?.length > 0 ? (
                      <div className="mini-table-wrapper">
                        <table className="mini-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Status</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {profile.recent_attendance.map((rec) => (
                              <tr key={rec.id}>
                                <td>{rec.date}</td>
                                <td>
                                  <span className={`status-tag status-${rec.status.toLowerCase()}`}>
                                    {rec.status === "Present" ? "✅ Present" : rec.status === "Absent" ? "❌ Absent" : "⏰ Late"}
                                  </span>
                                </td>
                                <td>{rec.remarks || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="empty-subtext">No attendance records found yet for this student.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Marks */}
              {activeTab === "marks" && (
                <div className="profile-marks-tab">
                  <div className="marks-summary-banner">
                    <div>
                      <span className="marks-banner-label">Overall Performance:</span>
                      <span className="marks-banner-grade" style={{ color: getGradeColor(academic.overall_grade) }}>
                        Grade {academic.overall_grade} ({academic.overall_percentage}%)
                      </span>
                    </div>
                    <span className="marks-banner-subjects">
                      {academic.total_subjects} Subject{academic.total_subjects !== 1 ? "s" : ""} Evaluated
                    </span>
                  </div>

                  <div className="profile-section-card" style={{ marginTop: 14 }}>
                    <div className="section-header-flex">
                      <h4 className="profile-section-title">📚 Subject-wise Transcript</h4>
                      {userRole !== "student" && onOpenMarks && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => { onClose(); onOpenMarks(student.id); }}
                        >
                          ➕ Add Subject Mark
                        </button>
                      )}
                    </div>

                    {academic.marks?.length > 0 ? (
                      <div className="mini-table-wrapper">
                        <table className="mini-table">
                          <thead>
                            <tr>
                              <th>Subject</th>
                              <th>Exam Type</th>
                              <th>Score</th>
                              <th>Percentage</th>
                              <th>Grade</th>
                              <th>Semester</th>
                            </tr>
                          </thead>
                          <tbody>
                            {academic.marks.map((m) => (
                              <tr key={m.id}>
                                <td><strong>{m.subject}</strong></td>
                                <td>{m.exam_type}</td>
                                <td>{m.marks_obtained} / {m.max_marks}</td>
                                <td>{m.percentage}%</td>
                                <td>
                                  <span
                                    className="grade-badge"
                                    style={{ background: getGradeColor(m.grade) }}
                                  >
                                    {m.grade}
                                  </span>
                                </td>
                                <td>{m.semester || "Semester 1"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="empty-subtext">No marks or exam results entered yet for this student.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="profile-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            ✕ Close
          </button>
          {userRole === "admin" && onEditStudent && student && (
            <button
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onEditStudent(student);
              }}
            >
              ✏️ Edit Student
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentProfileModal;
