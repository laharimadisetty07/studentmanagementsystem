import React, { useEffect } from "react";

/**
 * StudentDetail modal — displays complete student information.
 *
 * Props:
 *  - student    → the student object to display
 *  - onClose()  → called when modal is dismissed
 *  - onEdit(student) → called when Edit button is clicked
 */

const YEAR_LABELS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th"];

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
  return "#64748b";
};

const StudentDetail = ({ student, onClose, onEdit }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!student) return null;

  const deptColor = getDeptColor(student.department);

  const fields = [
    { label: "Student ID", value: `#${student.id}`, icon: "🔖" },
    { label: "Full Name", value: student.name, icon: "👤" },
    { label: "Email Address", value: student.email, icon: "📧", isEmail: true },
    { label: "Department", value: student.department, icon: "🏛️" },
    { label: "Year of Study", value: `${YEAR_LABELS[student.year] || student.year} Year`, icon: "📅" },
    { label: "Phone Number", value: student.phone, icon: "📞", isPhone: true },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card detail-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-detail-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div
              className="detail-avatar-large"
              style={{ background: deptColor }}
            >
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="modal-title">{student.name}</h2>
              <span
                className="dept-badge"
                style={{ "--dept-color": deptColor }}
              >
                {student.department}
              </span>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Details grid */}
        <div className="detail-body">
          <div className="detail-grid">
            {fields.map(({ label, value, icon, isEmail, isPhone }) => (
              <div key={label} className="detail-field">
                <span className="detail-field-icon">{icon}</span>
                <div className="detail-field-content">
                  <span className="detail-field-label">{label}</span>
                  {isEmail ? (
                    <a href={`mailto:${value}`} className="email-link detail-field-value">
                      {value}
                    </a>
                  ) : isPhone ? (
                    <a href={`tel:${value}`} className="email-link detail-field-value">
                      {value}
                    </a>
                  ) : (
                    <span className="detail-field-value">{value}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="detail-actions">
            <button
              className="btn btn-secondary"
              onClick={onClose}
            >
              ✕ Close
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onEdit(student);
              }}
            >
              ✏️ Edit Student
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDetail;
