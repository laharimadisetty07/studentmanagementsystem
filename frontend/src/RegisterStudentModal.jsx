import React, { useState, useEffect, useCallback } from "react";
import { createStudent, formatApiError } from "./api";

// ── Password Generator ────────────────────────────────────────────────────────
const CHARS = {
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  lower: "abcdefghjkmnpqrstuvwxyz",
  digits: "23456789",
  special: "@#$%!",
};

function generateSecurePassword() {
  const all = CHARS.upper + CHARS.lower + CHARS.digits + CHARS.special;
  // Guarantee at least one of each category
  const required = [
    CHARS.upper[Math.floor(Math.random() * CHARS.upper.length)],
    CHARS.lower[Math.floor(Math.random() * CHARS.lower.length)],
    CHARS.digits[Math.floor(Math.random() * CHARS.digits.length)],
    CHARS.special[Math.floor(Math.random() * CHARS.special.length)],
  ];
  // Fill remaining 8 chars
  for (let i = 0; i < 8; i++) {
    required.push(all[Math.floor(Math.random() * all.length)]);
  }
  // Shuffle
  return required.sort(() => Math.random() - 0.5).join("");
}

const DEPARTMENTS = [
  "Computer Science",
  "Information Technology",
  "Engineering",
  "Electronics & Communication",
  "Mechanical Engineering",
  "Civil Engineering",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Commerce",
  "Arts",
  "Business Administration",
];

const EMPTY = {
  name: "",
  email: "",
  phone: "",
  department: "",
  year: "1",
  password: "",
  account_status: "pending",
  customDept: "",
};

/**
 * RegisterStudentModal
 * Full-featured student registration form with:
 *  - Secure password generator
 *  - Account status selection (pending / approved)
 *  - Success dialog showing username + credentials
 *  - Duplicate-email validation (via backend 400 response)
 *
 * Props:
 *  onClose()  — close without registering
 *  onSuccess(student, credentials) — called after successful registration
 */
const RegisterStudentModal = ({ onClose, onSuccess }) => {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCustomDept, setShowCustomDept] = useState(false);

  // Success state — shown after registration
  const [successData, setSuccessData] = useState(null); // { student, username, password, account_status }

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && !isSaving && !successData) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, isSaving, successData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: undefined }));

    if (name === "department") {
      setShowCustomDept(value === "__custom__");
    }
  };

  const handleGeneratePassword = () => {
    const pwd = generateSecurePassword();
    setForm((p) => ({ ...p, password: pwd }));
    setShowPassword(true); // show it so admin can copy
    if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2)
      e.name = "Full name is required (min 2 characters).";

    const email = form.email.trim();
    if (!email) e.email = "Email address is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      e.email = "Enter a valid email (e.g. student@college.edu).";

    if (!form.phone.trim() || !/^[0-9+\s\-().]{7,20}$/.test(form.phone.trim()))
      e.phone = "Phone number is required (7–20 digits/characters).";

    const dept = showCustomDept ? form.customDept.trim() : form.department;
    if (!dept || dept === "" || dept === "__custom__")
      e.department = "Please select or enter a department.";

    const y = parseInt(form.year, 10);
    if (isNaN(y) || y < 1 || y > 6) e.year = "Year must be 1–6.";

    if (!form.password || form.password.length < 6)
      e.password = "Password must be at least 6 characters. Use the generator if needed.";

    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setIsSaving(true);
    try {
      const dept = showCustomDept ? form.customDept.trim() : form.department;
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        department: dept,
        year: parseInt(form.year, 10),
        password: form.password,
        account_status: form.account_status,
      };
      const res = await createStudent(payload);
      const student = res.data;

      // Derive what username the backend assigned (first word of name, lowercased, alphanumeric only)
      const baseUsername = form.name.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, "");
      setSuccessData({
        student,
        usernameHint: baseUsername || `student_${student.id}`,
        password: form.password,
        account_status: form.account_status,
      });
    } catch (err) {
      const msg = err?.response?.data?.detail || formatApiError(err, "Registration failed.");
      if (msg.toLowerCase().includes("email") || msg.toLowerCase().includes("already exists")) {
        setErrors({ email: "This email is already registered to another student." });
      } else {
        setErrors({ _global: msg });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuccessDone = () => {
    if (onSuccess && successData) onSuccess(successData.student, successData);
    onClose();
  };

  // ── Success Screen ────────────────────────────────────────────────────────
  if (successData) {
    const { student, usernameHint, password, account_status } = successData;
    const isPending = account_status === "pending";
    return (
      <div className="modal-overlay">
        <div
          className="modal-card"
          style={{ maxWidth: 520 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="reg-success-title"
        >
          <div className="modal-header" style={{ borderBottom: "1px solid rgba(16,185,129,0.2)" }}>
            <div className="modal-title-group">
              <span className="modal-icon">🎉</span>
              <h2 id="reg-success-title" className="modal-title" style={{ color: "#10b981" }}>
                Student Registered!
              </h2>
            </div>
          </div>

          <div style={{ padding: "24px 28px" }}>
            {/* Student info */}
            <div
              style={{
                padding: "14px 18px",
                background: "rgba(16,185,129,0.08)",
                borderRadius: 12,
                border: "1px solid rgba(16,185,129,0.2)",
                marginBottom: 20,
              }}
            >
              <p style={{ fontWeight: 700, color: "#f1f5f9", marginBottom: 6, fontSize: "1rem" }}>
                {student.name}
              </p>
              <p style={{ color: "#94a3b8", fontSize: "0.83rem", margin: 0 }}>
                🆔 Student ID: <strong style={{ color: "#a5b4fc" }}>#{student.id}</strong>
                &nbsp;&nbsp;|&nbsp;&nbsp;
                🏫 {student.department}, Year {student.year}
              </p>
            </div>

            {/* Account status notice */}
            <div
              style={{
                padding: "12px 16px",
                background: isPending ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.08)",
                borderRadius: 10,
                border: `1px solid ${isPending ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.25)"}`,
                marginBottom: 20,
                fontSize: "0.85rem",
              }}
            >
              <p style={{ fontWeight: 700, color: isPending ? "#fbbf24" : "#10b981", marginBottom: 4 }}>
                {isPending ? "⏳ Account Status: Pending Approval" : "✅ Account Status: Approved — Ready to Log In"}
              </p>
              <p style={{ color: "#94a3b8", margin: 0, fontSize: "0.8rem" }}>
                {isPending
                  ? "Go to the 🔐 Accounts tab → Pending Approvals to approve this student before they can log in."
                  : "This student can log in immediately using the credentials below."}
              </p>
            </div>

            {/* Credentials box */}
            <div
              style={{
                padding: "14px 18px",
                background: "rgba(99,102,241,0.08)",
                borderRadius: 12,
                border: "1px solid rgba(99,102,241,0.25)",
                marginBottom: 22,
              }}
            >
              <p style={{ fontWeight: 700, color: "#a5b4fc", marginBottom: 12, fontSize: "0.85rem" }}>
                🔑 Portal Login Credentials — Share Securely
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#64748b", fontSize: "0.8rem" }}>Login URL:</span>
                  <code style={{ color: "#c084fc", fontSize: "0.82rem" }}>http://localhost:8080</code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#64748b", fontSize: "0.8rem" }}>Username (likely):</span>
                  <code style={{ color: "#a5b4fc", fontSize: "0.82rem" }}>{usernameHint}</code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#64748b", fontSize: "0.8rem" }}>Or login with email:</span>
                  <code style={{ color: "#a5b4fc", fontSize: "0.82rem" }}>{student.email}</code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#64748b", fontSize: "0.8rem" }}>Password:</span>
                  <code
                    style={{
                      color: "#fbbf24",
                      fontSize: "0.82rem",
                      background: "rgba(251,191,36,0.1)",
                      padding: "2px 8px",
                      borderRadius: 6,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {password}
                  </code>
                </div>
              </div>
              <p style={{ color: "#475569", fontSize: "0.72rem", marginTop: 10, marginBottom: 0 }}>
                ⚠️ Save this password now. It cannot be retrieved later. If lost, use the Accounts tab to reset it.
              </p>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  // Copy credentials to clipboard
                  const text = `Student Portal Credentials\nName: ${student.name}\nStudent ID: #${student.id}\nUsername: ${usernameHint}\nEmail: ${student.email}\nPassword: ${password}\nURL: http://localhost:8080`;
                  navigator.clipboard?.writeText(text).catch(() => {});
                }}
              >
                📋 Copy Credentials
              </button>
              <button className="btn btn-primary" onClick={handleSuccessDone}>
                ✅ Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Registration Form ─────────────────────────────────────────────────────
  const effectiveDept = showCustomDept ? form.customDept : form.department;

  return (
    <div className="modal-overlay" onClick={isSaving ? undefined : onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-modal-title"
        style={{ maxWidth: 620 }}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">🎓</span>
            <div>
              <h2 id="reg-modal-title" className="modal-title">Register New Student</h2>
              <p style={{ fontSize: "0.78rem", color: "#64748b", margin: 0 }}>
                Create a student record and portal account in one step
              </p>
            </div>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate style={{ overflowY: "auto", maxHeight: "75vh" }}>
          <div style={{ padding: "20px 24px" }}>
            {/* Global error */}
            {errors._global && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 10,
                  color: "#f87171",
                  fontSize: "0.85rem",
                  marginBottom: 16,
                }}
              >
                ⚠️ {errors._global}
              </div>
            )}

            {/* ── Section 1: Student Information ── */}
            <SectionHeader icon="👤" title="Student Information" />
            <div className="form-grid">
              {/* Full Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="reg-name">
                  Full Name <span className="required">*</span>
                </label>
                <input
                  id="reg-name"
                  name="name"
                  type="text"
                  className={`form-input ${errors.name ? "input-error" : ""}`}
                  placeholder="e.g. Arjun Mehta"
                  value={form.name}
                  onChange={handleChange}
                  autoFocus
                  autoComplete="name"
                />
                {errors.name && <span className="error-msg">{errors.name}</span>}
              </div>

              {/* Email */}
              <div className="form-group">
                <label className="form-label" htmlFor="reg-email">
                  Email Address <span className="required">*</span>
                </label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  className={`form-input ${errors.email ? "input-error" : ""}`}
                  placeholder="e.g. arjun@college.edu"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
                {errors.email && <span className="error-msg">{errors.email}</span>}
                <span style={{ fontSize: "0.75rem", color: "#475569" }}>
                  Used as login credential. Must be unique.
                </span>
              </div>

              {/* Phone */}
              <div className="form-group">
                <label className="form-label" htmlFor="reg-phone">
                  Phone Number <span className="required">*</span>
                </label>
                <input
                  id="reg-phone"
                  name="phone"
                  type="tel"
                  className={`form-input ${errors.phone ? "input-error" : ""}`}
                  placeholder="e.g. +91 98765 43210"
                  value={form.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                />
                {errors.phone && <span className="error-msg">{errors.phone}</span>}
              </div>

              {/* Year */}
              <div className="form-group">
                <label className="form-label" htmlFor="reg-year">
                  Academic Year <span className="required">*</span>
                </label>
                <select
                  id="reg-year"
                  name="year"
                  className={`form-input form-select ${errors.year ? "input-error" : ""}`}
                  value={form.year}
                  onChange={handleChange}
                >
                  {[1, 2, 3, 4, 5, 6].map((y) => (
                    <option key={y} value={y}>
                      {y === 1 ? "Year 1 (First Year)" : y === 2 ? "Year 2 (Second Year)" : y === 3 ? "Year 3 (Third Year)" : `Year ${y}`}
                    </option>
                  ))}
                </select>
                {errors.year && <span className="error-msg">{errors.year}</span>}
              </div>

              {/* Department */}
              <div className="form-group form-group-full">
                <label className="form-label" htmlFor="reg-department">
                  Department <span className="required">*</span>
                </label>
                <select
                  id="reg-department"
                  name="department"
                  className={`form-input form-select ${errors.department ? "input-error" : ""}`}
                  value={showCustomDept ? "__custom__" : form.department}
                  onChange={handleChange}
                >
                  <option value="">— Select Department —</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value="__custom__">✏️ Enter custom department…</option>
                </select>
                {showCustomDept && (
                  <input
                    name="customDept"
                    type="text"
                    className="form-input"
                    placeholder="Type department name"
                    value={form.customDept}
                    onChange={handleChange}
                    style={{ marginTop: 8 }}
                    autoFocus
                  />
                )}
                {errors.department && <span className="error-msg">{errors.department}</span>}
              </div>
            </div>

            {/* ── Section 2: Portal Account ── */}
            <SectionHeader icon="🔐" title="Portal Account Settings" style={{ marginTop: 24 }} />
            <div className="form-grid">
              {/* Password */}
              <div className="form-group form-group-full">
                <label className="form-label" htmlFor="reg-password">
                  Initial Password <span className="required">*</span>
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <input
                      id="reg-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      className={`form-input ${errors.password ? "input-error" : ""}`}
                      placeholder="Min. 6 characters"
                      value={form.password}
                      onChange={handleChange}
                      autoComplete="new-password"
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      title={showPassword ? "Hide password" : "Show password"}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        cursor: "pointer",
                        fontSize: "1rem",
                        padding: 0,
                      }}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleGeneratePassword}
                    title="Generate a secure random password"
                    style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    🎲 Generate
                  </button>
                </div>
                {errors.password && <span className="error-msg">{errors.password}</span>}
                <span style={{ fontSize: "0.75rem", color: "#475569", marginTop: 4 }}>
                  Use the Generate button for a secure random password. Share it with the student privately.
                </span>
              </div>

              {/* Account Status */}
              <div className="form-group form-group-full">
                <label className="form-label" htmlFor="reg-status">
                  Account Approval Status
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                  {[
                    {
                      value: "pending",
                      label: "⏳ Pending",
                      desc: "Requires admin approval before student can log in",
                      color: "#f59e0b",
                    },
                    {
                      value: "approved",
                      label: "✅ Approved",
                      desc: "Student can log in immediately after registration",
                      color: "#10b981",
                    },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "12px 14px",
                        borderRadius: 10,
                        border: `2px solid ${
                          form.account_status === opt.value ? opt.color + "60" : "rgba(71,85,105,0.3)"
                        }`,
                        background:
                          form.account_status === opt.value
                            ? `${opt.color}12`
                            : "transparent",
                        cursor: "pointer",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <input
                        type="radio"
                        name="account_status"
                        value={opt.value}
                        checked={form.account_status === opt.value}
                        onChange={handleChange}
                        style={{ marginTop: 2, accentColor: opt.color }}
                      />
                      <div>
                        <p
                          style={{
                            fontWeight: 700,
                            color: form.account_status === opt.value ? opt.color : "#94a3b8",
                            margin: "0 0 2px",
                            fontSize: "0.85rem",
                          }}
                        >
                          {opt.label}
                        </p>
                        <p style={{ color: "#475569", fontSize: "0.75rem", margin: 0 }}>
                          {opt.desc}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div
            className="form-actions"
            style={{
              padding: "16px 24px",
              borderTop: "1px solid rgba(71,85,105,0.2)",
              background: "rgba(15,23,42,0.5)",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
              style={{ minWidth: 160 }}
            >
              {isSaving ? (
                "⏳ Registering…"
              ) : (
                <>🎓 Register Student & Create Account</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Section Header helper ─────────────────────────────────────────────────────
const SectionHeader = ({ icon, title, style = {} }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
      paddingBottom: 8,
      borderBottom: "1px solid rgba(71,85,105,0.25)",
      ...style,
    }}
  >
    <span style={{ fontSize: "1rem" }}>{icon}</span>
    <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#94a3b8", letterSpacing: "0.05em", textTransform: "uppercase" }}>
      {title}
    </span>
  </div>
);

export default RegisterStudentModal;
