import React, { useState, useEffect } from "react";
import { fetchExamSchedules, createExamSchedule, deleteExamSchedule, formatApiError } from "./api";

const DEPARTMENTS = ["Computer Science", "Information Technology", "Electrical Engineering", "Mechanical Engineering", "Civil Engineering"];

const ExamScheduleManager = ({ userRole, currentUser }) => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDept, setSelectedDept] = useState(currentUser?.department || "Computer Science");
  const [selectedYear, setSelectedYear] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    department: currentUser?.department || "Computer Science",
    year: 1,
    semester: "Semester 1",
    subject: "",
    exam_date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
    start_time: "10:00 AM",
    end_time: "01:00 PM",
    room: "Examination Hall 1",
    max_marks: 100.0,
  });

  const isStudent = userRole === "student";
  const canManage = userRole === "admin" || userRole === "faculty";

  const loadExams = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (!isStudent) {
        if (selectedDept) params.department = selectedDept;
        if (selectedYear) params.year = selectedYear;
      }
      const res = await fetchExamSchedules(params);
      setExams(res.data);
    } catch (err) {
      setError(formatApiError(err, "Failed to load exam schedules."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, [selectedDept, selectedYear]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.exam_date) {
      alert("Please fill in subject and exam date.");
      return;
    }
    try {
      setSaving(true);
      await createExamSchedule(formData);
      setShowAddModal(false);
      setFormData({
        department: selectedDept || "Computer Science",
        year: selectedYear || 1,
        semester: "Semester 1",
        subject: "",
        exam_date: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        start_time: "10:00 AM",
        end_time: "01:00 PM",
        room: "Examination Hall 1",
        max_marks: 100.0,
      });
      loadExams();
    } catch (err) {
      alert("Error scheduling exam: " + formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, subject) => {
    if (!window.confirm(`Are you sure you want to remove the exam for '${subject}'?`)) return;
    try {
      await deleteExamSchedule(id);
      loadExams();
    } catch (err) {
      alert("Error deleting exam: " + formatApiError(err));
    }
  };

  const getDaysDiff = (dateStr) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diffTime = target - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="module-container">
      {/* ── Header ── */}
      <div className="module-header-card">
        <div className="module-header-title">
          <h2>📝 Examination Schedule & Datesheet</h2>
          <p>
            {isStudent
              ? "Official schedule of upcoming mid-term, practical, and semester examinations."
              : "Manage examination dates, evaluation slots, reporting times, and venue allocations."}
          </p>
        </div>

        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Schedule New Exam
          </button>
        )}
      </div>

      {/* ── Filter Controls ── */}
      {!isStudent && (
        <div className="module-controls-bar">
          <div className="filter-group">
            <label>Department:</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="filter-select"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <label>Year:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="filter-select"
            >
              {[1, 2, 3, 4].map((y) => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Exam List ── */}
      {loading ? (
        <div className="dashboard-loading">
          <div className="spinner" />
          <p>Loading examination timetable...</p>
        </div>
      ) : error ? (
        <div className="dashboard-error">
          <p>⚠️ {error}</p>
          <button className="btn btn-secondary" onClick={loadExams}>Retry</button>
        </div>
      ) : exams.length === 0 ? (
        <div className="empty-schedule-box">
          <span className="empty-icon">🎉</span>
          <h3>No Examinations Scheduled</h3>
          <p>There are currently no active exam dates on the calendar for this selection.</p>
        </div>
      ) : (
        <div className="exams-timeline-list">
          {exams.map((ex) => {
            const daysLeft = getDaysDiff(ex.exam_date);
            let statusChip = null;
            if (daysLeft === 0) {
              statusChip = <span className="exam-countdown-badge badge-today">Today ⚠️</span>;
            } else if (daysLeft === 1) {
              statusChip = <span className="exam-countdown-badge badge-tomorrow">Tomorrow ⏰</span>;
            } else if (daysLeft > 1) {
              statusChip = <span className="exam-countdown-badge badge-upcoming">In {daysLeft} Days 📅</span>;
            } else {
              statusChip = <span className="exam-countdown-badge badge-completed">Completed ✓</span>;
            }

            return (
              <div key={ex.id} className="exam-card-detailed">
                <div className="exam-calendar-col">
                  <span className="ex-card-day">{new Date(ex.exam_date).getDate()}</span>
                  <span className="ex-card-month">
                    {new Date(ex.exam_date).toLocaleDateString([], { month: "short", year: "numeric" })}
                  </span>
                  <span className="ex-card-weekday">
                    {new Date(ex.exam_date).toLocaleDateString([], { weekday: "short" })}
                  </span>
                </div>

                <div className="exam-main-col">
                  <div className="exam-top-row">
                    <span className="exam-sem-tag">{ex.semester}</span>
                    <span className="exam-dept-tag">{ex.department} (Year {ex.year})</span>
                    {statusChip}
                  </div>

                  <h3 className="exam-subject-title">{ex.subject}</h3>

                  <div className="exam-details-chips">
                    <span className="ex-chip">⏰ {ex.start_time} to {ex.end_time}</span>
                    <span className="ex-chip">🏛️ Venue: <strong>{ex.room}</strong></span>
                    <span className="ex-chip">🎯 Max Marks: {ex.max_marks}</span>
                  </div>
                </div>

                {canManage && (
                  <div className="exam-action-col">
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(ex.id, ex.subject)}
                      title="Remove exam"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Exam Modal ── */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>+ Schedule New Examination</h3>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Year</label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                  >
                    {[1, 2, 3, 4].map((y) => (
                      <option key={y} value={y}>Year {y}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Semester / Term</label>
                  <select
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  >
                    <option value="Semester 1">Semester 1</option>
                    <option value="Semester 2">Semester 2</option>
                    <option value="Mid-Term Exam">Mid-Term Exam</option>
                    <option value="Final Examination">Final Examination</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Subject / Course Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Distributed Database Systems"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Exam Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.exam_date}
                    onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Venue / Examination Hall</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Auditorium Hall 1"
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="text"
                    placeholder="10:00 AM"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="text"
                    placeholder="01:00 PM"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Maximum Marks</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={formData.max_marks}
                    onChange={(e) => setFormData({ ...formData, max_marks: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Scheduling..." : "Save Exam Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamScheduleManager;
