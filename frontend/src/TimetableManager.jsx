import React, { useState, useEffect } from "react";
import { fetchTimetables, createTimetable, deleteTimetable, formatApiError } from "./api";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DEPARTMENTS = ["Computer Science", "Information Technology", "Electrical Engineering", "Mechanical Engineering", "Civil Engineering"];

const TimetableManager = ({ userRole, currentUser }) => {
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState("All");
  const [selectedDept, setSelectedDept] = useState(currentUser?.department || "Computer Science");
  const [selectedYear, setSelectedYear] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    department: currentUser?.department || "Computer Science",
    year: 1,
    day_of_week: "Monday",
    start_time: "09:00 AM",
    end_time: "10:00 AM",
    subject: "",
    faculty_name: "",
    room: "Room 101",
  });

  const isStudent = userRole === "student";
  const canManage = userRole === "admin" || userRole === "faculty";

  const loadTimetables = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (!isStudent) {
        if (selectedDept) params.department = selectedDept;
        if (selectedYear) params.year = selectedYear;
      }
      if (selectedDay !== "All") params.day_of_week = selectedDay;

      const res = await fetchTimetables(params);
      setTimetables(res.data);
    } catch (err) {
      setError(formatApiError(err, "Failed to load timetables."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTimetables();
  }, [selectedDay, selectedDept, selectedYear]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.faculty_name.trim()) {
      alert("Please fill in subject and faculty name.");
      return;
    }
    try {
      setSaving(true);
      await createTimetable(formData);
      setShowAddModal(false);
      setFormData({
        department: selectedDept || "Computer Science",
        year: selectedYear || 1,
        day_of_week: "Monday",
        start_time: "09:00 AM",
        end_time: "10:00 AM",
        subject: "",
        faculty_name: "",
        room: "Room 101",
      });
      loadTimetables();
    } catch (err) {
      alert("Error adding class: " + formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, subject) => {
    if (!window.confirm(`Are you sure you want to remove the class '${subject}'?`)) return;
    try {
      await deleteTimetable(id);
      loadTimetables();
    } catch (err) {
      alert("Error deleting class: " + formatApiError(err));
    }
  };

  // Group timetables by day
  const groupedByDay = DAYS.reduce((acc, day) => {
    acc[day] = timetables.filter((t) => t.day_of_week === day);
    return acc;
  }, {});

  const displayedDays = selectedDay === "All" ? DAYS : [selectedDay];

  return (
    <div className="module-container">
      {/* ── Header ── */}
      <div className="module-header-card">
        <div className="module-header-title">
          <h2>🗓️ Class Timetable & Schedule</h2>
          <p>
            {isStudent
              ? "Your weekly class timetable, room assignments, and faculty instructor details."
              : "Manage class schedules, lecture timings, and lecture hall allocations."}
          </p>
        </div>

        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Class Slot
          </button>
        )}
      </div>

      {/* ── Filter Controls ── */}
      <div className="module-controls-bar">
        {!isStudent && (
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
        )}

        <div className="day-chips-row">
          <button
            className={`day-chip ${selectedDay === "All" ? "active" : ""}`}
            onClick={() => setSelectedDay("All")}
          >
            All Days
          </button>
          {DAYS.map((day) => (
            <button
              key={day}
              className={`day-chip ${selectedDay === day ? "active" : ""}`}
              onClick={() => setSelectedDay(day)}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* ── Timetable Grid ── */}
      {loading ? (
        <div className="dashboard-loading">
          <div className="spinner" />
          <p>Loading schedule...</p>
        </div>
      ) : error ? (
        <div className="dashboard-error">
          <p>⚠️ {error}</p>
          <button className="btn btn-secondary" onClick={loadTimetables}>Retry</button>
        </div>
      ) : (
        <div className="timetable-days-container">
          {displayedDays.map((day) => {
            const classesForDay = groupedByDay[day] || [];
            return (
              <div key={day} className="timetable-day-column">
                <div className="tt-day-header">
                  <h3>{day}</h3>
                  <span className="tt-day-count">{classesForDay.length} Classes</span>
                </div>

                {classesForDay.length === 0 ? (
                  <div className="tt-empty-day">No lectures scheduled</div>
                ) : (
                  <div className="tt-day-cards">
                    {classesForDay.map((cls) => (
                      <div key={cls.id} className="tt-class-card">
                        <div className="tt-card-time">
                          <span>{cls.start_time} - {cls.end_time}</span>
                          <span className="tt-room-tag">{cls.room}</span>
                        </div>
                        <h4 className="tt-subject-title">{cls.subject}</h4>
                        <div className="tt-card-footer">
                          <span className="tt-faculty-name">👨‍🏫 {cls.faculty_name}</span>
                          {canManage && (
                            <button
                              className="btn-icon-delete"
                              title="Delete class slot"
                              onClick={() => handleDelete(cls.id, cls.subject)}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Class Slot Modal ── */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>+ Schedule New Class Slot</h3>
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
                  <label>Day of Week</label>
                  <select
                    value={formData.day_of_week}
                    onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Subject / Course Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Operating Systems"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Faculty Instructor *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. A. Kumar"
                    value={formData.faculty_name}
                    onChange={(e) => setFormData({ ...formData, faculty_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Classroom / Laboratory</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS Lab 1 or Hall B-201"
                    value={formData.room}
                    onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="text"
                    placeholder="09:00 AM"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="text"
                    placeholder="10:00 AM"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Add to Timetable"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetableManager;
