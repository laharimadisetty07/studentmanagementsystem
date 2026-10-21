import React, { useState, useEffect, useCallback } from "react";
import AdminDashboard from "./AdminDashboard";
import FacultyDashboard from "./FacultyDashboard";
import StudentDashboard from "./StudentDashboard";
import StudentList from "./StudentList";
import AttendanceManager from "./AttendanceManager";
import MarksManager from "./MarksManager";
import TimetableManager from "./TimetableManager";
import ExamScheduleManager from "./ExamScheduleManager";
import AnnouncementsManager from "./AnnouncementsManager";
import AuditLogsManager from "./AuditLogsManager";
import AccountsManager from "./AccountsManager";
import LoginModal from "./LoginModal";
import { getAdminMe, logoutAdmin, listStudentAccounts } from "./api";
import "./App.css";

function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState("dashboard");

  // refreshKey increments whenever students/records change
  const [refreshKey, setRefreshKey] = useState(0);

  // Pending account badge count (admin only)
  const [pendingCount, setPendingCount] = useState(0);

  // Authenticated user state with RBAC (admin, faculty, student)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem("student_admin_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Verify stored token on initial load
  useEffect(() => {
    const token = localStorage.getItem("student_admin_token");
    if (token) {
      getAdminMe()
        .then((res) => {
          setCurrentUser(res.data);
          localStorage.setItem("student_admin_user", JSON.stringify(res.data));
        })
        .catch(() => {
          // Token expired or invalid
          localStorage.removeItem("student_admin_token");
          localStorage.removeItem("student_admin_user");
          setCurrentUser(null);
        });
    }
  }, []);

  // Poll pending accounts count for admin badge
  useEffect(() => {
    if (currentUser?.role !== "admin") return;
    const fetchPending = () => {
      listStudentAccounts({ status: "pending" })
        .then((res) => setPendingCount(res.data.length))
        .catch(() => {});
    };
    fetchPending();
    const interval = setInterval(fetchPending, 30000); // every 30s
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleDataChange = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setActiveTab("dashboard");
    const roleLabel =
      user.role === "admin"
        ? "Administrator"
        : user.role === "faculty"
        ? `Faculty (${user.department || "General"})`
        : `Student (${user.student_name || user.username})`;
    showToast("success", `👋 Signed in as ${roleLabel}!`);
  };

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } catch {
      // Ignore network errors during logout
    }
    setCurrentUser(null);
    setActiveTab("dashboard");
    showToast("info", "🔒 Session logged out successfully.");
  };

  const isStudent = currentUser?.role === "student";
  const isFaculty = currentUser?.role === "faculty";
  const isAdmin = currentUser?.role === "admin";
  const currentRole = currentUser?.role || "guest";

  return (
    <div className="app">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`} style={{ zIndex: 9999 }}>
          {toast.message}
        </div>
      )}

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-brand">
            <span className="header-logo">🎓</span>
            <div>
              <h1 className="header-title">Student Management System</h1>
              <p className="header-subtitle">
                {isStudent
                  ? `Student Portal — Welcome, ${currentUser.student_name || currentUser.username}`
                  : isFaculty
                  ? `Faculty Portal — ${currentUser.department || "Academic Department"}`
                  : "Enterprise Academic Management & Role-Based Control"}
              </p>
            </div>
          </div>

          <div className="header-actions">
            {/* Authentication & Role Status */}
            {currentUser ? (
              <div className="admin-status-cluster">
                {isAdmin && (
                  <span className="admin-badge role-badge-admin" title={`Admin Account: ${currentUser.username}`}>
                    🛡️ Admin: <strong>{currentUser.username}</strong>
                  </span>
                )}
                {isFaculty && (
                  <span className="admin-badge role-badge-faculty" title={`Faculty Member: ${currentUser.department || "General"}`}>
                    👨‍🏫 Faculty: <strong>{currentUser.username}</strong> ({currentUser.department || "Dept"})
                  </span>
                )}
                {isStudent && (
                  <span className="admin-badge role-badge-student" title={`Student Account #${currentUser.student_id}`}>
                    🎓 Student: <strong>{currentUser.student_name || currentUser.username}</strong> (#{currentUser.student_id})
                  </span>
                )}
                <button
                  id="admin-logout-btn"
                  className="btn btn-secondary btn-sm"
                  onClick={handleLogout}
                  title="Logout from current session"
                >
                  🚪 Logout
                </button>
              </div>
            ) : (
              <button
                id="admin-login-btn"
                className="btn btn-primary btn-sm admin-login-trigger"
                onClick={() => setIsLoginOpen(true)}
                title="Sign in with Admin, Faculty, or Student credentials"
              >
                🔐 Sign In / Switch Role
              </button>
            )}

            <div className="header-badge">
              <span className="badge-dot" />
              {currentRole.toUpperCase()}
            </div>
          </div>
        </div>

        {/* ── Top Navigation Tabs (Role Customized) ── */}
        <nav className="main-nav-tabs" aria-label="Main Navigation">
          {/* 1. Dashboard Tab */}
          <button
            id="nav-tab-dashboard"
            className={`nav-tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <span className="tab-icon">📊</span>
            <span className="tab-label">Dashboard</span>
          </button>

          {/* 2. Students / My Profile Tab */}
          <button
            id="nav-tab-students"
            className={`nav-tab-btn ${activeTab === "students" ? "active" : ""}`}
            onClick={() => setActiveTab("students")}
          >
            <span className="tab-icon">{isStudent ? "👤" : "🎓"}</span>
            <span className="tab-label">{isStudent ? "My Profile" : "Students Directory"}</span>
          </button>

          {/* 3. Attendance Tab */}
          <button
            id="nav-tab-attendance"
            className={`nav-tab-btn ${activeTab === "attendance" ? "active" : ""}`}
            onClick={() => setActiveTab("attendance")}
          >
            <span className="tab-icon">📋</span>
            <span className="tab-label">{isStudent ? "My Attendance" : "Attendance Management"}</span>
          </button>

          {/* 4. Marks & Results Tab */}
          <button
            id="nav-tab-marks"
            className={`nav-tab-btn ${activeTab === "marks" ? "active" : ""}`}
            onClick={() => setActiveTab("marks")}
          >
            <span className="tab-icon">📈</span>
            <span className="tab-label">{isStudent ? "My Marks & Grades" : "Marks & Results"}</span>
          </button>

          {/* 5. Timetable Tab */}
          <button
            id="nav-tab-timetable"
            className={`nav-tab-btn ${activeTab === "timetable" ? "active" : ""}`}
            onClick={() => setActiveTab("timetable")}
          >
            <span className="tab-icon">🗓️</span>
            <span className="tab-label">{isStudent ? "My Timetable" : "Class Timetable"}</span>
          </button>

          {/* 6. Exam Schedules Tab */}
          <button
            id="nav-tab-exams"
            className={`nav-tab-btn ${activeTab === "exams" ? "active" : ""}`}
            onClick={() => setActiveTab("exams")}
          >
            <span className="tab-icon">📝</span>
            <span className="tab-label">{isStudent ? "My Exams" : "Exam Schedule"}</span>
          </button>

          {/* 7. Announcements Tab */}
          <button
            id="nav-tab-announcements"
            className={`nav-tab-btn ${activeTab === "announcements" ? "active" : ""}`}
            onClick={() => setActiveTab("announcements")}
          >
            <span className="tab-icon">📢</span>
            <span className="tab-label">Announcements</span>
          </button>

          {/* 8. Account Management (Admin Only) */}
          {isAdmin && (
            <button
              id="nav-tab-accounts"
              className={`nav-tab-btn ${activeTab === "accounts" ? "active" : ""}`}
              onClick={() => setActiveTab("accounts")}
              style={{ position: "relative" }}
            >
              <span className="tab-icon">🔐</span>
              <span className="tab-label">Accounts</span>
              {pendingCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    background: "#f59e0b",
                    color: "#000",
                    borderRadius: "50%",
                    width: 16,
                    height: 16,
                    fontSize: "0.6rem",
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          )}

          {/* 9. Audit Logs (Admin Only) */}
          {isAdmin && (
            <button
              id="nav-tab-audit"
              className={`nav-tab-btn ${activeTab === "audit" ? "active" : ""}`}
              onClick={() => setActiveTab("audit")}
            >
              <span className="tab-icon">🔒</span>
              <span className="tab-label">Audit Logs</span>
            </button>
          )}
        </nav>
      </header>

      {/* ── Main content view ── */}
      <main className="app-main">
        {/* Tab: Dashboard */}
        {activeTab === "dashboard" && (
          <>
            {isStudent ? (
              <StudentDashboard onNavigateTab={(t) => setActiveTab(t)} />
            ) : isFaculty ? (
              <FacultyDashboard onNavigateTab={(t) => setActiveTab(t)} currentUser={currentUser} />
            ) : (
              <AdminDashboard
                onNavigateTab={(t) => setActiveTab(t)}
                onOpenAddStudent={() => setActiveTab("students")}
              />
            )}
          </>
        )}

        {/* Tab: Students Directory / Profile */}
        {activeTab === "students" && (
          <StudentList
            onDataChange={handleDataChange}
            onNavigateToAttendance={() => setActiveTab("attendance")}
            onNavigateToMarks={() => setActiveTab("marks")}
            userRole={currentRole}
            currentStudentId={currentUser?.student_id}
          />
        )}

        {/* Tab: Attendance */}
        {activeTab === "attendance" && (
          <AttendanceManager
            onDataChange={handleDataChange}
            userRole={currentRole}
            currentStudentId={currentUser?.student_id}
          />
        )}

        {/* Tab: Marks & Grades */}
        {activeTab === "marks" && (
          <MarksManager
            onDataChange={handleDataChange}
            userRole={currentRole}
            currentStudentId={currentUser?.student_id}
          />
        )}

        {/* Tab: Class Timetable */}
        {activeTab === "timetable" && (
          <TimetableManager
            userRole={currentRole}
            currentUser={currentUser}
          />
        )}

        {/* Tab: Examination Schedules */}
        {activeTab === "exams" && (
          <ExamScheduleManager
            userRole={currentRole}
            currentUser={currentUser}
          />
        )}

        {/* Tab: Announcements & Notices */}
        {activeTab === "announcements" && (
          <AnnouncementsManager
            userRole={currentRole}
            currentUser={currentUser}
          />
        )}

        {/* Tab: Account Management (Admin Only) */}
        {activeTab === "accounts" && isAdmin && (
          <AccountsManager />
        )}

        {/* Tab: Audit Logs (Admin Only) */}
        {activeTab === "audit" && isAdmin && (
          <AuditLogsManager />
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="app-footer">
        <p>
          Student Management System &copy; {new Date().getFullYear()} &nbsp;|&nbsp;
          Role-Based Access Control: React, FastAPI, PostgreSQL &amp; Docker
        </p>
      </footer>

      {/* ── Multi-Role Login Modal ── */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}

export default App;
