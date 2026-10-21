from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, ForeignKey, UniqueConstraint, Text
from sqlalchemy.orm import relationship
from database import Base


class Student(Base):
    """SQLAlchemy ORM model for the students table."""

    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    department = Column(String(100), nullable=False)
    year = Column(Integer, nullable=False)
    phone = Column(String(20), nullable=False)

    attendances = relationship("Attendance", back_populates="student", cascade="all, delete-orphan")
    marks = relationship("Mark", back_populates="student", cascade="all, delete-orphan")


class User(Base):
    """SQLAlchemy ORM model for users with RBAC: admin, faculty, student."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="admin", nullable=False)  # "admin", "faculty", "student"
    student_id = Column(Integer, ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True)
    department = Column(String(100), nullable=True)  # For faculty authorization
    # Account lifecycle: pending → approved → (deactivated | rejected)
    # admin/faculty accounts default to "approved"; student accounts default to "pending"
    account_status = Column(
        String(20),
        default="approved",
        nullable=False,
        server_default="approved",
    )

    student = relationship("Student", backref="user_account", foreign_keys=[student_id])


class Attendance(Base):
    """SQLAlchemy ORM model for daily attendance tracking."""

    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    status = Column(String(20), nullable=False)  # "Present", "Absent", "Late"
    remarks = Column(String(255), nullable=True)

    student = relationship("Student", back_populates="attendances")

    __table_args__ = (
        UniqueConstraint("student_id", "date", name="uq_student_date_attendance"),
    )


class Mark(Base):
    """SQLAlchemy ORM model for marks, grades, and academic performance."""

    __tablename__ = "marks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    subject = Column(String(100), nullable=False)
    exam_type = Column(String(50), default="Final Exam", nullable=False)
    marks_obtained = Column(Float, nullable=False)
    max_marks = Column(Float, default=100.0, nullable=False)
    grade = Column(String(10), nullable=False)
    semester = Column(String(50), default="Semester 1", nullable=True)

    student = relationship("Student", back_populates="marks")


class Timetable(Base):
    """Weekly class timetable schedules per department and year."""

    __tablename__ = "timetables"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    department = Column(String(100), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    day_of_week = Column(String(20), nullable=False)  # Monday, Tuesday, etc.
    start_time = Column(String(20), nullable=False)   # "09:00 AM"
    end_time = Column(String(20), nullable=False)     # "10:00 AM"
    subject = Column(String(100), nullable=False)
    faculty_name = Column(String(100), nullable=False)
    room = Column(String(50), nullable=False)


class ExamSchedule(Base):
    """Upcoming and ongoing examination schedule."""

    __tablename__ = "exam_schedules"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    department = Column(String(100), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    semester = Column(String(50), default="Semester 1", nullable=False)
    subject = Column(String(100), nullable=False)
    exam_date = Column(Date, nullable=False, index=True)
    start_time = Column(String(20), nullable=False)
    end_time = Column(String(20), nullable=False)
    room = Column(String(50), nullable=False)
    max_marks = Column(Float, default=100.0, nullable=False)


class Announcement(Base):
    """System, department, and general announcements/notifications."""

    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50), default="General", nullable=False)  # General, Academic, Exam, Urgent
    target_role = Column(String(20), default="all", nullable=False)  # all, faculty, student
    department = Column(String(100), nullable=True)  # null = all departments
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    author_name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)


class AuditLog(Base):
    """Security and compliance audit trail tracking all marks and attendance changes."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    entity_type = Column(String(50), nullable=False, index=True)  # attendance, marks, students
    entity_id = Column(Integer, nullable=True)
    action = Column(String(20), nullable=False)  # CREATE, UPDATE, DELETE
    performed_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    performed_by_name = Column(String(100), nullable=False)
    performed_by_role = Column(String(20), nullable=False)
    details = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

