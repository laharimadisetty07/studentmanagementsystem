import React, { useEffect } from "react";

/**
 * DeleteConfirmModal — modal dialog for confirming student deletion.
 *
 * Props:
 *  - student    → the student object to delete
 *  - onConfirm  → callback when user confirms deletion
 *  - onCancel   → callback when user cancels
 *  - isDeleting → boolean indicating request is in-flight
 */
const DeleteConfirmModal = ({ student, onConfirm, onCancel, isDeleting = false }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isDeleting) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, isDeleting]);

  if (!student) return null;

  return (
    <div className="modal-overlay" onClick={isDeleting ? undefined : onCancel}>
      <div
        className="modal-card delete-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <div className="delete-modal-header">
          <div className="delete-warning-icon">⚠️</div>
          <div>
            <h2 id="delete-dialog-title" className="delete-modal-title">
              Delete Student
            </h2>
            <p className="delete-modal-subtitle">
              This action is permanent and cannot be undone.
            </p>
          </div>
          <button
            className="modal-close-btn"
            onClick={onCancel}
            disabled={isDeleting}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="delete-modal-body">
          <div className="delete-student-preview">
            <div className="delete-preview-row">
              <span className="delete-preview-label">Student:</span>
              <strong className="delete-preview-name">{student.name}</strong>
              <span className="id-badge">#{student.id}</span>
            </div>
            <div className="delete-preview-meta">
              <span>🏛️ {student.department}</span>
              <span>•</span>
              <span>Year {student.year}</span>
              <span>•</span>
              <span>📧 {student.email}</span>
            </div>
          </div>

          <p className="delete-warning-text">
            Are you sure you want to remove <strong>{student.name}</strong> from the database?
          </p>
        </div>

        <div className="delete-modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => onConfirm(student.id)}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "🗑️ Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
