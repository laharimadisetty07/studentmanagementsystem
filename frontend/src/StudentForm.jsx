import React, { useState, useEffect } from "react";

/**
 * StudentForm component
 *
 * Used for both ADDING a new student and EDITING an existing one.
 *
 * Props:
 *  - onSubmit(formData)  → called when the form is submitted
 *  - onCancel()          → called when the user cancels
 *  - initialData         → if provided, pre-fills the form (edit mode)
 *  - isLoading           → disables the submit button while request is in-flight
 */
const EMPTY_FORM = {
  name: "",
  email: "",
  department: "",
  year: "",
  phone: "",
  password: "",
  account_status: "pending",
};

const StudentForm = ({ onSubmit, onCancel, initialData = null, isLoading = false }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const isEditMode = Boolean(initialData);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isLoading) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, isLoading]);

  // Pre-fill form when editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        email: initialData.email || "",
        department: initialData.department || "",
        year: initialData.year || "",
        phone: initialData.phone || "",
        // password and account_status are only relevant when adding
        password: "",
        account_status: "pending",
      });
    } else {
      setFormData(EMPTY_FORM);
    }
    setErrors({});
  }, [initialData]);

  // ── Validation ─────────────────────────────
  const validate = () => {
    const newErrors = {};
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      newErrors.name = "Full name is required.";
    } else if (trimmedName.length < 2) {
      newErrors.name = "Name must be at least 2 characters.";
    } else if (trimmedName.length > 100) {
      newErrors.name = "Name cannot exceed 100 characters.";
    }

    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      newErrors.email = "Email address is required.";
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmedEmail)) {
      newErrors.email = "Please enter a valid email address (e.g. name@example.com).";
    }

    const trimmedDept = formData.department.trim();
    if (!trimmedDept) {
      newErrors.department = "Department is required.";
    } else if (trimmedDept.length < 2) {
      newErrors.department = "Department must be at least 2 characters.";
    }

    const yearNum = parseInt(formData.year, 10);
    if (!formData.year) {
      newErrors.year = "Year of study is required.";
    } else if (isNaN(yearNum) || yearNum < 1 || yearNum > 6) {
      newErrors.year = "Year must be between 1 and 6.";
    }

    const trimmedPhone = formData.phone.trim();
    if (!trimmedPhone) {
      newErrors.phone = "Phone number is required.";
    } else if (!/^[0-9+\s\-().]{7,20}$/.test(trimmedPhone)) {
      newErrors.phone = "Phone number must be 7–20 valid characters (digits, +, -, spaces).";
    }

    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when the user starts typing
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const baseData = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      department: formData.department.trim(),
      year: parseInt(formData.year, 10),
      phone: formData.phone.trim(),
    };

    // Include portal account fields only when creating a new student
    if (!isEditMode) {
      baseData.account_status = formData.account_status || "pending";
      if (formData.password && formData.password.trim().length >= 6) {
        baseData.password = formData.password.trim();
      }
    }

    onSubmit(baseData);
  };

  // ── Render ──────────────────────────────────
  return (
    <div className="modal-overlay" onClick={isLoading ? undefined : onCancel}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-form-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">{isEditMode ? "✏️" : "🎓"}</span>
            <h2 id="student-form-title" className="modal-title">
              {isEditMode ? "Edit Student" : "Add New Student"}
            </h2>
          </div>
          <button
            className="modal-close-btn"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            {/* Name */}
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Full Name <span className="required">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                className={`form-input ${errors.name ? "input-error" : ""}`}
                placeholder="e.g. Rahul Sharma"
                value={formData.name}
                onChange={handleChange}
                autoComplete="name"
              />
              {errors.name && <span className="error-msg">{errors.name}</span>}
            </div>

            {/* Email */}
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email Address <span className="required">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className={`form-input ${errors.email ? "input-error" : ""}`}
                placeholder="e.g. rahul@example.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
              />
              {errors.email && <span className="error-msg">{errors.email}</span>}
            </div>

            {/* Department */}
            <div className="form-group">
              <label htmlFor="department" className="form-label">
                Department <span className="required">*</span>
              </label>
              <input
                id="department"
                name="department"
                type="text"
                className={`form-input ${errors.department ? "input-error" : ""}`}
                placeholder="e.g. Computer Science"
                value={formData.department}
                onChange={handleChange}
              />
              {errors.department && (
                <span className="error-msg">{errors.department}</span>
              )}
            </div>

            {/* Year */}
            <div className="form-group">
              <label htmlFor="year" className="form-label">
                Year of Study <span className="required">*</span>
              </label>
              <select
                id="year"
                name="year"
                className={`form-input form-select ${errors.year ? "input-error" : ""}`}
                value={formData.year}
                onChange={handleChange}
              >
                <option value="">-- Select Year --</option>
                {[1, 2, 3, 4, 5, 6].map((y) => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
              {errors.year && <span className="error-msg">{errors.year}</span>}
            </div>

            {/* Phone */}
            <div className="form-group form-group-full">
              <label htmlFor="phone" className="form-label">
                Phone Number <span className="required">*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className={`form-input ${errors.phone ? "input-error" : ""}`}
                placeholder="e.g. +91 98765 43210"
                value={formData.phone}
                onChange={handleChange}
                autoComplete="tel"
              />
              {errors.phone && <span className="error-msg">{errors.phone}</span>}
            </div>

            {/* Portal Account Section — only shown when creating a new student */}
            {!isEditMode && (
              <>
                <div className="form-group form-group-full" style={{ marginTop: 8 }}>
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "rgba(99,102,241,0.08)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      borderRadius: 10,
                      marginBottom: 16,
                    }}
                  >
                    <p
                      style={{
                        fontSize: "0.82rem",
                        color: "#a5b4fc",
                        fontWeight: 700,
                        marginBottom: 2,
                      }}
                    >
                      🔐 Portal Account Settings
                    </p>
                    <p style={{ fontSize: "0.78rem", color: "#94a3b8", margin: 0 }}>
                      A login account is automatically created. Set the initial password and approval status below.
                    </p>
                  </div>
                </div>

                {/* Password */}
                <div className="form-group">
                  <label htmlFor="password" className="form-label">
                    Initial Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className="form-input"
                    placeholder="Leave blank to use default: student123"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                  />
                  <span style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4 }}>
                    Minimum 6 characters. Share with student securely.
                  </span>
                </div>

                {/* Account Status */}
                <div className="form-group">
                  <label htmlFor="account_status" className="form-label">
                    Account Status
                  </label>
                  <select
                    id="account_status"
                    name="account_status"
                    className="form-input form-select"
                    value={formData.account_status}
                    onChange={handleChange}
                  >
                    <option value="pending">⏳ Pending (requires admin approval before login)</option>
                    <option value="approved">✅ Approved (student can log in immediately)</option>
                  </select>
                </div>
              </>
            )}
          </div>


          {/* Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading
                ? "Saving…"
                : isEditMode
                ? "💾 Save Changes"
                : "➕ Add Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentForm;
