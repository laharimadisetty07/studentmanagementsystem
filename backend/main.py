import csv
import io
import logging
import re
from datetime import date, datetime
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, Depends, File, HTTPException, Query, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

import models
import schemas
import auth
from pdf_generator import generate_student_report_pdf, generate_report_card_pdf
from database import engine, get_db, Base, SessionLocal

# ──────────────────────────────────────────────
# Logger
# ──────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def record_audit(
    db: Session,
    entity_type: str,
    entity_id: Optional[int],
    action: str,
    user: Optional[models.User],
    details: str,
):
    """Logs security, attendance, and marks mutations for administrative compliance."""
    try:
        log_entry = models.AuditLog(
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            performed_by_id=user.id if user else None,
            performed_by_name=user.username if user else "System",
            performed_by_role=user.role if user else "system",
            details=details,
            timestamp=datetime.utcnow(),
        )
        db.add(log_entry)
        db.commit()
    except Exception as audit_err:
        logger.warning(f"⚠️ Could not record audit log: {audit_err}")


def init_extra_modules(db: Session):
    """Seed initial demo timetables, exam schedules, and announcements if empty."""
    try:
        if db.query(models.Timetable).count() == 0:
            sample_timetables = [
                models.Timetable(department="Computer Science", year=1, day_of_week="Monday", start_time="09:00 AM", end_time="10:00 AM", subject="Introduction to Programming", faculty_name="Prof. Sharma", room="Room CS-101"),
                models.Timetable(department="Computer Science", year=1, day_of_week="Monday", start_time="10:15 AM", end_time="11:15 AM", subject="Discrete Mathematics", faculty_name="Dr. Raman", room="Room CS-102"),
                models.Timetable(department="Computer Science", year=1, day_of_week="Tuesday", start_time="09:00 AM", end_time="11:00 AM", subject="Data Structures & Algorithms Lab", faculty_name="Prof. Sharma", room="CS Lab 2"),
                models.Timetable(department="Computer Science", year=1, day_of_week="Wednesday", start_time="11:30 AM", end_time="12:30 PM", subject="Computer Organization", faculty_name="Dr. Mehta", room="Hall B"),
                models.Timetable(department="Computer Science", year=1, day_of_week="Thursday", start_time="02:00 PM", end_time="03:00 PM", subject="Object Oriented Programming", faculty_name="Prof. Sharma", room="Room CS-101"),
                models.Timetable(department="Information Technology", year=1, day_of_week="Monday", start_time="09:30 AM", end_time="10:30 AM", subject="Web Development Fundamentals", faculty_name="Prof. Verma", room="IT Lab 1"),
                models.Timetable(department="Information Technology", year=1, day_of_week="Wednesday", start_time="10:00 AM", end_time="11:00 AM", subject="Database Management Systems", faculty_name="Prof. Verma", room="IT Hall 2"),
            ]
            db.add_all(sample_timetables)
            db.commit()

        if db.query(models.ExamSchedule).count() == 0:
            sample_exams = [
                models.ExamSchedule(department="Computer Science", year=1, semester="Semester 1", subject="Data Structures", exam_date=date(2026, 11, 15), start_time="10:00 AM", end_time="01:00 PM", room="Exam Hall A", max_marks=100.0),
                models.ExamSchedule(department="Computer Science", year=1, semester="Semester 1", subject="Discrete Mathematics", exam_date=date(2026, 11, 18), start_time="10:00 AM", end_time="01:00 PM", room="Exam Hall A", max_marks=100.0),
                models.ExamSchedule(department="Computer Science", year=1, semester="Semester 1", subject="Computer Organization", exam_date=date(2026, 11, 22), start_time="02:00 PM", end_time="05:00 PM", room="Exam Hall B", max_marks=100.0),
                models.ExamSchedule(department="Information Technology", year=1, semester="Semester 1", subject="Database Management Systems", exam_date=date(2026, 11, 16), start_time="10:00 AM", end_time="01:00 PM", room="IT Hall 1", max_marks=100.0),
            ]
            db.add_all(sample_exams)
            db.commit()

        if db.query(models.Announcement).count() == 0:
            sample_announcements = [
                models.Announcement(title="Semester 1 Examination Schedule Released", content="The final examination schedules for all undergraduate programs are now available. Please review exam dates, venues, and reporting times.", category="Exam", target_role="all", department=None, author_name="Office of Academic Affairs", is_pinned=True),
                models.Announcement(title="Mid-Term Attendance Compliance Notice", content="Students with attendance below 75% must meet with their faculty advisor before the end of the month to resolve attendance shortages.", category="Attendance", target_role="student", department=None, author_name="Dean of Students", is_pinned=False),
                models.Announcement(title="Computer Science Department Seminar", content="Invited guest lecture on Cloud Architecture and Distributed Systems this Friday at 3:00 PM in Seminar Hall 2.", category="Academic", target_role="all", department="Computer Science", author_name="Prof. Sharma (CS Dept)", is_pinned=False),
                models.Announcement(title="Faculty Grade Submission Deadline", content="All faculty members must submit continuous evaluation and internal marks through the portal before next Monday 5:00 PM.", category="Urgent", target_role="faculty", department=None, author_name="Examination Controller", is_pinned=True),
            ]
            db.add_all(sample_announcements)
            db.commit()
    except Exception as extra_err:
        logger.warning(f"⚠️ Note on module init: {extra_err}")


# ──────────────────────────────────────────────
# Create all tables on startup & seed RBAC users
# ──────────────────────────────────────────────
Base.metadata.create_all(bind=engine)
logger.info("✅ Database tables created (if not already present).")

try:
    with SessionLocal() as db_init:
        auth.init_rbac_users(db_init, engine)
        init_extra_modules(db_init)
    logger.info("✅ RBAC roles and default modules verified.")
except Exception as init_err:
    logger.warning(f"⚠️ Could not init RBAC users: {init_err}")

# ──────────────────────────────────────────────
# FastAPI app instance
# ──────────────────────────────────────────────
app = FastAPI(
    title="Student Management System API",
    description="REST API for managing students — built with FastAPI + PostgreSQL",
    version="2.0.0",
)

# ──────────────────────────────────────────────
# CORS — expose X-Total-Count for pagination
# ──────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "Content-Disposition"],
)


# ══════════════════════════════════════════════
# Health Check
# ══════════════════════════════════════════════

@app.get("/health", tags=["Health"])
def health_check():
    """Simple health-check endpoint for Docker / load-balancer probes."""
    return {"status": "ok", "message": "Student Management API is running 🚀"}


# ══════════════════════════════════════════════
# Dashboard Statistics
# ══════════════════════════════════════════════

@app.get("/stats", tags=["Dashboard"])
def get_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Returns dashboard statistics. Scoped if accessed by a student."""
    if current_user.role == "student":
        student = db.query(models.Student).filter(models.Student.id == current_user.student_id).first()
        return {
            "total_students": 1,
            "total_departments": 1,
            "year_breakdown": [{"year": student.year, "count": 1}] if student else [],
            "department_breakdown": [{"department": student.department, "count": 1}] if student else [],
            "departments": [student.department] if student else [],
            "recent_students": [
                {
                    "id": student.id,
                    "name": student.name,
                    "email": student.email,
                    "department": student.department,
                    "year": student.year,
                    "phone": student.phone,
                }
            ] if student else [],
        }

    total_students = db.query(models.Student).count()

    total_departments = (
        db.query(models.Student.department).distinct().count()
    )

    year_breakdown = (
        db.query(models.Student.year, func.count(models.Student.id).label("count"))
        .group_by(models.Student.year)
        .order_by(models.Student.year)
        .all()
    )

    department_breakdown = (
        db.query(models.Student.department, func.count(models.Student.id).label("count"))
        .group_by(models.Student.department)
        .order_by(func.count(models.Student.id).desc())
        .all()
    )

    department_list = (
        db.query(models.Student.department)
        .distinct()
        .order_by(models.Student.department)
        .all()
    )

    recent_students = (
        db.query(models.Student)
        .order_by(models.Student.id.desc())
        .limit(5)
        .all()
    )

    return {
        "total_students": total_students,
        "total_departments": total_departments,
        "year_breakdown": [{"year": y, "count": c} for y, c in year_breakdown],
        "department_breakdown": [{"department": d, "count": c} for d, c in department_breakdown],
        "departments": [d[0] for d in department_list],
        "recent_students": [
            {
                "id": s.id,
                "name": s.name,
                "email": s.email,
                "department": s.department,
                "year": s.year,
                "phone": s.phone,
            }
            for s in recent_students
        ],
    }


# ══════════════════════════════════════════════
# Export CSV  ← MUST be before /{student_id}
# ══════════════════════════════════════════════

@app.get("/students/export", tags=["Students"], summary="Export all students as CSV (Admin Only)")
def export_students(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """Download all student records as a CSV file. Restricted to administrators."""
    students = db.query(models.Student).order_by(models.Student.id).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "name", "email", "department", "year", "phone"])
    for s in students:
        writer.writerow([s.id, s.name, s.email, s.department, s.year, s.phone])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=students.csv"},
    )


# ══════════════════════════════════════════════
# Import CSV  ← MUST be before /{student_id}
# ══════════════════════════════════════════════

@app.post("/students/import", tags=["Students"], summary="Import students from a CSV file (Admin Only)")
async def import_students(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """
    Upload a CSV with columns: name, email, department, year, phone.
    Duplicate emails are skipped (not silently — reported in response).
    """
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .csv files are accepted.",
        )

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("latin-1")

    results = {"created": 0, "skipped": 0, "errors": [], "total_rows": 0}

    try:
        reader = csv.DictReader(io.StringIO(text))
        raw_fieldnames = reader.fieldnames or []
        fieldnames = [f.strip().lower().lstrip("\ufeff") for f in raw_fieldnames]
        required = {"name", "email", "department", "year", "phone"}

        if not required.issubset(set(fieldnames)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"CSV must have columns: {', '.join(sorted(required))}. "
                    f"Got: {', '.join(fieldnames) or 'none'}"
                ),
            )

        for row_num, raw_row in enumerate(reader, start=2):
            results["total_rows"] += 1
            # Normalize keys to lowercase and stripped
            row = {k.strip().lower().lstrip("\ufeff"): v for k, v in raw_row.items() if k is not None}

            name = (row.get("name") or "").strip()
            email = (row.get("email") or "").strip().lower()
            department = (row.get("department") or "").strip()
            year_str = (row.get("year") or "").strip()
            phone = (row.get("phone") or "").strip()

            if not all([name, email, department, year_str, phone]):
                results["errors"].append(f"Row {row_num}: Missing required fields — skipped")
                continue

            try:
                year = int(year_str)
            except ValueError:
                results["errors"].append(
                    f"Row {row_num}: Year '{year_str}' is not a valid number — skipped"
                )
                continue

            if not (1 <= year <= 6):
                results["errors"].append(
                    f"Row {row_num}: Year {year} is out of range (1–6) — skipped"
                )
                continue

            existing = (
                db.query(models.Student)
                .filter(models.Student.email == email)
                .first()
            )
            if existing:
                results["skipped"] += 1
                results["errors"].append(
                    f"Row {row_num}: Email '{email}' already exists — skipped"
                )
                continue

            try:
                student = models.Student(
                    name=name,
                    email=email,
                    department=department,
                    year=year,
                    phone=phone,
                )
                db.add(student)
                db.commit()
                results["created"] += 1
            except Exception as db_err:
                db.rollback()
                results["errors"].append(f"Row {row_num}: Failed to save - {str(db_err)}")

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error parsing CSV: {exc}",
        )

    return results


# ══════════════════════════════════════════════
# GET /students — list with filters/sort/pagination
# ══════════════════════════════════════════════

@app.get(
    "/students",
    response_model=List[schemas.StudentResponse],
    tags=["Students"],
    summary="Get students (Role Protected)",
)
def get_students(
    response: Response,
    search: Optional[str] = Query(None, description="Search by name, ID, email, phone, or department"),
    department: Optional[str] = Query(None, description="Filter by department"),
    year: Optional[int] = Query(None, ge=1, le=6, description="Filter by year of study"),
    sort_by: str = Query("id", description="Sort field: id | name | email | department | year | phone"),
    sort_order: str = Query("desc", description="Sort direction: asc | desc"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(10, ge=0, description="Page size (0 = return all)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Returns a filtered, sorted, paginated list of students.
    - Admin: Views all students across all departments.
    - Faculty: Views all students (or their authorized department students).
    - Student: Can ONLY see their own record.
    """
    query = db.query(models.Student)

    # RBAC: Student can ONLY view their own record
    if current_user.role == "student":
        query = query.filter(models.Student.id == current_user.student_id)
    else:
        if search:
            search_clean = search.strip()
            if search_clean:
                filter_conditions = [
                    models.Student.name.ilike(f"%{search_clean}%"),
                    models.Student.email.ilike(f"%{search_clean}%"),
                    models.Student.department.ilike(f"%{search_clean}%"),
                    models.Student.phone.ilike(f"%{search_clean}%"),
                ]
                if search_clean.isdigit():
                    filter_conditions.append(models.Student.id == int(search_clean))
                query = query.filter(or_(*filter_conditions))

        if department and department.strip():
            query = query.filter(models.Student.department.ilike(f"%{department.strip()}%"))

        if year:
            query = query.filter(models.Student.year == year)

    # Sorting
    sort_column_map = {
        "id": models.Student.id,
        "name": models.Student.name,
        "email": models.Student.email,
        "department": models.Student.department,
        "year": models.Student.year,
        "phone": models.Student.phone,
    }
    sort_col = sort_column_map.get(sort_by, models.Student.id)
    query = query.order_by(
        sort_col.asc() if sort_order.lower() == "asc" else sort_col.desc()
    )

    # Total count (before pagination)
    total = query.count()
    response.headers["X-Total-Count"] = str(total)
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count, Content-Disposition"

    # Pagination
    if limit > 0:
        students = query.offset(skip).limit(limit).all()
    else:
        students = query.all()

    return students


# ══════════════════════════════════════════════
# GET /students/{id}  — get a single student
# ══════════════════════════════════════════════

@app.get(
    "/students/{student_id}",
    response_model=schemas.StudentResponse,
    tags=["Students"],
    summary="Get student by ID",
)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Returns a single student by ID. Students can only access their own record."""
    auth.verify_student_access(student_id, current_user, db, action="read")
    student = (
        db.query(models.Student)
        .filter(models.Student.id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with id={student_id} not found.",
        )
    return student


# ══════════════════════════════════════════════
# POST /students  — create a new student (Admin Only)
# ══════════════════════════════════════════════

@app.post(
    "/students",
    response_model=schemas.StudentResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Students"],
    summary="Add a new student and create portal account (Admin Only)",
)
def create_student(
    student: schemas.StudentCreateWithAccount,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """
    Creates a new student record and automatically seeds a student portal login account.
    Validates uniqueness of email. Portal account defaults to 'pending' until approved.
    Restricted to Admins.
    """
    # ── Validate duplicate email ──────────────────────────────────────────────
    normalized_email = student.email.strip().lower()
    existing = (
        db.query(models.Student)
        .filter(models.Student.email.ilike(normalized_email))
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A student with email '{normalized_email}' already exists. Each student must have a unique email address.",
        )

    # ── Create student record ─────────────────────────────────────────────────
    student_data = student.model_dump(exclude={"password", "account_status"})
    student_data["email"] = normalized_email
    db_student = models.Student(**student_data)
    db.add(db_student)
    db.commit()
    db.refresh(db_student)

    # ── Build unique portal username ──────────────────────────────────────────
    # Strategy: firstname → firstname+lastname_initial → student_<id>
    initial_password = (student.password or "").strip() or "student123"
    initial_status = student.account_status or "pending"

    name_parts = db_student.name.split()
    first = re.sub(r'[^a-zA-Z0-9]', '', name_parts[0].lower()) if name_parts else ""
    last_initial = re.sub(r'[^a-zA-Z0-9]', '', name_parts[-1][0].lower()) if len(name_parts) > 1 else ""

    candidates = [
        first or f"student_{db_student.id}",
        f"{first}{last_initial}" if last_initial else None,
        f"{first}{db_student.id}",
        f"student_{db_student.id}",
    ]
    username_cand = f"student_{db_student.id}"  # safe fallback
    for cand in candidates:
        if not cand:
            continue
        if not db.query(models.User).filter(models.User.username == cand).first():
            username_cand = cand
            break

    db.add(models.User(
        username=username_cand,
        hashed_password=auth.hash_password(initial_password),
        role="student",
        student_id=db_student.id,
        department=db_student.department,
        account_status=initial_status,
    ))
    db.commit()

    record_audit(
        db,
        "students",
        db_student.id,
        "CREATE",
        current_user,
        f"Registered student '{db_student.name}' (#{db_student.id}, {db_student.department} Yr{db_student.year}), "
        f"portal account='{username_cand}', status={initial_status}",
    )

    logger.info(
        f"✅ Student registered: '{db_student.name}' (id={db_student.id}), "
        f"account='{username_cand}', status={initial_status}"
    )
    return db_student


# ══════════════════════════════════════════════
# PUT /students/{id}  — update a student (Admin Only)
# ══════════════════════════════════════════════

@app.put(
    "/students/{student_id}",
    response_model=schemas.StudentResponse,
    tags=["Students"],
    summary="Update student details (Admin Only)",
)
def update_student(
    student_id: int,
    student_update: schemas.StudentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """Updates one or more fields of an existing student. Restricted to Admins."""
    db_student = (
        db.query(models.Student)
        .filter(models.Student.id == student_id)
        .first()
    )
    if not db_student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with id={student_id} not found.",
        )

    if student_update.email and student_update.email != db_student.email:
        email_exists = (
            db.query(models.Student)
            .filter(models.Student.email == student_update.email)
            .first()
        )
        if email_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{student_update.email}' is already in use.",
            )

    update_data = student_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_student, field, value)

    # Sync department if student user account exists
    student_user = db.query(models.User).filter(models.User.student_id == student_id).first()
    if student_user and student_update.department:
        student_user.department = student_update.department

    db.commit()
    db.refresh(db_student)

    record_audit(
        db,
        "students",
        db_student.id,
        "UPDATE",
        current_user,
        f"Updated student #{student_id} ({db_student.name}) details",
    )

    logger.info(f"✅ Updated student id={student_id}")
    return db_student


# ══════════════════════════════════════════════
# DELETE /students/{id}  — delete a student (Admin Only)
# ══════════════════════════════════════════════

@app.delete(
    "/students/{student_id}",
    status_code=status.HTTP_200_OK,
    tags=["Students"],
    summary="Delete a student (Admin Only)",
)
def delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """Deletes a student by ID. Restricted to Admins."""
    db_student = (
        db.query(models.Student)
        .filter(models.Student.id == student_id)
        .first()
    )
    if not db_student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with id={student_id} not found.",
        )

    student_name = db_student.name
    # Clean up linked user account
    db.query(models.User).filter(models.User.student_id == student_id).delete()
    db.delete(db_student)
    db.commit()

    record_audit(
        db,
        "students",
        student_id,
        "DELETE",
        current_user,
        f"Deleted student #{student_id} ({student_name})",
    )

    logger.info(f"🗑️  Deleted student id={student_id}")
    return {"message": f"Student with id={student_id} has been deleted successfully."}


# ══════════════════════════════════════════════
# Helper Functions: Grades & Summaries
# ══════════════════════════════════════════════

def calculate_grade(marks_obtained: float, max_marks: float) -> str:
    """Calculates letter grade based on marks obtained."""
    if max_marks <= 0:
        return "F"
    pct = (marks_obtained / max_marks) * 100.0
    if pct >= 90:
        return "A+"
    if pct >= 80:
        return "A"
    if pct >= 70:
        return "B"
    if pct >= 60:
        return "C"
    if pct >= 50:
        return "D"
    return "F"


def get_student_attendance_summary(student_id: int, student_name: str, db: Session) -> schemas.AttendanceSummary:
    records = db.query(models.Attendance).filter(models.Attendance.student_id == student_id).all()
    total_days = len(records)
    present_days = sum(1 for r in records if r.status == "Present")
    absent_days = sum(1 for r in records if r.status == "Absent")
    late_days = sum(1 for r in records if r.status == "Late")
    effective_present = present_days + (0.5 * late_days)
    pct = (effective_present / total_days * 100.0) if total_days > 0 else 0.0
    return schemas.AttendanceSummary(
        student_id=student_id,
        student_name=student_name,
        total_days=total_days,
        present_days=present_days,
        absent_days=absent_days,
        late_days=late_days,
        percentage=round(pct, 1),
    )


def get_student_academic_summary(student_id: int, student_name: str, db: Session) -> schemas.StudentAcademicSummary:
    records = db.query(models.Mark).filter(models.Mark.student_id == student_id).order_by(models.Mark.id.desc()).all()
    total_subjects = len(records)
    total_obtained = sum(r.marks_obtained for r in records)
    total_max = sum(r.max_marks for r in records)
    overall_pct = (total_obtained / total_max * 100.0) if total_max > 0 else 0.0
    overall_grade = calculate_grade(total_obtained, total_max) if total_max > 0 else "N/A"

    marks_resp = [
        schemas.MarkResponse(
            id=r.id,
            student_id=r.student_id,
            subject=r.subject,
            exam_type=r.exam_type,
            marks_obtained=r.marks_obtained,
            max_marks=r.max_marks,
            grade=r.grade,
            percentage=round((r.marks_obtained / r.max_marks * 100.0) if r.max_marks > 0 else 0.0, 1),
            semester=r.semester,
            student_name=student_name,
        )
        for r in records
    ]

    return schemas.StudentAcademicSummary(
        student_id=student_id,
        student_name=student_name,
        total_subjects=total_subjects,
        total_marks_obtained=round(total_obtained, 1),
        total_max_marks=round(total_max, 1),
        overall_percentage=round(overall_pct, 1),
        overall_grade=overall_grade,
        marks=marks_resp,
    )


# ══════════════════════════════════════════════
# Authentication Endpoints
# ══════════════════════════════════════════════

@app.post("/auth/login", response_model=schemas.TokenResponse, tags=["Authentication"])
def login(login_req: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Authenticate Admin, Faculty, or Student and return signed JWT. Blocks pending/rejected/deactivated accounts."""
    username_or_email = login_req.username.strip()
    user = (
        db.query(models.User)
        .filter(
            or_(
                models.User.username.ilike(username_or_email),
                models.User.student.has(models.Student.email.ilike(username_or_email)),
            )
        )
        .first()
    )
    if not user or not auth.verify_password(login_req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password.",
        )

    # Enforce account lifecycle for student accounts
    if user.role == "student":
        acct_status = getattr(user, "account_status", "approved") or "approved"
        if acct_status == "pending":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="PENDING: Your student account is awaiting administrator approval. Please check back later or contact your institution.",
            )
        if acct_status == "rejected":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="REJECTED: Your student account application has been declined. Please contact the administrator for assistance.",
            )
        if acct_status == "deactivated":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="DEACTIVATED: Your student account has been suspended. Please contact the administrator.",
            )

    token = auth.create_access_token({
        "sub": user.username,
        "role": user.role,
        "student_id": user.student_id,
        "department": user.department,
    })

    student_name = user.student.name if user.student else None
    acct_status = getattr(user, "account_status", "approved") or "approved"
    user_resp = schemas.UserResponse(
        id=user.id,
        username=user.username,
        role=user.role,
        student_id=user.student_id,
        department=user.department,
        student_name=student_name,
        account_status=acct_status,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_resp,
    }


@app.get("/auth/me", response_model=schemas.UserResponse, tags=["Authentication"])
def get_me(current_user: models.User = Depends(auth.get_current_user)):
    """Returns details of the currently authenticated user with role and linked student info."""
    student_name = current_user.student.name if current_user.student else None
    acct_status = getattr(current_user, "account_status", "approved") or "approved"
    return schemas.UserResponse(
        id=current_user.id,
        username=current_user.username,
        role=current_user.role,
        student_id=current_user.student_id,
        department=current_user.department,
        student_name=student_name,
        account_status=acct_status,
    )


@app.post("/auth/logout", tags=["Authentication"])
def logout():
    """Logout endpoint acknowledging session termination."""
    return {"message": "Logged out successfully."}


# ══════════════════════════════════════════════
# Account Management Endpoints (Admin Portal)
# ══════════════════════════════════════════════

@app.get(
    "/admin/accounts",
    response_model=List[schemas.StudentAccountResponse],
    tags=["Account Management"],
    summary="List all student portal accounts (Admin Only)",
)
def list_student_accounts(
    account_status_filter: Optional[str] = Query(
        None, alias="status",
        description="Filter by account_status: pending | approved | rejected | deactivated"
    ),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """
    Returns all student portal accounts with their approval status.
    Use ?status=pending to see accounts awaiting approval.
    """
    query = db.query(models.User).filter(models.User.role == "student")
    if account_status_filter:
        query = query.filter(models.User.account_status == account_status_filter)
    query = query.order_by(models.User.id.desc())
    users = query.all()

    result = []
    for u in users:
        s = u.student
        result.append(schemas.StudentAccountResponse(
            user_id=u.id,
            username=u.username,
            account_status=getattr(u, "account_status", "approved") or "approved",
            student_id=u.student_id,
            student_name=s.name if s else None,
            student_email=s.email if s else None,
            student_department=s.department if s else None,
            student_year=s.year if s else None,
            student_phone=s.phone if s else None,
        ))
    return result


@app.put(
    "/admin/accounts/{user_id}/status",
    response_model=schemas.StudentAccountResponse,
    tags=["Account Management"],
    summary="Approve, Reject, or Deactivate a student account (Admin Only)",
)
def update_account_status(
    user_id: int,
    body: schemas.AccountStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """
    Changes the account_status of a student user account.
    - approved: Student can log in immediately.
    - pending: Student is blocked from logging in.
    - rejected: Student sees a rejection message.
    - deactivated: Student account is suspended.
    """
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.role == "student",
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student user account with id={user_id} not found.",
        )

    old_status = getattr(user, "account_status", "approved") or "approved"
    user.account_status = body.account_status
    db.commit()
    db.refresh(user)

    record_audit(
        db,
        "users",
        user.id,
        "UPDATE",
        current_user,
        f"Changed account status for '{user.username}' (user #{user.id}) from '{old_status}' → '{body.account_status}'",
    )

    s = user.student
    logger.info(f"✅ Admin '{current_user.username}' set account #{user_id} ('{user.username}') status → {body.account_status}")
    return schemas.StudentAccountResponse(
        user_id=user.id,
        username=user.username,
        account_status=user.account_status,
        student_id=user.student_id,
        student_name=s.name if s else None,
        student_email=s.email if s else None,
        student_department=s.department if s else None,
        student_year=s.year if s else None,
        student_phone=s.phone if s else None,
    )


@app.put(
    "/admin/accounts/{user_id}/reset-password",
    tags=["Account Management"],
    summary="Reset a student's password (Admin Only)",
)
def reset_student_password(
    user_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """
    Resets the password for a student account.
    Body: { \"new_password\": \"...\"}  (min 6 characters)
    """
    new_password = body.get("new_password", "").strip()
    if len(new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters.",
        )
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.role == "student",
    ).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student user account with id={user_id} not found.",
        )
    user.hashed_password = auth.hash_password(new_password)
    db.commit()

    record_audit(
        db, "users", user.id, "UPDATE", current_user,
        f"Password reset for student account '{user.username}' (user #{user_id}) by admin '{current_user.username}'",
    )
    return {"message": f"Password for '{user.username}' has been reset successfully."}


# ══════════════════════════════════════════════
# Student Profile Endpoint (Role Protected)
# ══════════════════════════════════════════════

@app.get("/students/{student_id}/profile", response_model=schemas.StudentProfileResponse, tags=["Students"])
def get_student_profile(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Returns complete student profile with demographics, attendance statistics, and academic performance.
    Students can ONLY access their own profile.
    """
    auth.verify_student_access(student_id, current_user, db, action="read")

    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with id={student_id} not found.",
        )

    att_summary = get_student_attendance_summary(student.id, student.name, db)

    recent_att = (
        db.query(models.Attendance)
        .filter(models.Attendance.student_id == student.id)
        .order_by(models.Attendance.date.desc())
        .limit(10)
        .all()
    )
    recent_att_resp = [
        schemas.AttendanceResponse(
            id=a.id,
            student_id=a.student_id,
            date=a.date,
            status=a.status,
            remarks=a.remarks,
            student_name=student.name,
        )
        for a in recent_att
    ]

    academic_summary = get_student_academic_summary(student.id, student.name, db)

    return schemas.StudentProfileResponse(
        student=student,
        attendance_summary=att_summary,
        recent_attendance=recent_att_resp,
        academic_summary=academic_summary,
    )


# ══════════════════════════════════════════════
# Attendance Endpoints (Role Protected)
# ══════════════════════════════════════════════

@app.post("/attendance", response_model=schemas.AttendanceResponse, tags=["Attendance"])
def record_attendance(
    att_in: schemas.AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_faculty_or_admin),
):
    """
    Records daily attendance for a student (Admin & Faculty only).
    Enforces faculty departmental authorization.
    """
    auth.verify_student_access(att_in.student_id, current_user, db, action="write")

    student = db.query(models.Student).filter(models.Student.id == att_in.student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with id={att_in.student_id} not found.",
        )

    existing = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.student_id == att_in.student_id,
            models.Attendance.date == att_in.date,
        )
        .first()
    )

    if existing:
        existing.status = att_in.status
        existing.remarks = att_in.remarks
        db.commit()
        db.refresh(existing)
        rec = existing
        record_audit(
            db,
            "attendance",
            rec.id,
            "UPDATE",
            current_user,
            f"Updated attendance for #{rec.student_id} ({student.name}) on {rec.date} to '{rec.status}'",
        )
    else:
        rec = models.Attendance(
            student_id=att_in.student_id,
            date=att_in.date,
            status=att_in.status,
            remarks=att_in.remarks,
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)
        record_audit(
            db,
            "attendance",
            rec.id,
            "CREATE",
            current_user,
            f"Recorded attendance for #{rec.student_id} ({student.name}) on {rec.date}: '{rec.status}'",
        )

    return schemas.AttendanceResponse(
        id=rec.id,
        student_id=rec.student_id,
        date=rec.date,
        status=rec.status,
        remarks=rec.remarks,
        student_name=student.name,
    )


@app.post("/attendance/bulk", tags=["Attendance"])
def record_bulk_attendance(
    bulk_in: schemas.AttendanceBulkCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_faculty_or_admin),
):
    """
    Records bulk attendance for multiple students for a specific date (Admin & Faculty only).
    Enforces faculty departmental authorization.
    """
    for item in bulk_in.records:
        auth.verify_student_access(item.student_id, current_user, db, action="write")

    created_count = 0
    updated_count = 0

    for item in bulk_in.records:
        existing = (
            db.query(models.Attendance)
            .filter(
                models.Attendance.student_id == item.student_id,
                models.Attendance.date == bulk_in.date,
            )
            .first()
        )
        if existing:
            existing.status = item.status
            existing.remarks = item.remarks
            updated_count += 1
        else:
            rec = models.Attendance(
                student_id=item.student_id,
                date=bulk_in.date,
                status=item.status,
                remarks=item.remarks,
            )
            db.add(rec)
            created_count += 1

    db.commit()

    record_audit(
        db,
        "attendance",
        None,
        "CREATE",
        current_user,
        f"Recorded bulk attendance for {len(bulk_in.records)} students on {bulk_in.date} ({created_count} new, {updated_count} updated)",
    )

    return {
        "message": f"Bulk attendance processed: {created_count} recorded, {updated_count} updated for {bulk_in.date}.",
        "created": created_count,
        "updated": updated_count,
    }


@app.get("/attendance", response_model=List[schemas.AttendanceResponse], tags=["Attendance"])
def get_attendance_records(
    student_id: Optional[int] = Query(None, description="Filter by student ID"),
    date_val: Optional[date] = Query(None, alias="date", description="Filter by date"),
    status_val: Optional[str] = Query(None, alias="status", description="Filter by status: Present | Absent | Late"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    List attendance records with role-based scoping:
    - Student: Can ONLY query their own attendance.
    - Admin/Faculty: Can view all or filter by student ID.
    """
    if current_user.role == "student":
        if student_id is not None and student_id != current_user.student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Students cannot view attendance records of other students.",
            )
        student_id = current_user.student_id

    query = (
        db.query(models.Attendance, models.Student.name)
        .join(models.Student, models.Attendance.student_id == models.Student.id)
    )

    if student_id:
        query = query.filter(models.Attendance.student_id == student_id)
    if date_val:
        query = query.filter(models.Attendance.date == date_val)
    if status_val:
        query = query.filter(models.Attendance.status.ilike(status_val))

    query = query.order_by(models.Attendance.date.desc(), models.Attendance.id.desc())

    if limit > 0:
        results = query.offset(skip).limit(limit).all()
    else:
        results = query.all()

    return [
        schemas.AttendanceResponse(
            id=att.id,
            student_id=att.student_id,
            date=att.date,
            status=att.status,
            remarks=att.remarks,
            student_name=name,
        )
        for att, name in results
    ]


@app.get("/students/{student_id}/attendance", tags=["Attendance"])
def get_student_attendance(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Returns summary statistics and attendance records. Students can ONLY access their own."""
    auth.verify_student_access(student_id, current_user, db, action="read")

    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with id={student_id} not found.",
        )

    summary = get_student_attendance_summary(student.id, student.name, db)
    records = (
        db.query(models.Attendance)
        .filter(models.Attendance.student_id == student.id)
        .order_by(models.Attendance.date.desc())
        .all()
    )

    return {
        "summary": summary,
        "records": [
            schemas.AttendanceResponse(
                id=r.id,
                student_id=r.student_id,
                date=r.date,
                status=r.status,
                remarks=r.remarks,
                student_name=student.name,
            )
            for r in records
        ],
    }


@app.delete("/attendance/{attendance_id}", tags=["Attendance"])
def delete_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_faculty_or_admin),
):
    """Deletes an attendance record (Admin & Faculty only)."""
    rec = db.query(models.Attendance).filter(models.Attendance.id == attendance_id).first()
    if not rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attendance record with id={attendance_id} not found.",
        )
    auth.verify_student_access(rec.student_id, current_user, db, action="write")
    st_id = rec.student_id
    att_date = rec.date
    att_st = rec.status
    db.delete(rec)
    db.commit()

    record_audit(
        db,
        "attendance",
        attendance_id,
        "DELETE",
        current_user,
        f"Deleted attendance record #{attendance_id} for student #{st_id} ({att_date}: {att_st})",
    )
    return {"message": f"Attendance record #{attendance_id} deleted."}


# ══════════════════════════════════════════════
# Marks & Results Endpoints
# ══════════════════════════════════════════════

@app.post("/marks", response_model=schemas.MarkResponse, tags=["Marks"])
def add_mark(
    mark_in: schemas.MarkCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_faculty_or_admin),
):
    """
    Add a subject mark record for a student (Admin & Faculty only).
    Enforces faculty departmental authorization.
    """
    auth.verify_student_access(mark_in.student_id, current_user, db, action="write")

    student = db.query(models.Student).filter(models.Student.id == mark_in.student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with id={mark_in.student_id} not found.",
        )

    if mark_in.marks_obtained > mark_in.max_marks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Marks obtained ({mark_in.marks_obtained}) cannot exceed maximum marks ({mark_in.max_marks}).",
        )

    calculated_grade = calculate_grade(mark_in.marks_obtained, mark_in.max_marks)

    mark_obj = models.Mark(
        student_id=mark_in.student_id,
        subject=mark_in.subject.strip(),
        exam_type=mark_in.exam_type.strip(),
        marks_obtained=mark_in.marks_obtained,
        max_marks=mark_in.max_marks,
        grade=calculated_grade,
        semester=mark_in.semester.strip() if mark_in.semester else "Semester 1",
    )
    db.add(mark_obj)
    db.commit()
    db.refresh(mark_obj)

    record_audit(
        db,
        "marks",
        mark_obj.id,
        "CREATE",
        current_user,
        f"Entered mark for #{mark_obj.student_id} ({student.name}): {mark_obj.subject} = {mark_obj.marks_obtained}/{mark_obj.max_marks} (Grade: {mark_obj.grade})",
    )

    pct = (mark_obj.marks_obtained / mark_obj.max_marks * 100.0) if mark_obj.max_marks > 0 else 0.0

    return schemas.MarkResponse(
        id=mark_obj.id,
        student_id=mark_obj.student_id,
        subject=mark_obj.subject,
        exam_type=mark_obj.exam_type,
        marks_obtained=mark_obj.marks_obtained,
        max_marks=mark_obj.max_marks,
        grade=mark_obj.grade,
        percentage=round(pct, 1),
        semester=mark_obj.semester,
        student_name=student.name,
    )


@app.get("/marks", response_model=List[schemas.MarkResponse], tags=["Marks"])
def get_marks(
    student_id: Optional[int] = Query(None, description="Filter by student ID"),
    subject: Optional[str] = Query(None, description="Filter by subject"),
    exam_type: Optional[str] = Query(None, description="Filter by exam type"),
    semester: Optional[str] = Query(None, description="Filter by semester"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    List marks records with role-based scoping:
    - Student: Can ONLY view their own marks.
    - Admin/Faculty: Can view all or filter by student ID.
    """
    if current_user.role == "student":
        if student_id is not None and student_id != current_user.student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: Students cannot view marks of other students.",
            )
        student_id = current_user.student_id

    query = (
        db.query(models.Mark, models.Student.name)
        .join(models.Student, models.Mark.student_id == models.Student.id)
    )

    if student_id:
        query = query.filter(models.Mark.student_id == student_id)
    if subject:
        query = query.filter(models.Mark.subject.ilike(f"%{subject.strip()}%"))
    if exam_type:
        query = query.filter(models.Mark.exam_type.ilike(f"%{exam_type.strip()}%"))
    if semester:
        query = query.filter(models.Mark.semester.ilike(f"%{semester.strip()}%"))

    query = query.order_by(models.Mark.id.desc())

    if limit > 0:
        results = query.offset(skip).limit(limit).all()
    else:
        results = query.all()

    return [
        schemas.MarkResponse(
            id=m.id,
            student_id=m.student_id,
            subject=m.subject,
            exam_type=m.exam_type,
            marks_obtained=m.marks_obtained,
            max_marks=m.max_marks,
            grade=m.grade,
            percentage=round((m.marks_obtained / m.max_marks * 100.0) if m.max_marks > 0 else 0.0, 1),
            semester=m.semester,
            student_name=name,
        )
        for m, name in results
    ]


@app.get("/students/{student_id}/marks", response_model=schemas.StudentAcademicSummary, tags=["Marks"])
def get_student_marks_summary(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Returns complete academic transcript. Students can ONLY access their own."""
    auth.verify_student_access(student_id, current_user, db, action="read")

    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with id={student_id} not found.",
        )
    return get_student_academic_summary(student.id, student.name, db)


@app.put("/marks/{mark_id}", response_model=schemas.MarkResponse, tags=["Marks"])
def update_mark(
    mark_id: int,
    mark_update: schemas.MarkUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_faculty_or_admin),
):
    """Update a mark record (Admin & Faculty only). Enforces faculty departmental authorization."""
    mark_obj = db.query(models.Mark).filter(models.Mark.id == mark_id).first()
    if not mark_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mark record with id={mark_id} not found.",
        )

    auth.verify_student_access(mark_obj.student_id, current_user, db, action="write")

    if mark_update.subject is not None:
        mark_obj.subject = mark_update.subject.strip()
    if mark_update.exam_type is not None:
        mark_obj.exam_type = mark_update.exam_type.strip()
    if mark_update.semester is not None:
        mark_obj.semester = mark_update.semester.strip()

    if mark_update.marks_obtained is not None:
        mark_obj.marks_obtained = mark_update.marks_obtained
    if mark_update.max_marks is not None:
        mark_obj.max_marks = mark_update.max_marks

    if mark_obj.marks_obtained > mark_obj.max_marks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Marks obtained cannot exceed maximum marks.",
        )

    mark_obj.grade = calculate_grade(mark_obj.marks_obtained, mark_obj.max_marks)

    db.commit()
    db.refresh(mark_obj)

    record_audit(
        db,
        "marks",
        mark_obj.id,
        "UPDATE",
        current_user,
        f"Updated mark #{mark_id} for student #{mark_obj.student_id}: {mark_obj.subject} = {mark_obj.marks_obtained}/{mark_obj.max_marks} (Grade: {mark_obj.grade})",
    )

    student = db.query(models.Student).filter(models.Student.id == mark_obj.student_id).first()
    pct = (mark_obj.marks_obtained / mark_obj.max_marks * 100.0) if mark_obj.max_marks > 0 else 0.0

    return schemas.MarkResponse(
        id=mark_obj.id,
        student_id=mark_obj.student_id,
        subject=mark_obj.subject,
        exam_type=mark_obj.exam_type,
        marks_obtained=mark_obj.marks_obtained,
        max_marks=mark_obj.max_marks,
        grade=mark_obj.grade,
        percentage=round(pct, 1),
        semester=mark_obj.semester,
        student_name=student.name if student else None,
    )


@app.delete("/marks/{mark_id}", tags=["Marks"])
def delete_mark(
    mark_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_faculty_or_admin),
):
    """Deletes a mark record (Admin & Faculty only)."""
    mark_obj = db.query(models.Mark).filter(models.Mark.id == mark_id).first()
    if not mark_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mark record with id={mark_id} not found.",
        )

    auth.verify_student_access(mark_obj.student_id, current_user, db, action="write")

    st_id = mark_obj.student_id
    sub = mark_obj.subject
    db.delete(mark_obj)
    db.commit()

    record_audit(
        db,
        "marks",
        mark_id,
        "DELETE",
        current_user,
        f"Deleted mark #{mark_id} ({sub}) for student #{st_id}",
    )
    return {"message": f"Mark record #{mark_id} deleted successfully."}


# ══════════════════════════════════════════════
# PDF Report Endpoint (Role Protected)
# ══════════════════════════════════════════════

@app.get("/students/{student_id}/report.pdf", tags=["Reports"], summary="Generate PDF report for student")
def get_student_pdf_report(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Generates and downloads a complete PDF report.
    Students can ONLY download their own report.
    """
    auth.verify_student_access(student_id, current_user, db, action="read")

    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with id={student_id} not found.",
        )

    att_summary = get_student_attendance_summary(student.id, student.name, db).model_dump()
    att_records = (
        db.query(models.Attendance)
        .filter(models.Attendance.student_id == student.id)
        .order_by(models.Attendance.date.desc())
        .limit(15)
        .all()
    )

    academic_summary = get_student_academic_summary(student.id, student.name, db).model_dump()
    marks_records = (
        db.query(models.Mark)
        .filter(models.Mark.student_id == student.id)
        .order_by(models.Mark.id.asc())
        .all()
    )

    pdf_buffer = generate_student_report_pdf(
        student=student,
        attendance_summary=att_summary,
        attendance_records=att_records,
        academic_summary=academic_summary,
        marks_records=marks_records,
    )

    filename = f"student_{student.id}_{student.name.replace(' ', '_')}_report.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ══════════════════════════════════════════════
# Downloadable Formal Academic Report Card PDF
# ══════════════════════════════════════════════

@app.get("/students/{student_id}/report-card.pdf", tags=["Reports"], summary="Download formal academic report card PDF")
def get_student_report_card(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Generates and downloads an official institution report card with
    grades, GPA/percentage, attendance clearance status, and grading scale.
    Students can ONLY download their own report card.
    """
    auth.verify_student_access(student_id, current_user, db, action="read")

    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with id={student_id} not found.",
        )

    att_summary = get_student_attendance_summary(student.id, student.name, db).model_dump()
    academic_summary = get_student_academic_summary(student.id, student.name, db).model_dump()
    marks_records = (
        db.query(models.Mark)
        .filter(models.Mark.student_id == student.id)
        .order_by(models.Mark.id.asc())
        .all()
    )

    pdf_buffer = generate_report_card_pdf(
        student=student,
        academic_summary=academic_summary,
        marks_records=marks_records,
        attendance_summary=att_summary,
    )

    filename = f"report_card_student_{student.id}_{student.name.replace(' ', '_')}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ══════════════════════════════════════════════
# Separate Role-Based Dashboards
# ══════════════════════════════════════════════

@app.get("/dashboard/admin", response_model=schemas.AdminDashboardResponse, tags=["Dashboard"])
def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """Comprehensive institution-wide dashboard for Admins."""
    total_students = db.query(models.Student).count()
    total_faculty = db.query(models.User).filter(models.User.role == "faculty").count()
    total_departments = db.query(func.count(func.distinct(models.Student.department))).scalar() or 0

    # Overall Attendance %
    total_att_records = db.query(models.Attendance).count()
    present_att_records = db.query(models.Attendance).filter(models.Attendance.status == "Present").count()
    overall_att_pct = round((present_att_records / total_att_records * 100.0) if total_att_records > 0 else 0.0, 1)

    # Grade Distribution
    grade_distribution = {"A+": 0, "A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    grade_counts = (
        db.query(models.Mark.grade, func.count(models.Mark.id))
        .group_by(models.Mark.grade)
        .all()
    )
    for g, c in grade_counts:
        if g in grade_distribution:
            grade_distribution[g] = c

    # Department Stats
    dept_rows = (
        db.query(models.Student.department, func.count(models.Student.id))
        .group_by(models.Student.department)
        .all()
    )
    department_stats = [
        {"department": d, "students": count}
        for d, count in dept_rows
    ]

    recent_logs = (
        db.query(models.AuditLog)
        .order_by(models.AuditLog.timestamp.desc())
        .limit(10)
        .all()
    )

    recent_announcements = (
        db.query(models.Announcement)
        .order_by(models.Announcement.is_pinned.desc(), models.Announcement.created_at.desc())
        .limit(5)
        .all()
    )

    upcoming_exams_count = (
        db.query(models.ExamSchedule)
        .filter(models.ExamSchedule.exam_date >= date.today())
        .count()
    )

    return schemas.AdminDashboardResponse(
        total_students=total_students,
        total_faculty=total_faculty,
        total_departments=total_departments,
        overall_attendance_pct=overall_att_pct,
        grade_distribution=grade_distribution,
        department_stats=department_stats,
        recent_audit_logs=recent_logs,
        recent_announcements=recent_announcements,
        upcoming_exams_count=upcoming_exams_count,
    )


@app.get("/dashboard/faculty", response_model=schemas.FacultyDashboardResponse, tags=["Dashboard"])
def get_faculty_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_faculty_or_admin),
):
    """Department and class-specific dashboard for Faculty members."""
    faculty_dept = current_user.department or "Computer Science"

    total_dept_students = (
        db.query(models.Student)
        .filter(models.Student.department.ilike(f"%{faculty_dept.strip()}%"))
        .count()
    )

    # Today's attendance check
    today = date.today()
    today_records = (
        db.query(models.Attendance)
        .join(models.Student, models.Attendance.student_id == models.Student.id)
        .filter(models.Student.department.ilike(f"%{faculty_dept.strip()}%"), models.Attendance.date == today)
        .all()
    )
    today_attendance_recorded = len(today_records) > 0
    today_present = sum(1 for r in today_records if r.status == "Present")
    today_absent = sum(1 for r in today_records if r.status == "Absent")

    # Department Average Marks %
    dept_marks = (
        db.query(models.Mark)
        .join(models.Student, models.Mark.student_id == models.Student.id)
        .filter(models.Student.department.ilike(f"%{faculty_dept.strip()}%"))
        .all()
    )
    if dept_marks:
        total_obtained = sum(m.marks_obtained for m in dept_marks)
        total_max = sum(m.max_marks for m in dept_marks)
        dept_avg_pct = round((total_obtained / total_max * 100.0) if total_max > 0 else 0.0, 1)
    else:
        dept_avg_pct = 0.0

    today_day_name = datetime.now().strftime("%A")
    today_classes = (
        db.query(models.Timetable)
        .filter(
            models.Timetable.department.ilike(f"%{faculty_dept.strip()}%"),
            models.Timetable.day_of_week == today_day_name,
        )
        .order_by(models.Timetable.start_time.asc())
        .all()
    )

    upcoming_exams = (
        db.query(models.ExamSchedule)
        .filter(
            models.ExamSchedule.department.ilike(f"%{faculty_dept.strip()}%"),
            models.ExamSchedule.exam_date >= today,
        )
        .order_by(models.ExamSchedule.exam_date.asc())
        .limit(5)
        .all()
    )

    recent_announcements = (
        db.query(models.Announcement)
        .filter(
            models.Announcement.target_role.in_(["all", "faculty"]),
            or_(models.Announcement.department == None, models.Announcement.department.ilike(f"%{faculty_dept.strip()}%")),
        )
        .order_by(models.Announcement.is_pinned.desc(), models.Announcement.created_at.desc())
        .limit(5)
        .all()
    )

    return schemas.FacultyDashboardResponse(
        department=faculty_dept,
        total_dept_students=total_dept_students,
        today_attendance_recorded=today_attendance_recorded,
        today_present_count=today_present,
        today_absent_count=today_absent,
        dept_avg_marks_pct=dept_avg_pct,
        today_classes=today_classes,
        upcoming_exams=upcoming_exams,
        recent_announcements=recent_announcements,
    )


@app.get("/dashboard/student", response_model=schemas.StudentDashboardResponse, tags=["Dashboard"])
def get_student_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Personalized academic & schedule dashboard for the authenticated Student."""
    if current_user.role != "student" or not current_user.student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student dashboard is exclusively accessible by student accounts.",
        )

    student = db.query(models.Student).filter(models.Student.id == current_user.student_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student record not found.")

    att_summary = get_student_attendance_summary(student.id, student.name, db)
    academic_summary = get_student_academic_summary(student.id, student.name, db)

    att_status = "Good Standing (>=75%)" if att_summary.percentage >= 75 else "Attendance Shortage (<75%)"

    today_day_name = datetime.now().strftime("%A")
    today_classes = (
        db.query(models.Timetable)
        .filter(
            models.Timetable.department.ilike(f"%{student.department.strip()}%"),
            models.Timetable.year == student.year,
            models.Timetable.day_of_week == today_day_name,
        )
        .order_by(models.Timetable.start_time.asc())
        .all()
    )

    upcoming_exams = (
        db.query(models.ExamSchedule)
        .filter(
            models.ExamSchedule.department.ilike(f"%{student.department.strip()}%"),
            models.ExamSchedule.year == student.year,
            models.ExamSchedule.exam_date >= date.today(),
        )
        .order_by(models.ExamSchedule.exam_date.asc())
        .limit(5)
        .all()
    )

    recent_announcements = (
        db.query(models.Announcement)
        .filter(
            models.Announcement.target_role.in_(["all", "student"]),
            or_(models.Announcement.department == None, models.Announcement.department.ilike(f"%{student.department.strip()}%")),
        )
        .order_by(models.Announcement.is_pinned.desc(), models.Announcement.created_at.desc())
        .limit(5)
        .all()
    )

    return schemas.StudentDashboardResponse(
        student=student,
        overall_attendance_pct=att_summary.percentage,
        attendance_status=att_status,
        total_subjects_graded=academic_summary.total_subjects,
        overall_marks_pct=academic_summary.overall_percentage,
        overall_grade=academic_summary.overall_grade,
        today_classes=today_classes,
        upcoming_exams=upcoming_exams,
        recent_announcements=recent_announcements,
    )


# ══════════════════════════════════════════════
# Timetable Endpoints
# ══════════════════════════════════════════════

@app.get("/timetables", response_model=List[schemas.TimetableResponse], tags=["Timetables"])
def get_timetables(
    department: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    day_of_week: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    List class timetables.
    Students are automatically scoped to their department and year.
    """
    query = db.query(models.Timetable)

    if current_user.role == "student" and current_user.student_id:
        student = db.query(models.Student).filter(models.Student.id == current_user.student_id).first()
        if student:
            query = query.filter(
                models.Timetable.department.ilike(f"%{student.department.strip()}%"),
                models.Timetable.year == student.year,
            )
    else:
        if department:
            query = query.filter(models.Timetable.department.ilike(f"%{department.strip()}%"))
        if year:
            query = query.filter(models.Timetable.year == year)

    if day_of_week:
        query = query.filter(models.Timetable.day_of_week == day_of_week)

    return query.order_by(models.Timetable.day_of_week.asc(), models.Timetable.start_time.asc()).all()


@app.post("/timetables", response_model=schemas.TimetableResponse, status_code=status.HTTP_201_CREATED, tags=["Timetables"])
def create_timetable(
    item_in: schemas.TimetableCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_faculty_or_admin),
):
    """Add a timetable schedule item (Admin & Faculty only)."""
    if current_user.role == "faculty" and current_user.department:
        if current_user.department.lower() != "all" and item_in.department.strip().lower() != current_user.department.strip().lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Faculty authorization limited to '{current_user.department}'.",
            )

    new_item = models.Timetable(**item_in.model_dump())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    record_audit(
        db,
        "timetables",
        new_item.id,
        "CREATE",
        current_user,
        f"Added class {new_item.subject} for {new_item.department} Year {new_item.year} on {new_item.day_of_week} ({new_item.start_time})",
    )
    return new_item


@app.delete("/timetables/{timetable_id}", tags=["Timetables"])
def delete_timetable(
    timetable_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_faculty_or_admin),
):
    """Delete a timetable schedule item (Admin & Faculty only)."""
    item = db.query(models.Timetable).filter(models.Timetable.id == timetable_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timetable slot not found.")

    if current_user.role == "faculty" and current_user.department:
        if current_user.department.lower() != "all" and item.department.strip().lower() != current_user.department.strip().lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized for this department.")

    record_audit(
        db,
        "timetables",
        timetable_id,
        "DELETE",
        current_user,
        f"Deleted class {item.subject} for {item.department} on {item.day_of_week}",
    )
    db.delete(item)
    db.commit()
    return {"message": "Timetable item removed."}


# ══════════════════════════════════════════════
# Exam Schedule Endpoints
# ══════════════════════════════════════════════

@app.get("/exams", response_model=List[schemas.ExamScheduleResponse], tags=["Exams"])
def get_exam_schedules(
    department: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    List upcoming examination schedules.
    Students are automatically scoped to their department and year.
    """
    query = db.query(models.ExamSchedule)

    if current_user.role == "student" and current_user.student_id:
        student = db.query(models.Student).filter(models.Student.id == current_user.student_id).first()
        if student:
            query = query.filter(
                models.ExamSchedule.department.ilike(f"%{student.department.strip()}%"),
                models.ExamSchedule.year == student.year,
            )
    else:
        if department:
            query = query.filter(models.ExamSchedule.department.ilike(f"%{department.strip()}%"))
        if year:
            query = query.filter(models.ExamSchedule.year == year)

    return query.order_by(models.ExamSchedule.exam_date.asc(), models.ExamSchedule.start_time.asc()).all()


@app.post("/exams", response_model=schemas.ExamScheduleResponse, status_code=status.HTTP_201_CREATED, tags=["Exams"])
def create_exam_schedule(
    exam_in: schemas.ExamScheduleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_faculty_or_admin),
):
    """Add an examination schedule item (Admin & Faculty only)."""
    if current_user.role == "faculty" and current_user.department:
        if current_user.department.lower() != "all" and exam_in.department.strip().lower() != current_user.department.strip().lower():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Faculty authorization limited to '{current_user.department}'.",
            )

    new_exam = models.ExamSchedule(**exam_in.model_dump())
    db.add(new_exam)
    db.commit()
    db.refresh(new_exam)

    record_audit(
        db,
        "exams",
        new_exam.id,
        "CREATE",
        current_user,
        f"Scheduled exam '{new_exam.subject}' for {new_exam.department} Year {new_exam.year} on {new_exam.exam_date}",
    )
    return new_exam


@app.delete("/exams/{exam_id}", tags=["Exams"])
def delete_exam_schedule(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_faculty_or_admin),
):
    """Delete an examination schedule (Admin & Faculty only)."""
    item = db.query(models.ExamSchedule).filter(models.ExamSchedule.id == exam_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam schedule not found.")

    if current_user.role == "faculty" and current_user.department:
        if current_user.department.lower() != "all" and item.department.strip().lower() != current_user.department.strip().lower():
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized for this department.")

    record_audit(
        db,
        "exams",
        exam_id,
        "DELETE",
        current_user,
        f"Removed exam '{item.subject}' on {item.exam_date}",
    )
    db.delete(item)
    db.commit()
    return {"message": "Exam schedule removed."}


# ══════════════════════════════════════════════
# Announcements & Notifications Endpoints
# ══════════════════════════════════════════════

@app.get("/announcements", response_model=List[schemas.AnnouncementResponse], tags=["Announcements"])
def get_announcements(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    List announcements and notices tailored to user's role and department.
    """
    query = db.query(models.Announcement)

    if current_user.role == "student" and current_user.student_id:
        student = db.query(models.Student).filter(models.Student.id == current_user.student_id).first()
        student_dept = student.department if student else ""
        query = query.filter(
            models.Announcement.target_role.in_(["all", "student"]),
            or_(
                models.Announcement.department == None,
                models.Announcement.department == "",
                models.Announcement.department.ilike(f"%{student_dept.strip()}%"),
            ),
        )
    elif current_user.role == "faculty":
        faculty_dept = current_user.department or ""
        query = query.filter(
            models.Announcement.target_role.in_(["all", "faculty"]),
            or_(
                models.Announcement.department == None,
                models.Announcement.department == "",
                models.Announcement.department.ilike(f"%{faculty_dept.strip()}%"),
            ),
        )

    return query.order_by(models.Announcement.is_pinned.desc(), models.Announcement.created_at.desc()).all()


@app.post("/announcements", response_model=schemas.AnnouncementResponse, status_code=status.HTTP_201_CREATED, tags=["Announcements"])
def create_announcement(
    ann_in: schemas.AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_faculty_or_admin),
):
    """Publish a new announcement (Admin & Faculty only)."""
    author = f"{current_user.username} ({current_user.role.title()})"
    if current_user.role == "faculty" and current_user.department:
        author = f"Faculty ({current_user.department})"

    new_ann = models.Announcement(
        title=ann_in.title.strip(),
        content=ann_in.content.strip(),
        category=ann_in.category,
        target_role=ann_in.target_role,
        department=ann_in.department.strip() if ann_in.department else None,
        created_by_id=current_user.id,
        author_name=author,
        created_at=datetime.utcnow(),
        is_pinned=ann_in.is_pinned,
    )
    db.add(new_ann)
    db.commit()
    db.refresh(new_ann)

    record_audit(
        db,
        "announcements",
        new_ann.id,
        "CREATE",
        current_user,
        f"Published announcement: '{new_ann.title}' (Audience: {new_ann.target_role})",
    )
    return new_ann


@app.delete("/announcements/{announcement_id}", tags=["Announcements"])
def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_faculty_or_admin),
):
    """Delete an announcement (Admin or Announcement author)."""
    ann = db.query(models.Announcement).filter(models.Announcement.id == announcement_id).first()
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found.")

    if current_user.role != "admin" and ann.created_by_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden: You did not author this notice.")

    record_audit(
        db,
        "announcements",
        announcement_id,
        "DELETE",
        current_user,
        f"Deleted announcement: '{ann.title}'",
    )
    db.delete(ann)
    db.commit()
    return {"message": "Announcement deleted."}


# ══════════════════════════════════════════════
# Audit Logs Endpoints (Admin Only)
# ══════════════════════════════════════════════

@app.get("/audit-logs", response_model=List[schemas.AuditLogResponse], tags=["Audit Logs"])
def get_audit_logs(
    entity_type: Optional[str] = Query(None, description="Filter by: attendance | marks | students | timetables | exams"),
    action: Optional[str] = Query(None, description="Filter by: CREATE | UPDATE | DELETE"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin),
):
    """
    Access compliance and security audit logs tracking all student, marks,
    and attendance mutations. Strictly restricted to Admins.
    """
    query = db.query(models.AuditLog)
    if entity_type:
        query = query.filter(models.AuditLog.entity_type == entity_type)
    if action:
        query = query.filter(models.AuditLog.action == action)

    return query.order_by(models.AuditLog.timestamp.desc()).limit(limit).all()

