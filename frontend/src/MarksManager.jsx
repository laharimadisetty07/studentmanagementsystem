import React, { useState, useEffect, useCallback } from "react";
import {
  getStudents,
  getMarks,
  addMark,
  updateMark,
  deleteMark,
  formatApiError,
} from "./api";

const COMMON_SUBJECTS = [
  "Data Structures & Algorithms",
  "Operating Systems",
  "Database Management Systems",
  "Computer Networks",
  "Web Development",
  "Software Engineering",
  "Mathematics",
  "Artificial Intelligence",
  "Cloud Computing",
];

const EXAM_TYPES = ["Final Exam", "Midterm Exam", "Quiz", "Assignment", "Lab Practical"];

const SEMESTERS = [
  "Semester 1",
  "Semester 2",
  "Semester 3",
  "Semester 4",
  "Semester 5",
  "Semester 6",
  "Semester 7",
  "Semester 8",
];

const calculateLiveGrade = (obtained, max) => {
  const o = parseFloat(obtained);
  const m = parseFloat(max);
  if (isNaN(o) || isNaN(m) || m <= 0) return { pct: 0, grade: "—" };
  const pct = Math.round((o / m) * 1000) / 10;
  let grade = "F";
  if (pct >= 90) grade = "A+";
  else if (pct >= 80) grade = "A";
  else if (pct >= 70) grade = "B";
  else if (pct >= 60) grade = "C";
  else if (pct >= 50) grade = "D";
  return { pct, grade };
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

const MarksManager = ({
  initialStudentId = null,
  onDataChange,
  userRole = "admin",
  currentStudentId = null,
}) => {
  const [marksList, setMarksList] = useState([]);
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingMark, setEditingMark] = useState(null);
  const [toast, setToast] = useState(null);

  // Filter states
  // For students: always lock to their own ID; for admin/faculty: allow any ID
  const effectiveStudentId = userRole === "student" ? currentStudentId : null;
  const [filterStudentId, setFilterStudentId] = useState(
    initialStudentId || effectiveStudentId || ""
  );
  const [filterSubject, setFilterSubject] = useState("");
  const [filterExamType, setFilterExamType] = useState("");
  const [filterSemester, setFilterSemester] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    student_id: initialStudentId || "",
    subject: "",
    exam_type: "Final Exam",
    marks_obtained: "",
    max_marks: "100",
    semester: "Semester 1",
  });
  const [formErrors, setFormErrors] = useState({});

  const notify = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadStudents = useCallback(async () => {
    try {
      const res = await getStudents({ limit: 100, sortBy: "name", sortOrder: "asc" });
      setStudents(res.data);
    } catch {
      // non-critical
    }
  }, []);

  const loadMarks = useCallback(async () => {
    setIsLoading(true);
    try {
      // For students: ALWAYS use their own student ID, never leave it empty
      const resolvedStudentId =
        userRole === "student"
          ? currentStudentId
          : filterStudentId || undefined;

      const res = await getMarks({
        student_id: resolvedStudentId,
        subject: filterSubject || undefined,
        exam_type: filterExamType || undefined,
        semester: filterSemester || undefined,
        limit: 100,
      });
      setMarksList(res.data);
    } catch (err) {
      notify("error", formatApiError(err, "Failed to load marks."));
    } finally {
      setIsLoading(false);
    }
  }, [userRole, currentStudentId, filterStudentId, filterSubject, filterExamType, filterSemester, notify]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    loadMarks();
  }, [loadMarks]);

  const handleOpenAdd = () => {
    setEditingMark(null);
    setFormData({
      student_id: filterStudentId || (students[0]?.id || ""),
      subject: "",
      exam_type: "Final Exam",
      marks_obtained: "",
      max_marks: "100",
      semester: "Semester 1",
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleOpenEdit = (m) => {
    setEditingMark(m);
    setFormData({
      student_id: m.student_id,
      subject: m.subject,
      exam_type: m.exam_type,
      marks_obtained: String(m.marks_obtained),
      max_marks: String(m.max_marks),
      semester: m.semester || "Semester 1",
    });
    setFormErrors({});
    setShowModal(true);
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.student_id) errors.student_id = "Please select a student.";
    if (!formData.subject.trim()) errors.subject = "Subject name is required.";
    const obtained = parseFloat(formData.marks_obtained);
    const max = parseFloat(formData.max_marks);
    if (isNaN(obtained) || obtained < 0) {
      errors.marks_obtained = "Enter a valid positive number.";
    }
    if (isNaN(max) || max <= 0) {
      errors.max_marks = "Max marks must be greater than 0.";
    } else if (obtained > max) {
      errors.marks_obtained = `Marks obtained (${obtained}) cannot exceed maximum (${max}).`;
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        student_id: parseInt(formData.student_id, 10),
        subject: formData.subject.trim(),
        exam_type: formData.exam_type,
        marks_obtained: parseFloat(formData.marks_obtained),
        max_marks: parseFloat(formData.max_marks),
        semester: formData.semester,
      };

      if (editingMark) {
        await updateMark(editingMark.id, payload);
        notify("success", `✅ Updated marks for "${formData.subject}".`);
      } else {
        await addMark(payload);
        notify("success", `🎉 Added marks for "${formData.subject}".`);
      }
      setShowModal(false);
      loadMarks();
      if (onDataChange) onDataChange();
    } catch (err) {
      notify("error", `❌ ${formatApiError(err, "Failed to save marks.")}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, subject) => {
    if (!window.confirm(`Delete mark entry for "${subject}"?`)) return;
    try {
      await deleteMark(id);
      notify("success", "Mark entry deleted.");
      loadMarks();
      if (onDataChange) onDataChange();
    } catch (err) {
      notify("error", `❌ ${formatApiError(err)}`);
    }
  };

  const { pct: livePct, grade: liveGrade } = calculateLiveGrade(
    formData.marks_obtained,
    formData.max_marks
  );

  // Overall statistics for display
  const totalEntries = marksList.length;
  const avgPct =
    totalEntries > 0
      ? Math.round(
          (marksList.reduce((acc, m) => acc + (m.percentage || 0), 0) / totalEntries) * 10
        ) / 10
      : 0;

  return (
    <div className="manager-container">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Top Banner & Analytics */}
      <div className="marks-banner-grid">
        <div className="stat-card stat-card-primary">
          <div className="stat-icon">📚</div>
          <div className="stat-info">
            <span className="stat-value">{totalEntries}</span>
            <span className="stat-label">Subject Entries</span>
          </div>
        </div>

        <div className="stat-card stat-card-teal">
          <div className="stat-icon">🎯</div>
          <div className="stat-info">
            <span className="stat-value">{avgPct}%</span>
            <span className="stat-label">Class Average Score</span>
          </div>
        </div>

        <div className="stat-card stat-card-purple">
          <div className="stat-icon">🏆</div>
          <div className="stat-info">
            <span className="stat-value">
              {marksList.filter((m) => m.grade === "A+" || m.grade === "A").length}
            </span>
            <span className="stat-label">Distinction Grades (A / A+)</span>
          </div>
        </div>
      </div>

      {/* Controls Row */}
      <div className="controls-row" style={{ marginTop: 16 }}>
        <select
          className="filter-select"
          value={filterStudentId}
          onChange={(e) => setFilterStudentId(e.target.value)}
        >
          <option value="">All Students</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name} (#{s.id})</option>
          ))}
        </select>

        <input
          type="text"
          className="search-input"
          style={{ maxWidth: 220 }}
          placeholder="Filter by subject…"
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
        />

        <select
          className="filter-select"
          value={filterExamType}
          onChange={(e) => setFilterExamType(e.target.value)}
        >
          <option value="">All Exam Types</option>
          {EXAM_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={filterSemester}
          onChange={(e) => setFilterSemester(e.target.value)}
        >
          <option value="">All Semesters</option>
          {SEMESTERS.map((sem) => (
            <option key={sem} value={sem}>{sem}</option>
          ))}
        </select>

        {userRole !== "student" && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginLeft: "auto" }}
            onClick={handleOpenAdd}
          >
            ➕ Add Marks
          </button>
        )}
      </div>

      {/* Marks Table */}
      <div className="table-wrapper" style={{ marginTop: 16 }}>
        <table className="student-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Subject</th>
              <th>Exam Type</th>
              <th>Marks Score</th>
              <th>Percentage</th>
              <th>Grade</th>
              <th>Semester</th>
              {userRole !== "student" && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="skeleton-row">
                  <td colSpan={8}><div className="skeleton-cell" /></td>
                </tr>
              ))
            ) : marksList.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-table-cell">
                  No marks records found. Click "+ Add Marks" to enter subject grades.
                </td>
              </tr>
            ) : (
              marksList.map((m) => (
                <tr key={m.id} className="table-row">
                  <td>
                    <strong>{m.student_name || `#${m.student_id}`}</strong>
                  </td>
                  <td><strong>{m.subject}</strong></td>
                  <td><span className="exam-type-chip">{m.exam_type}</span></td>
                  <td>
                    <span className="score-text">
                      {m.marks_obtained} / {m.max_marks}
                    </span>
                  </td>
                  <td><strong>{m.percentage}%</strong></td>
                  <td>
                    <span
                      className="grade-badge"
                      style={{ background: getGradeColor(m.grade) }}
                    >
                      {m.grade}
                    </span>
                  </td>
                  <td>{m.semester || "Semester 1"}</td>
                  {userRole !== "student" && (
                    <td>
                      <button
                        className="action-btn edit-btn"
                        onClick={() => handleOpenEdit(m)}
                        title="Edit marks"
                      >
                        ✏️
                      </button>
                      <button
                        className="action-btn delete-btn"
                        onClick={() => handleDelete(m.id, m.subject)}
                        title="Delete marks"
                      >
                        🗑️
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Marks Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !isSaving && setShowModal(false)}>
          <div
            className="modal-card"
            style={{ maxWidth: 540 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <div className="modal-title-group">
                <span className="modal-icon">{editingMark ? "✏️" : "📊"}</span>
                <h2 className="modal-title">
                  {editingMark ? "Edit Subject Marks" : "Add Subject Marks"}
                </h2>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowModal(false)}
                disabled={isSaving}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="marks-modal-form">
              <div className="form-grid">
                {/* Student */}
                <div className="form-group form-group-full">
                  <label className="form-label">
                    Student <span className="required">*</span>
                  </label>
                  <select
                    className={`form-input form-select ${formErrors.student_id ? "input-error" : ""}`}
                    value={formData.student_id}
                    onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                  >
                    <option value="">-- Select Student --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (#{s.id}) · {s.department}
                      </option>
                    ))}
                  </select>
                  {formErrors.student_id && <span className="error-msg">{formErrors.student_id}</span>}
                </div>

                {/* Subject */}
                <div className="form-group form-group-full">
                  <label className="form-label">
                    Subject Name <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    list="common-subjects-list"
                    className={`form-input ${formErrors.subject ? "input-error" : ""}`}
                    placeholder="e.g. Data Structures & Algorithms"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                  <datalist id="common-subjects-list">
                    {COMMON_SUBJECTS.map((sub) => (
                      <option key={sub} value={sub} />
                    ))}
                  </datalist>
                  {formErrors.subject && <span className="error-msg">{formErrors.subject}</span>}
                </div>

                {/* Exam Type */}
                <div className="form-group">
                  <label className="form-label">Exam Type</label>
                  <select
                    className="form-input form-select"
                    value={formData.exam_type}
                    onChange={(e) => setFormData({ ...formData, exam_type: e.target.value })}
                  >
                    {EXAM_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Semester */}
                <div className="form-group">
                  <label className="form-label">Semester / Term</label>
                  <select
                    className="form-input form-select"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  >
                    {SEMESTERS.map((sem) => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </div>

                {/* Marks Obtained */}
                <div className="form-group">
                  <label className="form-label">
                    Marks Obtained <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className={`form-input ${formErrors.marks_obtained ? "input-error" : ""}`}
                    placeholder="e.g. 88.5"
                    value={formData.marks_obtained}
                    onChange={(e) => setFormData({ ...formData, marks_obtained: e.target.value })}
                  />
                  {formErrors.marks_obtained && (
                    <span className="error-msg">{formErrors.marks_obtained}</span>
                  )}
                </div>

                {/* Max Marks */}
                <div className="form-group">
                  <label className="form-label">
                    Max Marks <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    className={`form-input ${formErrors.max_marks ? "input-error" : ""}`}
                    placeholder="e.g. 100"
                    value={formData.max_marks}
                    onChange={(e) => setFormData({ ...formData, max_marks: e.target.value })}
                  />
                  {formErrors.max_marks && (
                    <span className="error-msg">{formErrors.max_marks}</span>
                  )}
                </div>
              </div>

              {/* Real-time Calculation Preview Card */}
              <div className="live-grade-preview">
                <span className="preview-label">Live Calculation:</span>
                <span className="preview-pct">
                  Percentage: <strong>{livePct}%</strong>
                </span>
                <div className="preview-grade-badge">
                  Grade:{" "}
                  <span
                    className="grade-badge"
                    style={{ background: getGradeColor(liveGrade), marginLeft: 6 }}
                  >
                    {liveGrade}
                  </span>
                </div>
              </div>

              <div className="form-actions" style={{ marginTop: 18 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? "Saving…" : editingMark ? "💾 Save Changes" : "➕ Add Marks"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarksManager;
