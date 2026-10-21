import React, { useState, useEffect, useCallback, useRef } from "react";
import StudentForm from "./StudentForm";
import StudentProfileModal from "./StudentProfileModal";
import StudentTable from "./StudentTable";
import DeleteConfirmModal from "./DeleteConfirmModal";
import RegisterStudentModal from "./RegisterStudentModal";
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  importStudents,
  exportStudents,
  getStats,
  downloadStudentReportPDF,
  formatApiError,
} from "./api";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const DEFAULT_DEPARTMENTS = [
  "Computer Science",
  "Information Technology",
  "Engineering",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Commerce",
  "Arts",
];

/**
 * StudentList — main container for all CRUD, search, filters, pagination, CSV.
 * Props:
 *   onDataChange() → called whenever students are added/edited/deleted/imported
 *                    so the parent (App) can refresh the Dashboard.
 */
const StudentList = ({
  onDataChange,
  onNavigateToAttendance,
  onNavigateToMarks,
  userRole = "admin",
  currentStudentId = null,
}) => {
  // ── Data state ──────────────────────────────
  const [students, setStudents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);

  // ── UI state ─────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [viewingStudent, setViewingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showRegister, setShowRegister] = useState(false);

  // ── Filter / sort / pagination state ─────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [sortBy, setSortBy] = useState("id");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const importInputRef = useRef(null);

  // ── Notification helper ──────────────────────
  const notify = useCallback((type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // ── Fetch dynamic departments list from stats ──
  const refreshDepartments = useCallback(async () => {
    try {
      const res = await getStats();
      if (res.data?.departments && Array.isArray(res.data.departments)) {
        const merged = Array.from(
          new Set([...DEFAULT_DEPARTMENTS, ...res.data.departments.filter(Boolean)])
        ).sort();
        setDepartments(merged);
      }
    } catch {
      // Keep default departments if stats fetch fails
    }
  }, []);

  useEffect(() => {
    refreshDepartments();
  }, [refreshDepartments]);

  // ── Fetch students ───────────────────────────
  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getStudents({
        search: searchQuery,
        department: filterDept,
        year: filterYear,
        sortBy,
        sortOrder,
        skip: page * pageSize,
        limit: pageSize,
      });
      setStudents(res.data);
      const headerTotal =
        res.headers["x-total-count"] || res.headers["X-Total-Count"] || "0";
      const total = parseInt(headerTotal, 10);
      setTotalCount(isNaN(total) ? res.data.length : total);
    } catch (err) {
      notify("error", formatApiError(err, "Failed to load students. Is the backend running?"));
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterDept, filterYear, sortBy, sortOrder, page, pageSize, notify]);

  // Debounced fetch on filter changes — reset to page 0
  useEffect(() => {
    setPage(0);
  }, [searchQuery, filterDept, filterYear]);

  // Fetch whenever parameters change
  useEffect(() => {
    const timer = setTimeout(fetchStudents, 250);
    return () => clearTimeout(timer);
  }, [fetchStudents]);

  // ── Derived values ───────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startRow = totalCount === 0 ? 0 : page * pageSize + 1;
  const endRow = Math.min((page + 1) * pageSize, totalCount);

  // ── Add / Edit submit ────────────────────────
  const handleFormSubmit = async (formData) => {
    setIsSaving(true);
    try {
      if (editingStudent) {
        await updateStudent(editingStudent.id, formData);
        notify("success", `✅ "${formData.name}" updated successfully!`);
      } else {
        await createStudent(formData);
        notify("success", `🎉 "${formData.name}" added successfully!`);
      }
      setShowForm(false);
      setEditingStudent(null);
      fetchStudents();
      refreshDepartments();
      if (onDataChange) onDataChange();
    } catch (err) {
      notify("error", `❌ ${formatApiError(err, editingStudent ? "Failed to update." : "Failed to add.")}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete Confirmation Handlers ──────────────
  const handleDeleteClick = (studentOrId) => {
    const student =
      typeof studentOrId === "object"
        ? studentOrId
        : students.find((s) => s.id === studentOrId);
    if (student) {
      setDeletingStudent(student);
    }
  };

  const handleConfirmDelete = async (id) => {
    setIsDeleting(true);
    try {
      await deleteStudent(id);
      notify("success", "🗑️ Student deleted successfully.");
      setDeletingStudent(null);
      // If last item on page, go back one page
      if (students.length === 1 && page > 0) {
        setPage((p) => p - 1);
      } else {
        fetchStudents();
      }
      refreshDepartments();
      if (onDataChange) onDataChange();
    } catch (err) {
      notify("error", `❌ ${formatApiError(err, "Failed to delete student.")}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Edit / View ──────────────────────────────
  const handleEdit = (student) => {
    setEditingStudent(student);
    setShowForm(true);
  };
  const handleView = (student) => setViewingStudent(student);
  const handleAddNew = () => {
    setEditingStudent(null);
    setShowForm(true);
  };
  const handleCancel = () => {
    setShowForm(false);
    setEditingStudent(null);
  };

  // ── PDF Report Direct Download ───────────────
  const handleDownloadPdf = async (student) => {
    notify("info", `⏳ Generating official PDF report for ${student.name}…`);
    try {
      await downloadStudentReportPDF(student.id, student.name);
      notify("success", `📄 PDF report for ${student.name} downloaded successfully!`);
    } catch (err) {
      notify("error", `❌ Failed to download PDF: ${formatApiError(err, "Report generation error.")}`);
    }
  };

  // ── Sort toggle ──────────────────────────────
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(0);
  };

  // ── CSV Export (Blob Download) ───────────────
  const handleExport = async () => {
    try {
      notify("info", "⏳ Preparing CSV export…");
      const res = await exportStudents();
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `students_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      notify("success", "📤 CSV export downloaded successfully!");
    } catch (err) {
      notify("error", `❌ Export failed: ${formatApiError(err, "Could not export CSV.")}`);
    }
  };

  // ── CSV Import ───────────────────────────────
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await importStudents(file);
      const { created, skipped, errors } = res.data;
      setImportResult({ created, skipped, errors });
      if (created > 0) {
        notify(
          "success",
          `📥 Imported ${created} student${created !== 1 ? "s" : ""}${
            skipped ? `, skipped ${skipped} duplicate${skipped !== 1 ? "s" : ""}` : ""
          }.`
        );
        fetchStudents();
        refreshDepartments();
        if (onDataChange) onDataChange();
      } else if (skipped > 0 && errors.length === 0) {
        notify("error", `All ${skipped} records already exist — nothing new imported.`);
      } else {
        notify("error", `Import completed: ${created} added, ${skipped} skipped. Review notes below.`);
      }
    } catch (err) {
      notify("error", `❌ Import failed: ${formatApiError(err, "Error processing CSV.")}`);
    } finally {
      setIsImporting(false);
    }
  };

  // ── Render ───────────────────────────────────
  return (
    <div className="student-list-container">
      {/* Toast notification */}
      {notification && (
        <div className={`toast toast-${notification.type}`}>{notification.message}</div>
      )}

      {/* ── Controls Row 1: Search + Filters ── */}
      <div className="controls-row">
        <div className="search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            id="search-input"
            type="text"
            className="search-input"
            placeholder="Search by name, ID, or email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search students"
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery("")} aria-label="Clear">✕</button>
          )}
        </div>

        {/* Department filter */}
        <select
          id="filter-dept"
          className="filter-select"
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          aria-label="Filter by department"
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Year filter */}
        <select
          id="filter-year"
          className="filter-select"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          aria-label="Filter by year"
        >
          <option value="">All Years</option>
          {[1, 2, 3, 4, 5, 6].map((y) => (
            <option key={y} value={y}>Year {y}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          id="sort-select"
          className="filter-select"
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => {
            const [field, order] = e.target.value.split("-");
            setSortBy(field);
            setSortOrder(order);
            setPage(0);
          }}
          aria-label="Sort students"
        >
          <option value="id-desc">Newest First</option>
          <option value="id-asc">Oldest First</option>
          <option value="name-asc">Name A→Z</option>
          <option value="name-desc">Name Z→A</option>
          <option value="department-asc">Department A→Z</option>
          <option value="year-asc">Year (Low→High)</option>
          <option value="year-desc">Year (High→Low)</option>
          <option value="phone-asc">Phone A→Z</option>
        </select>
      </div>

      {/* ── Controls Row 2: Action buttons ── */}
      <div className="controls-row controls-row-actions">
        {userRole === "admin" && (
          <>
            {/* Primary CTA: Register New Student with full account creation */}
            <button
              id="register-student-btn"
              className="btn btn-primary btn-add"
              onClick={() => setShowRegister(true)}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <span>🎓</span> Register New Student
            </button>

            <button id="add-student-btn" className="btn btn-secondary" onClick={handleAddNew}>
              <span className="btn-icon">+</span> Quick Add
            </button>

            <button id="export-btn" className="btn btn-secondary" onClick={handleExport} title="Download all students as CSV">
              📤 Export CSV
            </button>

            <button
              id="import-btn"
              className="btn btn-secondary"
              onClick={() => importInputRef.current?.click()}
              disabled={isImporting}
              title="Import students from a CSV file"
            >
              {isImporting ? "⏳ Importing…" : "📥 Import CSV"}
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={handleImportFile}
            />
          </>
        )}

        <button
          id="refresh-btn"
          className="btn btn-secondary"
          onClick={() => { fetchStudents(); refreshDepartments(); if (onDataChange) onDataChange(); }}
          title="Refresh data"
        >
          🔄 Refresh
        </button>

        {/* Results count */}
        <span className="results-count">
          {isLoading ? "Loading…" : `${totalCount} student${totalCount !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* ── Import result panel ── */}
      {importResult && (
        <div className="import-result-panel">
          <div className="import-result-summary">
            <span className="import-stat created">✅ {importResult.created} created</span>
            <span className="import-stat skipped">⏭️ {importResult.skipped} skipped</span>
            <button className="import-close-btn" onClick={() => setImportResult(null)}>✕</button>
          </div>
          {importResult.errors.length > 0 && (
            <ul className="import-errors">
              {importResult.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Student Table ── */}
      <StudentTable
        students={students}
        onEdit={handleEdit}
        onDelete={handleDeleteClick}
        onView={handleView}
        onDownloadPdf={handleDownloadPdf}
        isLoading={isLoading}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        userRole={userRole}
      />

      {/* ── Pagination ── */}
      {!isLoading && totalCount > 0 && (
        <div className="pagination-row">
          <div className="pagination-info">
            Showing <strong>{startRow}–{endRow}</strong> of <strong>{totalCount}</strong> students
          </div>

          <div className="pagination-controls">
            <button
              className="page-btn"
              onClick={() => setPage(0)}
              disabled={page === 0}
              aria-label="First page"
            >«</button>
            <button
              className="page-btn"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              aria-label="Previous page"
            >‹</button>

            <span className="page-indicator">
              Page <strong>{page + 1}</strong> of <strong>{totalPages}</strong>
            </span>

            <button
              className="page-btn"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
              aria-label="Next page"
            >›</button>
            <button
              className="page-btn"
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              aria-label="Last page"
            >»</button>
          </div>

          <div className="page-size-selector">
            <label htmlFor="page-size">Rows:</label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── Add / Edit modal ── */}
      {showForm && (
        <StudentForm
          onSubmit={handleFormSubmit}
          onCancel={handleCancel}
          initialData={editingStudent}
          isLoading={isSaving}
        />
      )}

      {/* ── Student Profile Modal (Details + Attendance + Marks + PDF) ── */}
      {viewingStudent && (
        <StudentProfileModal
          studentId={viewingStudent.id}
          onClose={() => setViewingStudent(null)}
          onEditStudent={(s) => {
            setViewingStudent(null);
            handleEdit(s);
          }}
          onOpenAttendance={() => {
            setViewingStudent(null);
            if (onNavigateToAttendance) onNavigateToAttendance();
          }}
          onOpenMarks={() => {
            setViewingStudent(null);
            if (onNavigateToMarks) onNavigateToMarks();
          }}
        />
      )}

      {/* ── Delete Confirmation modal ── */}
      {deletingStudent && (
        <DeleteConfirmModal
          student={deletingStudent}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingStudent(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* ── Register New Student Modal ── */}
      {showRegister && (
        <RegisterStudentModal
          onClose={() => setShowRegister(false)}
          onSuccess={(student) => {
            setShowRegister(false);
            notify("success", `🎉 "${student.name}" registered! Account created successfully.`);
            fetchStudents();
            refreshDepartments();
            if (onDataChange) onDataChange();
          }}
        />
      )}
    </div>
  );
};

export default StudentList;
