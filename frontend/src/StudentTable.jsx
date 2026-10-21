import React from "react";

/**
 * StudentTable component — renders the student data table.
 *
 * Props:
 *  - students        → array of student objects
 *  - onView(student) → called when View is clicked
 *  - onEdit(student) → called when Edit is clicked
 *  - onDelete(id)    → called when Delete is clicked
 *  - isLoading       → show skeleton while data is loading
 *  - sortBy          → current sort field
 *  - sortOrder       → "asc" | "desc"
 *  - onSort(field)   → called when a column header is clicked
 */

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

const yearLabels = ["", "1st", "2nd", "3rd", "4th", "5th", "6th"];

// ── Sortable column header ────────────────────
const SortableHeader = ({ field, label, sortBy, sortOrder, onSort, className }) => {
  const isActive = sortBy === field;
  return (
    <th
      className={`${className || ""} sortable-th ${isActive ? "th-active" : ""}`}
      onClick={() => onSort(field)}
      title={`Sort by ${label}`}
      style={{ cursor: "pointer", userSelect: "none" }}
    >
      {label}
      <span className="sort-arrow">
        {isActive ? (sortOrder === "asc" ? " ↑" : " ↓") : " ↕"}
      </span>
    </th>
  );
};

const StudentTable = ({
  students = [],
  onView,
  onEdit,
  onDelete,
  onDownloadPdf,
  isLoading = false,
  sortBy = "id",
  sortOrder = "desc",
  onSort = () => {},
  userRole = "admin",
}) => {
  // ── Loading skeleton ──────────────────────────
  if (isLoading) {
    return (
      <div className="table-wrapper">
        <table className="student-table">
          <thead><TableHead sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} /></thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="skeleton-row">
                {Array.from({ length: 8 }).map((__, j) => (
                  <td key={j}><div className="skeleton-cell" /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────
  if (students.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🎓</div>
        <h3 className="empty-title">No Students Found</h3>
        <p className="empty-subtitle">
          Add your first student using the button above, or adjust your search filters.
        </p>
      </div>
    );
  }

  // ── Table ─────────────────────────────────────
  return (
    <div className="table-wrapper">
      <table className="student-table">
        <thead>
          <TableHead sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
        </thead>
        <tbody>
          {students.map((student, idx) => (
            <tr key={student.id} className="table-row" style={{ "--row-idx": idx }}>
              <td className="td-id">
                <span className="id-badge">#{student.id}</span>
              </td>

              <td className="td-name">
                <div className="student-name-cell">
                  <div
                    className="student-avatar"
                    style={{ background: getDeptColor(student.department) }}
                  >
                    {student.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="student-name">{student.name}</span>
                </div>
              </td>

              <td className="td-email">
                <a href={`mailto:${student.email}`} className="email-link">
                  {student.email}
                </a>
              </td>

              <td className="td-dept">
                <span
                  className="dept-badge"
                  style={{ "--dept-color": getDeptColor(student.department) }}
                >
                  {student.department}
                </span>
              </td>

              <td className="td-year">
                <span className="year-chip">
                  {yearLabels[student.year] ?? student.year} Year
                </span>
              </td>

              <td className="td-phone">
                <span className="phone-text">📞 {student.phone}</span>
              </td>

              <td className="td-actions">
                <button
                  className="action-btn view-btn"
                  onClick={() => onView(student)}
                  title={`View Profile of ${student.name}`}
                  aria-label={`View student ${student.name}`}
                >
                  👁️ Profile
                </button>
                <button
                  className="action-btn pdf-btn"
                  onClick={() => onDownloadPdf && onDownloadPdf(student)}
                  title={`Download PDF Report for ${student.name}`}
                  aria-label={`Download PDF report for ${student.name}`}
                >
                  📄 PDF
                </button>
                {userRole === "admin" && (
                  <>
                    <button
                      className="action-btn edit-btn"
                      onClick={() => onEdit(student)}
                      title={`Edit ${student.name}`}
                      aria-label={`Edit student ${student.name}`}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="action-btn delete-btn"
                      onClick={() => onDelete(student.id)}
                      title={`Delete ${student.name}`}
                      aria-label={`Delete student ${student.name}`}
                    >
                      🗑️ Delete
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Column headers (reused in skeleton + table) ──
const TableHead = ({ sortBy, sortOrder, onSort }) => (
  <tr>
    <SortableHeader field="id" label="ID" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className="th-id" />
    <SortableHeader field="name" label="Name" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className="th-name" />
    <SortableHeader field="email" label="Email" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className="th-email" />
    <SortableHeader field="department" label="Department" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className="th-dept" />
    <SortableHeader field="year" label="Year" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className="th-year" />
    <SortableHeader field="phone" label="Phone" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className="th-phone" />
    <th className="th-actions">Actions</th>
  </tr>
);

export default StudentTable;
