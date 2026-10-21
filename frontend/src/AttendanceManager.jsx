import React, { useState, useEffect, useCallback } from "react";
import {
  getStudents,
  getAttendance,
  recordBulkAttendance,
  deleteAttendance,
  formatApiError,
} from "./api";

const getTodayDateStr = () => new Date().toISOString().slice(0, 10);

const AttendanceManager = ({ onDataChange, userRole = "admin", currentStudentId = null }) => {
  const [students, setStudents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr());
  const [attendanceMap, setAttendanceMap] = useState({}); // { [studentId]: { status: "Present", remarks: "" } }
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState(userRole === "student" ? "summary" : "daily"); // "daily" | "summary" | "history"
  const [toast, setToast] = useState(null);

  // Summary / Stats state
  const [summaryData, setSummaryData] = useState([]);
  const [historyRecords, setHistoryRecords] = useState([]);
  // For students: lock filter to their own ID
  const [filterStudentId, setFilterStudentId] = useState(
    userRole === "student" && currentStudentId ? String(currentStudentId) : ""
  );
  const [filterStatus, setFilterStatus] = useState("");

  const notify = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fetch all students for daily marking
  const loadStudents = useCallback(async () => {
    try {
      const res = await getStudents({ limit: 100, sortBy: "name", sortOrder: "asc" });
      setStudents(res.data);
    } catch (err) {
      notify("error", formatApiError(err, "Failed to load students."));
    }
  }, [notify]);

  // Load existing attendance for the selected date
  const loadDateAttendance = useCallback(async (targetDate) => {
    setIsLoading(true);
    try {
      const res = await getAttendance({ date: targetDate, limit: 100 });
      const map = {};
      res.data.forEach((item) => {
        map[item.student_id] = {
          id: item.id,
          status: item.status,
          remarks: item.remarks || "",
        };
      });
      setAttendanceMap(map);
    } catch (err) {
      notify("error", formatApiError(err, "Failed to load attendance records."));
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  // Load overall attendance summary (percentages per student)
  const loadSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      // For students: ALWAYS use their own student_id so they see only their records
      const params = { limit: 500 };
      if (userRole === "student" && currentStudentId) {
        params.student_id = currentStudentId;
      }
      const res = await getAttendance(params);
      const records = res.data;

      // Group by student
      const stats = {};
      records.forEach((r) => {
        if (!stats[r.student_id]) {
          stats[r.student_id] = {
            student_id: r.student_id,
            student_name: r.student_name || `Student #${r.student_id}`,
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
          };
        }
        stats[r.student_id].total += 1;
        if (r.status === "Present") stats[r.student_id].present += 1;
        else if (r.status === "Absent") stats[r.student_id].absent += 1;
        else if (r.status === "Late") stats[r.student_id].late += 1;
      });

      const summaryList = Object.values(stats).map((s) => {
        const effective = s.present + s.late * 0.5;
        const pct = s.total > 0 ? (effective / s.total) * 100 : 0;
        return {
          ...s,
          percentage: Math.round(pct * 10) / 10,
        };
      });

      setSummaryData(summaryList);
      setHistoryRecords(records);
    } catch (err) {
      notify("error", formatApiError(err, "Failed to calculate attendance statistics."));
    } finally {
      setIsLoading(false);
    }
  }, [userRole, currentStudentId, notify]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    if (activeSubTab === "daily") {
      loadDateAttendance(selectedDate);
    } else if (activeSubTab === "summary" || activeSubTab === "history") {
      loadSummary();
    }
  }, [selectedDate, activeSubTab, loadDateAttendance, loadSummary]);

  const handleStatusChange = (studentId, status) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        status,
      },
    }));
  };

  const handleRemarksChange = (studentId, remarks) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { status: "Present" }),
        remarks,
      },
    }));
  };

  const handleMarkAll = (status) => {
    const updated = { ...attendanceMap };
    students.forEach((s) => {
      updated[s.id] = {
        ...(updated[s.id] || {}),
        status,
      };
    });
    setAttendanceMap(updated);
    notify("info", `Marked all ${students.length} students as "${status}".`);
  };

  const handleSaveDaily = async () => {
    setIsSaving(true);
    try {
      const recordsToSave = [];
      students.forEach((s) => {
        const record = attendanceMap[s.id];
        if (record && record.status) {
          recordsToSave.push({
            student_id: s.id,
            status: record.status,
            remarks: record.remarks || null,
          });
        }
      });

      if (recordsToSave.length === 0) {
        notify("error", "Please mark attendance for at least one student.");
        setIsSaving(false);
        return;
      }

      const res = await recordBulkAttendance(selectedDate, recordsToSave);
      notify("success", `✅ ${res.data.message || "Attendance saved successfully!"}`);
      loadDateAttendance(selectedDate);
      if (onDataChange) onDataChange();
    } catch (err) {
      notify("error", `❌ ${formatApiError(err, "Failed to save attendance.")}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async (attendanceId) => {
    if (!window.confirm("Delete this attendance log?")) return;
    try {
      await deleteAttendance(attendanceId);
      notify("success", "Attendance record deleted.");
      loadSummary();
      if (onDataChange) onDataChange();
    } catch (err) {
      notify("error", `❌ ${formatApiError(err)}`);
    }
  };

  const filteredHistory = historyRecords.filter((rec) => {
    if (filterStudentId && rec.student_id !== parseInt(filterStudentId, 10)) return false;
    if (filterStatus && rec.status.toLowerCase() !== filterStatus.toLowerCase()) return false;
    return true;
  });

  return (
    <div className="manager-container">
      {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}

      {/* Sub tabs */}
      <div className="manager-sub-tabs">
        <button
          className={`manager-tab-btn ${activeSubTab === "daily" ? "active" : ""}`}
          onClick={() => setActiveSubTab("daily")}
        >
          📅 Daily Attendance Entry
        </button>
        <button
          className={`manager-tab-btn ${activeSubTab === "summary" ? "active" : ""}`}
          onClick={() => setActiveSubTab("summary")}
        >
          📊 Attendance Percentages &amp; Rates
        </button>
        <button
          className={`manager-tab-btn ${activeSubTab === "history" ? "active" : ""}`}
          onClick={() => setActiveSubTab("history")}
        >
          📜 Attendance Log History
        </button>
      </div>

      {/* ── Sub Tab 1: Daily Entry ── */}
      {activeSubTab === "daily" && (
        <div className="manager-content">
          <div className="daily-controls-bar">
            <div className="date-picker-group">
              <label htmlFor="att-date-picker" className="date-picker-label">
                Select Date:
              </label>
              <input
                id="att-date-picker"
                type="date"
                className="date-input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedDate(getTodayDateStr())}
              >
                Today
              </button>
            </div>

            {userRole !== "student" && (
              <div className="daily-quick-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleMarkAll("Present")}
                >
                  ✅ All Present
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleMarkAll("Absent")}
                >
                  ❌ All Absent
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-save"
                  onClick={handleSaveDaily}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving…" : "💾 Save Attendance"}
                </button>
              </div>
            )}
          </div>

          {/* Student list for marking */}
          <div className="table-wrapper">
            <table className="student-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>ID</th>
                  <th>Student Name</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Remarks / Notes</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="skeleton-row">
                      <td colSpan={5}><div className="skeleton-cell" /></td>
                    </tr>
                  ))
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-table-cell">
                      No students found in database. Add students first.
                    </td>
                  </tr>
                ) : (
                  students.map((s) => {
                    const current = attendanceMap[s.id] || {};
                    const curStatus = current.status || "Present";
                    return (
                      <tr key={s.id} className="table-row">
                        <td><span className="id-badge">#{s.id}</span></td>
                        <td>
                          <strong>{s.name}</strong>
                          <div className="subtext-email">{s.email}</div>
                        </td>
                        <td>
                          <span className="dept-badge">{s.department}</span>
                        </td>
                        <td>
                          {userRole === "student" ? (
                            <span className={`status-tag status-${curStatus.toLowerCase()}`}>
                              {curStatus === "Present" ? "✅ Present" : curStatus === "Absent" ? "❌ Absent" : "⏰ Late"}
                            </span>
                          ) : (
                            <div className="status-toggle-group">
                              <button
                                type="button"
                                className={`status-btn btn-pres ${curStatus === "Present" ? "active" : ""}`}
                                onClick={() => handleStatusChange(s.id, "Present")}
                              >
                                Present
                              </button>
                              <button
                                type="button"
                                className={`status-btn btn-abs ${curStatus === "Absent" ? "active" : ""}`}
                                onClick={() => handleStatusChange(s.id, "Absent")}
                              >
                                Absent
                              </button>
                              <button
                                type="button"
                                className={`status-btn btn-late ${curStatus === "Late" ? "active" : ""}`}
                                onClick={() => handleStatusChange(s.id, "Late")}
                              >
                                Late
                              </button>
                            </div>
                          )}
                        </td>
                        <td>
                          {userRole === "student" ? (
                            <span>{current.remarks || "—"}</span>
                          ) : (
                            <input
                              type="text"
                              className="form-input form-input-sm"
                              placeholder="Optional note…"
                              value={current.remarks || ""}
                              onChange={(e) => handleRemarksChange(s.id, e.target.value)}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Sub Tab 2: Attendance Percentages Summary ── */}
      {activeSubTab === "summary" && (
        <div className="manager-content">
          <div className="summary-headline">
            <h3>📈 Student Attendance Percentage Overview</h3>
            <p className="subtext">
              Real-time calculation based on all logged attendance sessions. Minimum recommended attendance is <strong>75%</strong>.
            </p>
          </div>

          <div className="table-wrapper">
            <table className="student-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Total Days</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Late</th>
                  <th>Percentage</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="skeleton-row">
                      <td colSpan={7}><div className="skeleton-cell" /></td>
                    </tr>
                  ))
                ) : summaryData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-table-cell">
                      No attendance data recorded yet. Use the Daily Attendance tab to log attendance.
                    </td>
                  </tr>
                ) : (
                  summaryData.map((item) => (
                    <tr key={item.student_id} className="table-row">
                      <td>
                        <strong>{item.student_name}</strong>
                        <span className="id-badge" style={{ marginLeft: 8 }}>#{item.student_id}</span>
                      </td>
                      <td>{item.total}</td>
                      <td><span className="att-tag-pres">{item.present}</span></td>
                      <td><span className="att-tag-abs">{item.absent}</span></td>
                      <td><span className="att-tag-late">{item.late}</span></td>
                      <td>
                        <div className="pct-progress-cell">
                          <div className="year-bar-track" style={{ width: 80, height: 8 }}>
                            <div
                              className="year-bar-fill"
                              style={{
                                width: `${Math.min(100, item.percentage)}%`,
                                background: item.percentage >= 75 ? "#10b981" : "#ef4444",
                              }}
                            />
                          </div>
                          <span className="pct-number">{item.percentage}%</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${item.percentage >= 75 ? "status-good" : "status-warning"}`}
                        >
                          {item.percentage >= 85 ? "🌟 Excellent" : item.percentage >= 75 ? "✅ Eligible" : "⚠️ Low Attendance"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Sub Tab 3: History Logs ── */}
      {activeSubTab === "history" && (
        <div className="manager-content">
          <div className="history-filter-bar">
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

            <select
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Late">Late</option>
            </select>

            <span className="results-count" style={{ marginLeft: "auto" }}>
              {filteredHistory.length} logs found
            </span>
          </div>

          <div className="table-wrapper">
            <table className="student-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  {userRole !== "student" && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={userRole !== "student" ? 5 : 4} className="empty-table-cell">No matching attendance logs found.</td>
                  </tr>
                ) : (
                  filteredHistory.map((rec) => (
                    <tr key={rec.id} className="table-row">
                      <td><strong>{rec.date}</strong></td>
                      <td>{rec.student_name} (#{rec.student_id})</td>
                      <td>
                        <span className={`status-tag status-${rec.status.toLowerCase()}`}>
                          {rec.status === "Present" ? "✅ Present" : rec.status === "Absent" ? "❌ Absent" : "⏰ Late"}
                        </span>
                      </td>
                      <td>{rec.remarks || "—"}</td>
                      {userRole !== "student" && (
                        <td>
                          <button
                            className="action-btn delete-btn"
                            onClick={() => handleDeleteRecord(rec.id)}
                            title="Delete this log"
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
        </div>
      )}
    </div>
  );
};

export default AttendanceManager;
