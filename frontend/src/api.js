import axios from "axios";

/**
 * API base URL strategy:
 * In production (Docker), Nginx proxies /api/* → FastAPI backend.
 * In local dev, set REACT_APP_API_URL=http://localhost:8000
 */
const isLocal =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const defaultUrl = isLocal
  ? "/api"
  : "https://student-backend-3070.onrender.com";

const rawUrl = process.env.REACT_APP_API_URL || defaultUrl;
const BASE_URL =
  rawUrl &&
  !rawUrl.startsWith("/") &&
  !rawUrl.startsWith("http://") &&
  !rawUrl.startsWith("https://")
    ? `https://${rawUrl}`
    : rawUrl;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 25000,
});

// Attach Authorization Bearer token from localStorage if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("student_admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─────────────────────────────────────────────
// Authentication API
// ─────────────────────────────────────────────

export const loginAdmin = (username, password) =>
  api.post("/auth/login", { username, password });

export const getAdminMe = () => api.get("/auth/me");

export const logoutAdmin = () => {
  localStorage.removeItem("student_admin_token");
  localStorage.removeItem("student_admin_user");
  return api.post("/auth/logout").catch(() => {});
};

// ─────────────────────────────────────────────
// Student API
// ─────────────────────────────────────────────

export const getStudents = ({
  search = "",
  department = "",
  year = "",
  sortBy = "id",
  sortOrder = "desc",
  skip = 0,
  limit = 10,
} = {}) => {
  const params = { sort_by: sortBy, sort_order: sortOrder, skip, limit };
  if (search) params.search = search;
  if (department) params.department = department;
  if (year) params.year = year;
  return api.get("/students", { params });
};

export const getStudent = (id) => api.get(`/students/${id}`);

export const getStudentProfile = (id) => api.get(`/students/${id}/profile`);

export const createStudent = (data) => api.post("/students", data);

export const updateStudent = (id, data) => api.put(`/students/${id}`, data);

export const deleteStudent = (id) => api.delete(`/students/${id}`);

export const healthCheck = () => api.get("/health");

export const getStats = () => api.get("/stats");

// ─────────────────────────────────────────────
// Attendance API
// ─────────────────────────────────────────────

export const recordAttendance = (data) => api.post("/attendance", data);

export const recordBulkAttendance = (date, records) =>
  api.post("/attendance/bulk", { date, records });

export const getAttendance = ({
  student_id = "",
  date = "",
  status = "",
  skip = 0,
  limit = 50,
} = {}) => {
  const params = { skip, limit };
  if (student_id) params.student_id = student_id;
  if (date) params.date = date;
  if (status) params.status = status;
  return api.get("/attendance", { params });
};

export const getStudentAttendance = (studentId) =>
  api.get(`/students/${studentId}/attendance`);

export const deleteAttendance = (attendanceId) =>
  api.delete(`/attendance/${attendanceId}`);

// ─────────────────────────────────────────────
// Marks & Academic API
// ─────────────────────────────────────────────

export const addMark = (data) => api.post("/marks", data);

export const getMarks = ({
  student_id = "",
  subject = "",
  exam_type = "",
  semester = "",
  skip = 0,
  limit = 50,
} = {}) => {
  const params = { skip, limit };
  if (student_id) params.student_id = student_id;
  if (subject) params.subject = subject;
  if (exam_type) params.exam_type = exam_type;
  if (semester) params.semester = semester;
  return api.get("/marks", { params });
};

export const getStudentMarks = (studentId) =>
  api.get(`/students/${studentId}/marks`);

export const updateMark = (markId, data) => api.put(`/marks/${markId}`, data);

export const deleteMark = (markId) => api.delete(`/marks/${markId}`);

// ─────────────────────────────────────────────
// PDF Report API
// ─────────────────────────────────────────────

export const getStudentReportPDFUrl = (studentId) =>
  `${BASE_URL}/students/${studentId}/report.pdf`;

export const downloadStudentReportPDF = async (studentId, studentName = "student") => {
  const res = await api.get(`/students/${studentId}/report.pdf`, {
    responseType: "blob",
  });
  const blob = new Blob([res.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = studentName.toLowerCase().replace(/[^a-z0-9]/g, "_");
  link.setAttribute("download", `student_${studentId}_${safeName}_report.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  return true;
};

// ─────────────────────────────────────────────
// CSV Import / Export
// ─────────────────────────────────────────────

export const getExportURL = () => `${BASE_URL}/students/export`;

export const exportStudents = () =>
  api.get("/students/export", {
    responseType: "blob",
  });

export const importStudents = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/students/import", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 30000,
  });
};

// ─────────────────────────────────────────────
// PDF Report Card Download
// ─────────────────────────────────────────────

export const downloadReportCardPdf = async (studentId, studentName = "Student") => {
  const response = await api.get(`/students/${studentId}/report-card.pdf`, {
    responseType: "blob",
  });
  const blob = new Blob([response.data], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = studentName.replace(/\s+/g, "_");
  link.setAttribute("download", `ReportCard_${safeName}_#${studentId}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
  return true;
};

// ─────────────────────────────────────────────
// Role-Based Dashboards
// ─────────────────────────────────────────────

export const fetchAdminDashboard = () => api.get("/dashboard/admin");
export const fetchFacultyDashboard = () => api.get("/dashboard/faculty");
export const fetchStudentDashboard = () => api.get("/dashboard/student");

// ─────────────────────────────────────────────
// Timetables
// ─────────────────────────────────────────────

export const fetchTimetables = (params = {}) => api.get("/timetables", { params });
export const createTimetable = (data) => api.post("/timetables", data);
export const deleteTimetable = (id) => api.delete(`/timetables/${id}`);

// ─────────────────────────────────────────────
// Exam Schedules
// ─────────────────────────────────────────────

export const fetchExamSchedules = (params = {}) => api.get("/exams", { params });
export const createExamSchedule = (data) => api.post("/exams", data);
export const deleteExamSchedule = (id) => api.delete(`/exams/${id}`);

// ─────────────────────────────────────────────
// Announcements & Notices
// ─────────────────────────────────────────────

export const fetchAnnouncements = () => api.get("/announcements");
export const createAnnouncement = (data) => api.post("/announcements", data);
export const deleteAnnouncement = (id) => api.delete(`/announcements/${id}`);

// ─────────────────────────────────────────────
// Admin Account Management API
// ─────────────────────────────────────────────

/** List all student portal accounts. Pass { status: "pending" } to filter. */
export const listStudentAccounts = (params = {}) =>
  api.get("/admin/accounts", { params });

/** Approve, reject, deactivate, or re-activate a student account. */
export const updateAccountStatus = (userId, account_status) =>
  api.put(`/admin/accounts/${userId}/status`, { account_status });

/** Reset a student's portal password. */
export const resetStudentPassword = (userId, new_password) =>
  api.put(`/admin/accounts/${userId}/reset-password`, { new_password });

// ─────────────────────────────────────────────
// Audit Logs (Admin Only)
// ─────────────────────────────────────────────

export const fetchAuditLogs = (params = {}) => api.get("/audit-logs", { params });

// ─────────────────────────────────────────────
// Error Formatting Helper
// ─────────────────────────────────────────────

export const formatApiError = (err, fallback = "An unexpected error occurred.") => {
  if (!err) return fallback;
  const detail = err.response?.data?.detail;
  if (!detail) return err.message || fallback;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = item.loc ? item.loc.slice(1).join(".") : "";
        return field ? `${field}: ${item.msg}` : item.msg;
      })
      .join(" | ");
  }

  if (typeof detail === "object") {
    return JSON.stringify(detail);
  }

  return String(detail);
};

export default api;

