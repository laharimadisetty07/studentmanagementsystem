import React, { useState, useEffect } from "react";
import { fetchAnnouncements, createAnnouncement, deleteAnnouncement, formatApiError } from "./api";

const CATEGORIES = ["All", "General", "Academic", "Exam", "Attendance", "Urgent"];

const AnnouncementsManager = ({ userRole, currentUser }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "General",
    target_role: "all",
    department: currentUser?.role === "faculty" ? currentUser.department : "",
    is_pinned: false,
  });

  const canPost = userRole === "admin" || userRole === "faculty";

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAnnouncements();
      setAnnouncements(res.data);
    } catch (err) {
      setError(formatApiError(err, "Failed to load announcements."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      alert("Please provide both title and content for the announcement.");
      return;
    }
    try {
      setSaving(true);
      await createAnnouncement({
        ...formData,
        department: formData.department.trim() || null,
      });
      setShowAddModal(false);
      setFormData({
        title: "",
        content: "",
        category: "General",
        target_role: "all",
        department: currentUser?.role === "faculty" ? currentUser.department : "",
        is_pinned: false,
      });
      loadAnnouncements();
    } catch (err) {
      alert("Error publishing announcement: " + formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete the announcement '${title}'?`)) return;
    try {
      await deleteAnnouncement(id);
      loadAnnouncements();
    } catch (err) {
      alert("Error deleting announcement: " + formatApiError(err));
    }
  };

  const filteredAnnouncements = announcements.filter((ann) => {
    if (selectedCategory === "All") return true;
    return ann.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  return (
    <div className="module-container">
      {/* ── Header ── */}
      <div className="module-header-card">
        <div className="module-header-title">
          <h2>📢 Announcements & Notifications</h2>
          <p>
            Stay updated with official institution circulars, academic notices, exam alerts, and department guidelines.
          </p>
        </div>

        {canPost && (
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Post Announcement
          </button>
        )}
      </div>

      {/* ── Category Filters ── */}
      <div className="module-controls-bar">
        <div className="day-chips-row">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`day-chip ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Announcements List ── */}
      {loading ? (
        <div className="dashboard-loading">
          <div className="spinner" />
          <p>Loading notices...</p>
        </div>
      ) : error ? (
        <div className="dashboard-error">
          <p>⚠️ {error}</p>
          <button className="btn btn-secondary" onClick={loadAnnouncements}>Retry</button>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="empty-schedule-box">
          <span className="empty-icon">📭</span>
          <h3>No Announcements Found</h3>
          <p>No notices available in the '{selectedCategory}' category.</p>
        </div>
      ) : (
        <div className="announcements-full-feed">
          {filteredAnnouncements.map((ann) => (
            <div key={ann.id} className={`announcement-card-expanded ${ann.is_pinned ? "ann-pinned" : ""}`}>
              <div className="ann-card-top-bar">
                <div className="ann-tags-group">
                  <span className={`ann-category-tag cat-${ann.category.toLowerCase()}`}>
                    {ann.category}
                  </span>
                  {ann.is_pinned && <span className="pin-badge">📌 Pinned Circular</span>}
                  <span className="ann-audience-tag">Audience: {ann.target_role.toUpperCase()}</span>
                  {ann.department && (
                    <span className="ann-dept-scope-tag">Dept: {ann.department}</span>
                  )}
                </div>

                {canPost && (userRole === "admin" || ann.author_name.includes(currentUser?.username)) && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(ann.id, ann.title)}
                    title="Delete notice"
                  >
                    Delete
                  </button>
                )}
              </div>

              <h3 className="ann-expanded-title">{ann.title}</h3>
              <p className="ann-expanded-content">{ann.content}</p>

              <div className="ann-expanded-footer">
                <span className="ann-author">
                  Issued by: <strong>{ann.author_name}</strong>
                </span>
                <span className="ann-date">
                  📅 {new Date(ann.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} at {new Date(ann.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Post Announcement Modal ── */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>+ Publish New Announcement</h3>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Title / Circular Subject *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Schedule for End-Semester Practical Examinations"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="General">General Notice</option>
                    <option value="Academic">Academic Curriculum</option>
                    <option value="Exam">Examinations</option>
                    <option value="Attendance">Attendance Directive</option>
                    <option value="Urgent">Urgent / Alert</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Target Audience</label>
                  <select
                    value={formData.target_role}
                    onChange={(e) => setFormData({ ...formData, target_role: e.target.value })}
                  >
                    <option value="all">Everyone (Faculty & Students)</option>
                    <option value="student">Students Only</option>
                    <option value="faculty">Faculty Members Only</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Department Scope (Optional)</label>
                  <input
                    type="text"
                    placeholder="Leave blank for All Departments"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  />
                </div>

                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.is_pinned}
                      onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                    />
                    <span>Pin this announcement at the top</span>
                  </label>
                </div>

                <div className="form-group full-width">
                  <label>Announcement Content / Message *</label>
                  <textarea
                    rows={5}
                    required
                    placeholder="Write detailed circular text or guidelines..."
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Publishing..." : "Publish Circular"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementsManager;
