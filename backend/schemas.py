from datetime import date, datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field


# ──────────────────────────────────────────────
# Student Schemas
# ──────────────────────────────────────────────

class StudentBase(BaseModel):
    """Shared fields used in both create and update schemas."""
    name: str = Field(..., min_length=1, max_length=100, description="Full name of the student")
    email: EmailStr = Field(..., description="Unique email address of the student")
    department: str = Field(..., min_length=1, max_length=100, description="Department or course")
    year: int = Field(..., ge=1, le=6, description="Current year of study (1–6)")
    phone: str = Field(..., min_length=7, max_length=20, description="Contact phone number")


class StudentCreate(StudentBase):
    """Schema used when creating a new student (POST)."""
    pass


class StudentUpdate(BaseModel):
    """Schema used when updating a student (PUT). All fields are optional."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    department: Optional[str] = Field(None, min_length=1, max_length=100)
    year: Optional[int] = Field(None, ge=1, le=6)
    phone: Optional[str] = Field(None, min_length=7, max_length=20)


class StudentResponse(StudentBase):
    """Schema returned in API responses — includes the database id."""
    id: int

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Auth Schemas
# ──────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    student_id: Optional[int] = None
    department: Optional[str] = None
    student_name: Optional[str] = None
    account_status: Optional[str] = "approved"  # pending | approved | rejected | deactivated

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ──────────────────────────────────────────────
# Account Management Schemas (Admin Portal)
# ──────────────────────────────────────────────

class StudentAccountResponse(BaseModel):
    """Combined view of user account + linked student info for admin approval portal."""
    user_id: int
    username: str
    account_status: str  # pending | approved | rejected | deactivated
    student_id: Optional[int] = None
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    student_department: Optional[str] = None
    student_year: Optional[int] = None
    student_phone: Optional[str] = None

    class Config:
        from_attributes = True


class AccountStatusUpdate(BaseModel):
    """Request body to approve / reject / deactivate a student account."""
    account_status: str = Field(
        ...,
        pattern="^(approved|rejected|deactivated|pending)$",
        description="New account status: approved, rejected, deactivated, or pending",
    )


class StudentCreateWithAccount(StudentBase):
    """Extended create schema that includes optional password and account status."""
    password: Optional[str] = Field(
        None,
        min_length=6,
        max_length=100,
        description="Initial password for the student portal account. Defaults to 'student123' if not provided.",
    )
    account_status: Optional[str] = Field(
        "pending",
        pattern="^(pending|approved)$",
        description="Initial account status. Use 'approved' to allow immediate login.",
    )


# ──────────────────────────────────────────────
# Attendance Schemas
# ──────────────────────────────────────────────

class AttendanceBase(BaseModel):
    student_id: int
    date: date
    status: str = Field(..., pattern="^(Present|Absent|Late)$", description="Present, Absent, or Late")
    remarks: Optional[str] = Field(None, max_length=255)


class AttendanceCreate(AttendanceBase):
    pass


class AttendanceRecordItem(BaseModel):
    student_id: int
    status: str = Field(..., pattern="^(Present|Absent|Late)$")
    remarks: Optional[str] = None


class AttendanceBulkCreate(BaseModel):
    date: date
    records: List[AttendanceRecordItem]


class AttendanceUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(Present|Absent|Late)$")
    remarks: Optional[str] = None


class AttendanceResponse(AttendanceBase):
    id: int
    student_name: Optional[str] = None

    class Config:
        from_attributes = True


class AttendanceSummary(BaseModel):
    student_id: int
    student_name: str
    total_days: int
    present_days: int
    absent_days: int
    late_days: int
    percentage: float


# ──────────────────────────────────────────────
# Marks & Academic Schemas
# ──────────────────────────────────────────────

class MarkBase(BaseModel):
    student_id: int
    subject: str = Field(..., min_length=1, max_length=100)
    exam_type: str = Field("Final Exam", min_length=1, max_length=50)
    marks_obtained: float = Field(..., ge=0)
    max_marks: float = Field(100.0, gt=0)
    semester: Optional[str] = Field("Semester 1", max_length=50)


class MarkCreate(MarkBase):
    pass


class MarkUpdate(BaseModel):
    subject: Optional[str] = Field(None, min_length=1, max_length=100)
    exam_type: Optional[str] = Field(None, min_length=1, max_length=50)
    marks_obtained: Optional[float] = Field(None, ge=0)
    max_marks: Optional[float] = Field(None, gt=0)
    semester: Optional[str] = None


class MarkResponse(MarkBase):
    id: int
    grade: str
    percentage: float
    student_name: Optional[str] = None

    class Config:
        from_attributes = True


class StudentAcademicSummary(BaseModel):
    student_id: int
    student_name: str
    total_subjects: int
    total_marks_obtained: float
    total_max_marks: float
    overall_percentage: float
    overall_grade: str
    marks: List[MarkResponse]


# ──────────────────────────────────────────────
# Full Student Profile Schema
# ──────────────────────────────────────────────

class StudentProfileResponse(BaseModel):
    student: StudentResponse
    attendance_summary: AttendanceSummary
    recent_attendance: List[AttendanceResponse]
    academic_summary: StudentAcademicSummary


# ──────────────────────────────────────────────
# Timetable Schemas
# ──────────────────────────────────────────────

class TimetableBase(BaseModel):
    department: str = Field(..., min_length=1, max_length=100)
    year: int = Field(..., ge=1, le=6)
    day_of_week: str = Field(..., pattern="^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$")
    start_time: str = Field(..., min_length=2, max_length=20)
    end_time: str = Field(..., min_length=2, max_length=20)
    subject: str = Field(..., min_length=1, max_length=100)
    faculty_name: str = Field(..., min_length=1, max_length=100)
    room: str = Field(..., min_length=1, max_length=50)


class TimetableCreate(TimetableBase):
    pass


class TimetableResponse(TimetableBase):
    id: int

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Exam Schedule Schemas
# ──────────────────────────────────────────────

class ExamScheduleBase(BaseModel):
    department: str = Field(..., min_length=1, max_length=100)
    year: int = Field(..., ge=1, le=6)
    semester: str = Field("Semester 1", max_length=50)
    subject: str = Field(..., min_length=1, max_length=100)
    exam_date: date
    start_time: str = Field(..., min_length=2, max_length=20)
    end_time: str = Field(..., min_length=2, max_length=20)
    room: str = Field(..., min_length=1, max_length=50)
    max_marks: float = Field(100.0, gt=0)


class ExamScheduleCreate(ExamScheduleBase):
    pass


class ExamScheduleResponse(ExamScheduleBase):
    id: int

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Announcement Schemas
# ──────────────────────────────────────────────

class AnnouncementBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    content: str = Field(..., min_length=2)
    category: str = Field("General", max_length=50)  # General, Academic, Exam, Urgent
    target_role: str = Field("all", pattern="^(all|faculty|student)$")
    department: Optional[str] = Field(None, max_length=100)
    is_pinned: bool = False


class AnnouncementCreate(AnnouncementBase):
    pass


class AnnouncementResponse(AnnouncementBase):
    id: int
    author_name: str
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Audit Log Schemas
# ──────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: Optional[int] = None
    action: str
    performed_by_id: Optional[int] = None
    performed_by_name: str
    performed_by_role: str
    details: str
    timestamp: datetime

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# Role-Based Dashboard Response Schemas
# ──────────────────────────────────────────────

class AdminDashboardResponse(BaseModel):
    total_students: int
    total_faculty: int
    total_departments: int
    overall_attendance_pct: float
    grade_distribution: Dict[str, int]
    department_stats: List[Dict[str, Any]]
    recent_audit_logs: List[AuditLogResponse]
    recent_announcements: List[AnnouncementResponse]
    upcoming_exams_count: int


class FacultyDashboardResponse(BaseModel):
    department: str
    total_dept_students: int
    today_attendance_recorded: bool
    today_present_count: int
    today_absent_count: int
    dept_avg_marks_pct: float
    today_classes: List[TimetableResponse]
    upcoming_exams: List[ExamScheduleResponse]
    recent_announcements: List[AnnouncementResponse]


class StudentDashboardResponse(BaseModel):
    student: StudentResponse
    overall_attendance_pct: float
    attendance_status: str
    total_subjects_graded: int
    overall_marks_pct: float
    overall_grade: str
    today_classes: List[TimetableResponse]
    upcoming_exams: List[ExamScheduleResponse]
    recent_announcements: List[AnnouncementResponse]

